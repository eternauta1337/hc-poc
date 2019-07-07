const getWeb3 = require('../scripts/getWeb3.js');
const deploy = require('../scripts/deploy.js');

describe('Token', () => {
    const web3 = getWeb3('localhost');

    let accounts;
    let txParams;
    let tokenContract;
    let votingContract;

    beforeEach(async () => {
    
        // Get accounts and tx params.
        accounts = await web3.eth.getAccounts();
        txParams = {
          from: accounts[0],
          gas: 5000000,
          gasPrice: 1
        };

        // Deploy Token contract.
        tokenContract = await deploy('Token', [], txParams);
    });

    it('Token gets deployed correctly', async () => {
        expect(web3.utils.isAddress(tokenContract.options.address)).toBe(true);
    });

    // TODO: Basic ERC20 tests...
});
