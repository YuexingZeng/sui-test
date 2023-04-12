import {
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
  TransactionBlock,
  localnetConnection,
  normalizeSuiObjectId,
  fromB64,
} from '@mysten/sui.js';

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
const gamePkgObjectId = "0x8cca8815a9f72b118379cff4769e1c622ee62d12c26b1d49469373a8a679b0ca";
const stateObjectId = "0x0a24d0271e7487e9881055e35197913f0055e255fc0b4f47dc2e474a1ce1b715";

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
  console.log(`new_game resultOfExec=${JSON.stringify(resultOfExec, null, 2)}`)
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
  console.log(`join_game resultOfExec=${JSON.stringify(resultOfExec, null, 2)}`)
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
  console.log(`first_turn resultOfExec=${JSON.stringify(resultOfExec, null, 2)}`)
  console.log(`firstTurn end`)
}

async function turn(signer: RawSigner) {
  console.log(`turn start`)
  let { boardHashes, F } = await initialize();
  // board starting verification proof public / private inputs
  const input = {
    ships: boards.bob,
    hash: F.toObject(boardHashes.bob),
    shot: [1,0],
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
  let proofStr = "e23b1e992b083bfd079e26c1ae83b7710589685bfe047b9c2498647d6ef585242d1a9bedca69e2d18beb5cd403baf59fa055b95e41861b042dc446febc774923519efb4075c2c1b09b29f030ecd15c9822b716583e86711baa2dfe547d4c761ba5e43de9ce277bfecd65c7693b5775794fd73b90157dc63b900b77afa9cedd0a"
  let proofArr = hexToArr(proofStr);
  tx.moveCall({
    target: `${gamePkgObjectId}::battleship::turn`,
    arguments: [tx.object(stateObjectId),
      // tx.pure("cd95c1bc3ae661db04eeeda09d9cc6bcc336aa00bb339316836d76041e3dd5   89  dce63a064e65eb6727ffacf0c2aa36e0edda38e5f05faf8c0483bd340e69c612  2a36b4320d966692d2df5f16fcf1e192b2a7777fc8df63ee3a245708c1c50d25  61bf61ca1665db04ca5c26e23e7b9ee1f2bcf03e581372a2ead3ab37b332db  09"),
      tx.pure(0x1),
      tx.pure(0x1),
      tx.pure(0x9),
      tx.pure(0x9),
      tx.pure(proofArr)
    ],
  });
  tx.setGasBudget(300000);
  let resultOfExec = await signer.signAndExecuteTransactionBlock({
    transactionBlock:
      tx, options: { showObjectChanges: true, showEffects: true, showEvents: true, showInput: true }
  });
  console.log(`turn resultOfExec=${JSON.stringify(resultOfExec, null, 2)}`)
  console.log(`turn end`)
}

async function main() {

  // from ~/.sui/sui_config/sui.keystore
  let activeAddrKeystore_alice = "AN5qlDRE9CZTYO/i/JgyZLfC+Bo2LvKO64HRbycxi3s+"
  let activeAddrKeystore_bob = "ABd8q6VqUNspn9oI/Dvc7T52CYEv/hpNFpsJi9id2LPX"

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
  await turn(signer_bob)
}

function hexToArr(hexString:string):any[] {
  let arr = new Array();
  for (let i = 0; i < hexString.length; i += 2) {
    let byte = parseInt(hexString.substring(i, i+2), 16);
    arr.push(byte);
  }
  return arr;
}

main()
