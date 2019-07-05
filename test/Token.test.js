const fs = require('fs');
const getWeb3 = require('../scripts/getWeb3.js');

describe('Token', () => {

  // TODO: Remove this dummy test case.
  test('Should run', async () => {
    const web3 = await getWeb3('localhost');

    // Prepare tx params.
    const accounts = await web3.eth.getAccounts();
    const params = {
      from: accounts[0],
      gas: 3000000,
      gasPrice: '20000000000'
    };

    // Deploy contract.
    console.log(`Deploying contract...`);
    const artifacts = JSON.parse(fs.readFileSync('build/Token.json', 'utf8'));
    const contract = new web3.eth.Contract(artifacts.abi);
    const instance = await contract.deploy({
      data: artifacts.bytecode
    }).send(params)
    const address = instance.options.address;
    console.log(`Contract deployed at:`, address);

    // Interact with contract.
    console.log(`Interacting with contract...`);
    const ping = await instance.methods.testToken().call(params);
    console.log(`ping`, ping);

    // Dummy pass.
    expect(1).toBe(1);
  });
});
