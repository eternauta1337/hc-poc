const fs = require('fs');
const getWeb3 = require('../scripts/getWeb3.js');

module.exports = async (contractName, args, txParams) => {

    // Retrieve contract artifacts.
    const artifacts = JSON.parse(fs.readFileSync(`build/${contractName}.json`, 'utf8'));

    // Build Web3 Contract object.
    const web3 = getWeb3('localhost');
    const contract = new web3.eth.Contract(artifacts.abi);

    // Deploy contract.
    const instance = await contract.deploy({
        arguments: args,
        data: artifacts.bytecode
    }).send({ ...txParams });

    return instance;
};
