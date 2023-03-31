import {
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
  Transaction,
  localnetConnection ,
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
    //board: require('zk/board_verification_key.json'),
    //shot: require('zk/shot_verification_key.json')
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
const gamePkgObjectId = "0x21f2e78062834484cf150f90a2c4fa82f1a072f6ad2346a9e93aa4b582b015bd";
const stateObjectId = "0x58498499e8fdfd5f6138fdfb66a2b1b45c848a59b22b0eea4200dada8a5b829c";

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

  let tx = new Transaction();
  tx.moveCall({
    target: `${gamePkgObjectId}::battleship::new_game`,
    arguments: [tx.pure(stateObjectId)],
  });
  tx.setGasBudget(10000);
  let resultOfExec = await signer.signAndExecuteTransaction({ transaction:
  tx, options: {showObjectChanges: true, showEffects: true, showEvents: true, showInput: true } });
  console.log(`new_game resultOfExec=${JSON.stringify(resultOfExec, null, 2)}`)

  console.log(`startNewGame end`)
}

async function main() {

// from ~/.sui/sui_config/sui.keystore
let activeAddrKeystore = "AMHJxIEeC35bggs5JMdHk4skawDPA//rAteZhLhrHw3J"

const PRIVATE_KEY_SIZE = 32;
const raw = fromB64(activeAddrKeystore);
if (raw[0] !== 0 || raw.length !== PRIVATE_KEY_SIZE + 1) {
  throw new Error('invalid key');
}
const keypair = Ed25519Keypair.fromSecretKey(raw.slice(1))

const provider = new JsonRpcProvider(localnetConnection);
const signer = new RawSigner(keypair, provider);

await startNewGame(signer)

console.log(`signer=${signer}`);

const address = await signer.getAddress();
console.log(`address=${address}`);

const balance = await provider.getBalance({'owner': address});
console.log(`balance=${JSON.stringify(balance)}`)

let objects = await provider.getOwnedObjects(
  {'owner': address},
);
console.log(`objects=${JSON.stringify(objects)}`)

// from output of 'sui client publish xxx'
const packageObjectId = "0x8bc91a9c763aa167ce8aa3eb8881bafb990d58fd17dcb92c4fc756d4217d12fe";

let tx = new Transaction();
tx.moveCall({
  target: `${packageObjectId}::counter::create`,
  arguments: [],
});
let result = await signer.signAndExecuteTransaction({ transaction:
tx, options: {showObjectChanges: true, showEffects: true, showEvents: true, showInput: true } });
console.log(`result=${JSON.stringify(result, null, 2)}`)
let created = result?.effects?.created;
let counterId = created && created[0].reference.objectId;
console.log(`counterId=${counterId}`)

tx = new Transaction();
tx.moveCall({
  target: `${packageObjectId}::counter::increment`,
  arguments: [tx.pure(counterId)],
});
result = await signer.signAndExecuteTransaction({ transaction:
tx, options: {showObjectChanges: true, showEffects: true, showEvents: true, showInput: true } });
console.log(`result=${JSON.stringify(result, null, 2)}`)

let counterInfo = await provider.getObject(
  {
    id: `${counterId}`,
    options: {showContent: true},
  }
)
console.log(`counterInfo=${JSON.stringify(counterInfo, null, 2)}`)

}
main()
