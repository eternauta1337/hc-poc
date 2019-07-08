const getWeb3 = require('../scripts/getWeb3.js');
const deploy = require('../scripts/deploy.js');
const util = require('../scripts/util.js');

describe('HCVoting', () => {

    let web3;
    let accounts;
    let txParams;
    let voteTokenContract;
    let stakeTokenContract;
    let votingContract;

    beforeAll(async () => {
        web3 = getWeb3('localhost');
        accounts = await web3.eth.getAccounts();
        txParams = {
          from: accounts[0],
          gas: 5000000,
          gasPrice: 1
        };
    });

    // TODO: Test invalid deploy parameters
    
    describe('When setting up a Voting contract correctly', () => {
    
        beforeEach(async () => {
            
            // Deploy voting and staking Token contracts.
            voteTokenContract = await deploy('Token', [], txParams);
            stakeTokenContract = await deploy('Token', [], txParams);

            // Deploy and initialize Voting contract.
            votingContract = await deploy('HCVoting', [], txParams);
            await votingContract.methods.initializeVoting(
                voteTokenContract.options.address,
                51,
                5
            ).send({ ...txParams });
            await votingContract.methods.initializeStaking(
                stakeTokenContract.options.address
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

        describe('When staking on a proposal', () => {
            
            beforeEach(async () => {
                
                // Create a proposal.
                await votingContract.methods.createProposal(
                    `DAOs should rule the world`
                ).send({ ...txParams });
            });

            test('Should reject staking on proposals that do not exist', async () => {
                let error;
                try {
                    await votingContract.methods.addUpstakeToProposal(9, 1).send({ ...txParams, from: accounts[0] });
                }
                catch(e) { error = e }
                expect(error.message).toContain(`VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`);
                try {
                    await votingContract.methods.addDownstakeToProposal(9, 1).send({ ...txParams, from: accounts[0] });
                }
                catch(e) { error = e }
                expect(error.message).toContain(`VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`);
                try {
                    await votingContract.methods.removeUpstakeFromProposal(9, 1).send({ ...txParams, from: accounts[0] });
                }
                catch(e) { error = e }
                expect(error.message).toContain(`VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`);
                try {
                    await votingContract.methods.removeDownstakeFromProposal(9, 1).send({ ...txParams, from: accounts[0] });
                }
                catch(e) { error = e }
                expect(error.message).toContain(`VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`);
            });

            // describe('That are still open', () => {
                
            //     test('', async () => {
                    
            //     });
            // });

            // describe('That have expired', () => {
                
            // });
        });
    });
});
