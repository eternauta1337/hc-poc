const getWeb3 = require('../scripts/getWeb3.js');
const deploy = require('../scripts/deploy.js');

describe('Voting', () => {

    const web3 = getWeb3('localhost');

    let accounts;
    let txParams;
    let tokenContract;
    let votingContract;

    // TODO: Test invalid deploy parameters

    const ABS_MAJORITY_PCT = `${51 * 10 ** 16}`;
    const PROPOSAL_LIFETIME = `5`;

    describe('Basic Voting contract setup', () => {
    
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

            // Deploy Voting contract.
            votingContract = await deploy('Voting', [
                tokenContract.options.address,
                ABS_MAJORITY_PCT,
                PROPOSAL_LIFETIME
            ], txParams);
        });

        it('Token gets deployed correctly', async () => {
            expect(web3.utils.isAddress(tokenContract.options.address)).toBe(true);
        });

        it('Voting gets deployed correctly', async () => {
            expect(web3.utils.isAddress(votingContract.options.address)).toBe(true);
        });

        it('Uses the correct token instance', async () => {
            const voteToken = await votingContract.methods.voteToken().call();
            expect(voteToken).toBe(tokenContract.options.address);
        });

        it('Has the correct absolute majority value set', async () => {
            const absMajoritySupportPct = await votingContract.methods.absMajoritySupportPct().call();
            expect(absMajoritySupportPct).toBe(ABS_MAJORITY_PCT);
        });

        it('Has the correct proposal lifetime set', async () => {
            const proposalLifeTime = await votingContract.methods.proposalLifeTime().call();
            expect(proposalLifeTime).toBe(PROPOSAL_LIFETIME);
        });

        // describe('Creating proposals', () => {
            
        //     describe('Voting on proposals', () => {
                
        //         describe('Finalizing proposals', () => {
                    
        //         });
        //     });
        // });
    });
});
