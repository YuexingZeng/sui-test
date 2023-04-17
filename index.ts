import {
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
  TransactionBlock,
  localnetConnection,
  normalizeSuiObjectId,
  fromB64,
} from '@mysten/sui.js';

const { buildBn128, Scalar } = require("ffjavascript");
const snarkjs = require('snarkjs')
const { buildMimcSponge } = require("circomlibjs")

import fs from 'fs'
var shot_verification_key = JSON.parse(fs.readFileSync('zk/shot_verification_key.json', 'utf-8'))
var board_verification_key = JSON.parse(fs.readFileSync('zk/board_verification_key.json', 'utf-8'))

// verification key json files
const verificationKeys = {
  board: board_verification_key,
  shot: shot_verification_key
}

// x, y, z (horizontal/ verical orientation) ship placements
const boards = {
  alice: [
    ["0", "0", "0"],
    ["0", "1", "0"],
    ["0", "2", "0"],
    ["0", "3", "0"],
    ["0", "4", "0"]
  ],
  bob: [
    ["1", "0", "0"],
    ["1", "1", "0"],
    ["1", "2", "0"],
    ["1", "3", "0"],
    ["1", "4", "0"]
  ]
}

const shots = {
  alice: [
    [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
    [1, 1], [2, 1], [3, 1], [4, 1],
    [1, 2], [2, 2], [3, 2],
    [1, 3], [2, 3], [3, 3],
    [1, 4], [2, 4]
  ],
  bob: [
    [9, 9], [9, 8], [9, 7], [9, 6], [9, 5],
    [9, 4], [9, 3], [9, 2], [9, 1],
    [9, 0], [8, 9], [8, 8],
    [8, 7], [8, 6], [8, 5],
    [8, 4]
  ]
}

async function initialize() {
  // instantiate mimc sponge on bn254 curve + store ffjavascript obj reference
  const mimcSponge = await buildMimcSponge()
  // store board hashes for quick use
  const boardHashes = {
    alice: await mimcSponge.multiHash(boards.alice.flat()),
    bob: await mimcSponge.multiHash(boards.bob.flat())
  }

  return { boardHashes, F: mimcSponge.F }
}

// from output of 'sui client publish xxx'
const gamePkgObjectId = "0x791e03db87931a7fadc816d421ffa887468316e38ee92d69ffccd5e7cdce0502";
const stateObjectId = "0x7314f53d2e1a9bc4e6225184e8e451ffb2e876aae73608bcf7d02b0ca39c4611";

async function startNewGame(signer: RawSigner) {
  console.log(`startNewGame start`)
  let { boardHashes, F } = await initialize();
  // board starting verification proof public / private inputs
  const input = {
    ships: boards.alice,
    hash: F.toObject(boardHashes.alice)
  }
  // compute witness and run through groth16 circuit for proof / signals
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'zk/board_js/board.wasm',
    'zk/zkey/board_final.zkey',
  )
  // verify proof locally
  let result = await snarkjs.groth16.verify(
    verificationKeys.board,
    publicSignals,
    proof
  )
  console.log(`verify proof result=${JSON.stringify(result, null, 2)}`)
  /*
  // prove on-chain hash is of valid board configuration
  const proofArgs = buildProofArgs(proof)
  let tx = await (await game.connect(alice).newGame(
      F.toObject(boardHashes.alice),
      ...proofArgs //pi_a, pi_b_0, pi_b_1, pi_c
  )).wait()
 */


  let tx = new TransactionBlock();
  let hashStr = "631314AF7FFCAAFF1C958C26C74A6ED9CE5D13738452974AA874E5AD12686D21";
  let proofStr = "cd95c1bc3ae661db04eeeda09d9cc6bcc336aa00bb339316836d76041e3dd589dce63a064e65eb6727ffacf0c2aa36e0edda38e5f05faf8c0483bd340e69c6122a36b4320d966692d2df5f16fcf1e192b2a7777fc8df63ee3a245708c1c50d2561bf61ca1665db04ca5c26e23e7b9ee1f2bcf03e581372a2ead3ab37b332db09"
  let hashArr = hexToArr(hashStr);
  let proofArr = hexToArr(proofStr);
  tx.moveCall({
    target: `${gamePkgObjectId}::battleship::new_game`,
    arguments: [tx.object(stateObjectId),
    // tx.pure("cd95c1bc3ae661db04eeeda09d9cc6bcc336aa00bb339316836d76041e3dd5   89  dce63a064e65eb6727ffacf0c2aa36e0edda38e5f05faf8c0483bd340e69c612  2a36b4320d966692d2df5f16fcf1e192b2a7777fc8df63ee3a245708c1c50d25  61bf61ca1665db04ca5c26e23e7b9ee1f2bcf03e581372a2ead3ab37b332db  09"),
    tx.pure(hashArr),
    tx.pure(proofArr)
    ],
  });
  tx.setGasBudget(300000);
  let resultOfExec = await signer.signAndExecuteTransactionBlock({
    transactionBlock:
      tx, options: { showObjectChanges: true, showEffects: true, showEvents: true, showInput: true }
  });
  console.log(`new_game resultOfExec=${JSON.stringify(resultOfExec.effects?.status.status, null, 2)}`)
  console.log(`startNewGame end`)
}

async function joinGame(signer: RawSigner) {
  console.log(`joinGame start`)
  let { boardHashes, F } = await initialize();
  // board starting verification proof public / private inputs
  const input = {
    ships: boards.bob,
    hash: F.toObject(boardHashes.bob)
  }
  // compute witness and run through groth16 circuit for proof / signals
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'zk/board_js/board.wasm',
    'zk/zkey/board_final.zkey',
  )
  // verify proof locally
  let result = await snarkjs.groth16.verify(
    verificationKeys.board,
    publicSignals,
    proof
  )
  console.log(`verify proof result=${JSON.stringify(result, null, 2)}`)

  let tx = new TransactionBlock();
  let hashStr = "f1f479892c28b2a657da16ee1c96f42fff7ae2113b6c0e64db69c998b5c1f014";
  let proofStr = "102f0dfc122608a0182c5aaba931df04331698cb4a970e167044ab2555e1d0032c0b534e563fc920522d504737ad9e9c98f1a33795a539f127f5d576adb3251bfcce0577cc7d2cf7fe27de8ead282e432f87d3b543037870057d315b059013aa54c07c5197b8351ea0087399b9b7a536e112f30a12037314f0b28acf15e06595"
  let hashArr = hexToArr(hashStr);
  let proofArr = hexToArr(proofStr);
  tx.moveCall({
    target: `${gamePkgObjectId}::battleship::join_game`,
    arguments: [tx.object(stateObjectId),
    // tx.pure("cd95c1bc3ae661db04eeeda09d9cc6bcc336aa00bb339316836d76041e3dd5   89  dce63a064e65eb6727ffacf0c2aa36e0edda38e5f05faf8c0483bd340e69c612  2a36b4320d966692d2df5f16fcf1e192b2a7777fc8df63ee3a245708c1c50d25  61bf61ca1665db04ca5c26e23e7b9ee1f2bcf03e581372a2ead3ab37b332db  09"),
    tx.pure(0x1),
    tx.pure(hashArr),
    tx.pure(proofArr)
    ],
  });
  tx.setGasBudget(300000);
  let resultOfExec = await signer.signAndExecuteTransactionBlock({
    transactionBlock:
      tx, options: { showObjectChanges: true, showEffects: true, showEvents: true, showInput: true }
  });
  console.log(`join_game resultOfExec=${JSON.stringify(resultOfExec.effects?.status.status, null, 2)}`)
  console.log(`joinGame end`)
}

async function firstTurn(signer: RawSigner) {
  console.log(`firstTurn start`)
  let tx = new TransactionBlock();
  tx.moveCall({
    target: `${gamePkgObjectId}::battleship::first_turn`,
    arguments: [tx.object(stateObjectId),
    // tx.pure("cd95c1bc3ae661db04eeeda09d9cc6bcc336aa00bb339316836d76041e3dd5   89  dce63a064e65eb6727ffacf0c2aa36e0edda38e5f05faf8c0483bd340e69c612  2a36b4320d966692d2df5f16fcf1e192b2a7777fc8df63ee3a245708c1c50d25  61bf61ca1665db04ca5c26e23e7b9ee1f2bcf03e581372a2ead3ab37b332db  09"),
    tx.pure(0x1),
    tx.pure(0x1),
    tx.pure(0x0)
    ],
  });
  tx.setGasBudget(300000);
  let resultOfExec = await signer.signAndExecuteTransactionBlock({
    transactionBlock:
      tx, options: { showObjectChanges: true, showEffects: true, showEvents: true, showInput: true }
  });
  console.log(`first_turn resultOfExec=${JSON.stringify(resultOfExec.effects?.status.status, null, 2)}`)
  console.log(`firstTurn end`)
}

async function simulateTurn(aliceNonce: any,signer_alice: RawSigner,signer_bob: RawSigner) {
  console.log("Bob reporting result of Alice shot %d", aliceNonce);
  let { boardHashes, F } = await initialize();
  let input = {
    ships: boards.bob,
    hash: F.toObject(boardHashes.bob),
    shot: shots.alice[aliceNonce - 1],
    hit: 1,
  }
  // compute witness and run through groth16 circuit for proof / signals
  let { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'zk/shot_js/shot.wasm',
    'zk/zkey/shot_final.zkey'
  )
  // verify proof locally
  let result = await snarkjs.groth16.verify(verificationKeys.shot, publicSignals, proof)
  console.log(`verify proof result=${JSON.stringify(result, null, 2)}`)

  let tx_bob_turn = new TransactionBlock();
  let proofStr_bob_turn = await parseProof(proof);
  let proofArr_bob_turn = hexToArr(proofStr_bob_turn);
  tx_bob_turn.moveCall({
    target: `${gamePkgObjectId}::battleship::turn`,
    arguments: [tx_bob_turn.object(stateObjectId),
    // tx.pure("cd95c1bc3ae661db04eeeda09d9cc6bcc336aa00bb339316836d76041e3dd5   89  dce63a064e65eb6727ffacf0c2aa36e0edda38e5f05faf8c0483bd340e69c612  2a36b4320d966692d2df5f16fcf1e192b2a7777fc8df63ee3a245708c1c50d25  61bf61ca1665db04ca5c26e23e7b9ee1f2bcf03e581372a2ead3ab37b332db  09"),
    tx_bob_turn.pure(0x1),
    tx_bob_turn.pure(0x1),
    tx_bob_turn.pure(shots.bob[aliceNonce-1][0]),
    tx_bob_turn.pure(shots.bob[aliceNonce-1][1]),
    tx_bob_turn.pure(proofArr_bob_turn)
    ],
  });
  tx_bob_turn.setGasBudget(300000);
  let resultOfExec_bob_turn = await signer_bob.signAndExecuteTransactionBlock({
    transactionBlock:
      tx_bob_turn, options: { showObjectChanges: true, showEffects: true, showEvents: true, showInput: true }
  });
  console.log(`turn resultOfExec=${JSON.stringify(resultOfExec_bob_turn.effects?.status.status, null, 2)}`)
  /// ALICE PROVES BOB PREV REGISTERED SHOT MISSED ///
  console.log("Alice reporting result of Bob shot %d",aliceNonce-1);
  // bob's shot hit/miss integrity proof public / private inputs
  input = {
    ships: boards.alice,
    hash: F.toObject(boardHashes.alice),
    shot: shots.bob[aliceNonce - 1],
    hit: 0
  };
  // compute witness and run through groth16 circuit for proof / signals
  ({ proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'zk/shot_js/shot.wasm',
    'zk/zkey/shot_final.zkey'
  ));
  // verify proof locally
  result = await snarkjs.groth16.verify(verificationKeys.shot, publicSignals, proof)
  console.log(`verify proof result=${JSON.stringify(result, null, 2)}`)
  // prove bob's registered shot missed, and register alice's next shot
  let tx_alice_turn = new TransactionBlock();
  let proofStr_alice_turn = await parseProof(proof);
  let proofArr_alice_turn = hexToArr(proofStr_alice_turn);
  tx_alice_turn.moveCall({
    target: `${gamePkgObjectId}::battleship::turn`,
    arguments: [tx_alice_turn.object(stateObjectId),
    tx_alice_turn.pure(0x1),
    tx_alice_turn.pure(0x0),
    tx_alice_turn.pure(shots.alice[aliceNonce][0]),
    tx_alice_turn.pure(shots.alice[aliceNonce][1]),
    tx_alice_turn.pure(proofArr_alice_turn)
    ],
  });
  tx_alice_turn.setGasBudget(300000);
  let resultOfExec_alice_turn = await signer_alice.signAndExecuteTransactionBlock({
    transactionBlock:
      tx_alice_turn, options: { showObjectChanges: true, showEffects: true, showEvents: true, showInput: true }
  });
  console.log(`turn resultOfExec=${JSON.stringify(resultOfExec_alice_turn.effects?.status.status, null, 2)}`)
}

async function turn(signer: RawSigner) {
  console.log(`turn start`)
  let { boardHashes, F } = await initialize();
  // board starting verification proof public / private inputs
  const input = {
    ships: boards.bob,
    hash: F.toObject(boardHashes.bob),
    shot: shots.alice[16],
    hit: 1
  }
  // compute witness and run through groth16 circuit for proof / signals
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'zk/shot_js/shot.wasm',
    'zk/zkey/shot_final.zkey'
  )
  // verify proof locally
  let result = await snarkjs.groth16.verify(
    verificationKeys.shot,
    publicSignals,
    proof
  )
  console.log(`verify proof result=${JSON.stringify(result, null, 2)}`)

  let tx = new TransactionBlock();
  let proofStr = await parseProof(proof);
  let proofArr = hexToArr(proofStr);
  tx.moveCall({
    target: `${gamePkgObjectId}::battleship::turn`,
    arguments: [tx.object(stateObjectId),
    tx.pure(0x1),
    tx.pure(0x1),
    tx.pure(0x0),
    tx.pure(0x0),
    tx.pure(proofArr)
    ],
  });
  tx.setGasBudget(300000);
  let resultOfExec = await signer.signAndExecuteTransactionBlock({
    transactionBlock:
      tx, options: { showObjectChanges: true, showEffects: true, showEvents: true, showInput: true }
  });
  console.log(`turn resultOfExec=${JSON.stringify(resultOfExec.events, null, 2)}`)
}

function buff2hex(buff: any): any {
  function i2hex(i: any) {
    return ('0' + i.toString(16)).slice(-2);
  }
  return Array.from(buff).map(i2hex).join('');
}

function reverse(arr: Uint8Array): Uint8Array {
  let len = arr.length;
  let res = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    res[i] = arr[len - 1 - i];
  }
  return res;
}

async function parseProof(proof: any): Promise<any> {
  const bn128 = await buildBn128();
  let pi_a_P = bn128.G1.fromObject(
    [
      Scalar.e(proof.pi_a[0], 10),
      Scalar.e(proof.pi_a[1], 10),
      proof.pi_a[2] == '1' ? Scalar.one : Scalar.zero
    ]
  );
  let pi_b_P = bn128.G2.fromObject([
    [
      Scalar.e(proof.pi_b[0][0], 10),
      Scalar.e(proof.pi_b[0][1], 10)
    ],
    [
      Scalar.e(proof.pi_b[1][0], 10),
      Scalar.e(proof.pi_b[1][1], 10)
    ],
    [
      proof.pi_b[2][0] == '1' ? Scalar.one : Scalar.zero,
      proof.pi_b[2][1] == '0' ? Scalar.zero : Scalar.one
    ]
  ]);
  let pi_c_P = bn128.G1.fromObject(
    [
      Scalar.e(proof.pi_c[0], 10),
      Scalar.e(proof.pi_c[1], 10),
      proof.pi_c[2] == '1' ? Scalar.one : Scalar.zero
    ]
  );
  const buff_a = new Uint8Array(32);
  const buff_b = new Uint8Array(64);
  const buff_c = new Uint8Array(32);
  bn128.G1.toRprCompressed(buff_a, 0, pi_a_P);
  bn128.G2.toRprCompressed(buff_b, 0, pi_b_P);
  bn128.G1.toRprCompressed(buff_c, 0, pi_c_P);
  return buff2hex(reverse(buff_a)) + buff2hex(reverse(buff_b)) + buff2hex(reverse(buff_c));
}

async function main() {
  // from ~/.sui/sui_config/sui.keystore
  let activeAddrKeystore_alice = "ALzSpn6m3IMjuVsEYWAG+bcCFvpoiQY/+HfMxKeWbhbn"
  let activeAddrKeystore_bob = "AFUjzxUrFqq4o7GAnnivTrX1y+V4qyZ8eF3TwuaPYQfo"

  const PRIVATE_KEY_SIZE = 32;
  const raw_alice = fromB64(activeAddrKeystore_alice);
  const raw_bob = fromB64(activeAddrKeystore_bob);
  if (raw_alice[0] !== 0 || raw_alice.length !== PRIVATE_KEY_SIZE + 1) {
    throw new Error('invalid key');
  }
  if (raw_bob[0] !== 0 || raw_bob.length !== PRIVATE_KEY_SIZE + 1) {
    throw new Error('invalid key');
  }
  const keypair_alice = Ed25519Keypair.fromSecretKey(raw_alice.slice(1))
  const keypair_bob = Ed25519Keypair.fromSecretKey(raw_bob.slice(1))

  const provider = new JsonRpcProvider(localnetConnection);
  const signer_alice = new RawSigner(keypair_alice, provider);
  const signer_bob = new RawSigner(keypair_bob, provider);

  await startNewGame(signer_alice)
  await joinGame(signer_bob)
  await firstTurn(signer_alice)
  for (let i = 1; i <= 16; i++) {
    console.log("Prove hit/ miss for 32 turns")
    await simulateTurn(i,signer_alice,signer_bob);
  }
  console.log("Alice wins on sinking all of Bob\'s ships")
  await turn(signer_bob);
}

function hexToArr(hexString: string): any[] {
  let arr = new Array();
  for (let i = 0; i < hexString.length; i += 2) {
    let byte = parseInt(hexString.substring(i, i + 2), 16);
    arr.push(byte);
  }
  return arr;
}

main()
