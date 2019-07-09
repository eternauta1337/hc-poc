const getWeb3 = require('../scripts/getWeb3.js');
const deploy = require('../scripts/deploy.js');
const util = require('../scripts/util.js');
const reverts = require('../scripts/reverts.js');

describe('HolographicConsensus', () => {
    
    let web3;
    let accounts;
    let txParams;
    let voteTokenContract;
    let stakeTokenContract;
    let votingContract;

    const SUPPORT_PERCENT = 51;
    const QUEUE_PERIOD_SECS = 60;
    const BOOST_PERIOD_SECS = 10;
    const BOOST_PERIOD_EXTENSION_SECS = 5;
    const PENDEND_BOOST_PERIOD_SECS = 5;
    const COMPENSATION_FEE_PERCENT = 1;

    beforeAll(async () => {
        web3 = getWeb3('localhost');
        accounts = await web3.eth.getAccounts();
        txParams = {
          from: accounts[0],
          gas: 6700000,
          gasPrice: 1
        };
    });

    describe('When setting up an HC contract correctly', () => {

        beforeEach(async () => {

            // Deploy voting and staking Token contracts.
            voteTokenContract = await deploy('Token', [], txParams);
            stakeTokenContract = await deploy('Token', [], txParams);

            // Deploy and initialize Voting contract.
            votingContract = await deploy('HolographicConsensus', [], txParams);
            await votingContract.methods.initializeVoting(
                voteTokenContract.options.address,
                SUPPORT_PERCENT,
                QUEUE_PERIOD_SECS,
                BOOST_PERIOD_SECS,
                BOOST_PERIOD_EXTENSION_SECS,
                COMPENSATION_FEE_PERCENT
            ).send({ ...txParams });
            await votingContract.methods.initializeStaking(
                stakeTokenContract.options.address,
                PENDEND_BOOST_PERIOD_SECS
            ).send({ ...txParams });
        });

        test('Vote token gets deployed correctly', async () => {
            expect(web3.utils.isAddress(voteTokenContract.options.address)).toBe(true);
        });

        test('Stake token gets deployed correctly', async () => {
            expect(web3.utils.isAddress(stakeTokenContract.options.address)).toBe(true);
        });

        test('Voting gets deployed correctly', async () => {
            expect(web3.utils.isAddress(votingContract.options.address)).toBe(true);
        });
    });

    // TODO
    // describe('When setting up an HC contract incorrectly');
});
