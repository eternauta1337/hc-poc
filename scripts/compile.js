const pocketh = require('./pocketh.js');

// Retrieve a list of all contracts to compile.
const contractPaths = [
    'Token.sol',
    'Voting.sol',
];

// Cleanup previous compilations.
// TODO

// Compile all contracts.
contractPaths.reduce(async (previousPromise, contractPath) => {
  await previousPromise;
  console.log(`Compiling ${contractPath}...`);
  return pocketh(`compile`, `contracts/${contractPath}`, `build/`);
}, Promise.resolve());
