const fs = require('fs');
const pocketh = require('./pocketh.js');

// Retrieve a list of all contracts to compile.
const contractPaths = fs.readdirSync('./contracts/');
console.log(`Compiling contracts:`, contractPaths);

// Cleanup previous compilations.
const buildPath = './build/';
if(fs.existsSync(buildPath)) {
    fs.readdirSync(buildPath).forEach(function(file) {
        const filePath = buildPath + '/' + file;
        fs.unlinkSync(filePath);
    })
    fs.rmdirSync(buildPath);
}
fs.mkdirSync(buildPath);

// Compile all contracts.
contractPaths.reduce(async (previousPromise, contractPath) => {
  await previousPromise;
  console.log(`\nCompiling ${contractPath}...`);
  return pocketh(`compile`, `contracts/${contractPath}`, `build/`);
}, Promise.resolve());
