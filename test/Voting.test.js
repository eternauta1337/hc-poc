const getWeb3 = require('../scripts/getWeb3.js');
const deploy = require('../scripts/deploy.js');

describe('Voting', () => {

    const web3 = getWeb3('localhost');

    let accounts;
    let txParams;
    let tokenContract;
    let votingContract;

    // TODO: Test invalid deploy parameters

    const ABS_MAJORITY_PCT = `${51 * 10 ** 16}`; // 51%
    const PROPOSAL_LIFETIME = `5`; // 5 seconds

    describe('When setting up a Voting contract', () => {
    
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

        describe('When creating a proposal', () => {

            let proposalCreationReceipt;

            beforeEach(async () => {
                proposalCreationReceipt = await votingContract.methods.createProposal("DAOs should rule the world").send(txParams);
            });

            it('numProposals should increase', async () => {
                expect(await votingContract.methods.numProposals().call()).toBe(`1`);
            });

            it('Emits a CreateProposal event', async () => {
                expect(proposalCreationReceipt.events.StartProposal).not.toBeNull();
                const args = proposalCreationReceipt.events.StartProposal.returnValues;
                expect(args._proposalId).toBe(`0`);
                expect(args._creator).toBe(accounts[0]);
                expect(args._metadata).toBe(`DAOs should rule the world`);
            });

            // it.only('Should retrieve the proposal', async () => {
            //     const proposal = await votingContract.methods.getProposal(1).call();
            //     console.log(`proposal`, proposal);
            // });
            
        //     describe('Voting on proposals', () => {

        //         describe('Finalizing proposals', () => {
                    
        //         });
        //     });
        });
    });
});
