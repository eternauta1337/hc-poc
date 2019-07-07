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

            // Deploy Token contract and mint some tokens.
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

        describe('When creating a few proposals', () => {

            let proposalCreationReceipt;

            beforeEach(async () => {
                for(let i = 0; i < 3; i++) {
                    proposalCreationReceipt = await votingContract.methods.createProposal(`DAOs should rule the world ${i}`).send(txParams);
                }
            });

            it('numProposals should increase', async () => {
                expect(await votingContract.methods.numProposals().call()).toBe(`3`);
            });

            it('Emits a CreateProposal event with appropriate data', async () => {
                expect(proposalCreationReceipt.events.StartProposal).not.toBeNull();
                const args = proposalCreationReceipt.events.StartProposal.returnValues;
                expect(args._proposalId).toBe(`2`);
                expect(args._creator).toBe(accounts[0]);
                expect(args._metadata).toBe(`DAOs should rule the world 2`);
            });

            it('Should retrieve the proposal', async () => {
                const proposal = await votingContract.methods.getProposal(2).call();
                expect(proposal.finalized).toBe(false);
                expect(proposal.yea).toBe(`0`);
                expect(proposal.nay).toBe(`0`);
                const startDateDeltaSecs = ( new Date().getTime() / 1000 ) - parseInt(proposal.startDate, 10);
                expect(startDateDeltaSecs).toBeLessThan(2);
            });
            
            describe('When voting on proposals', () => {

                beforeEach(async () => {

                    // Mint some vote tokens.
                    await tokenContract.methods.mint(accounts[0], 1).send(txParams);
                    await tokenContract.methods.mint(accounts[1], 1).send(txParams);
                    await tokenContract.methods.mint(accounts[2], 1).send(txParams);
                });

                it('Should allow addresses that own tokens to vote on an open proposal', async () => {

                    await votingContract.methods.vote(1, true).send({ ...txParams, from: accounts[0] });
                    await votingContract.methods.vote(1, true).send({ ...txParams, from: accounts[1] });
                    await votingContract.methods.vote(1, false).send({ ...txParams, from: accounts[2] });

                    const proposal = await votingContract.methods.getProposal(1).call();
                    expect(proposal.yea).toBe(`2`);
                    expect(proposal.nay).toBe(`1`);

                    let vote;
                    vote = await votingContract.methods.getVote(1, accounts[0]).call();
                    expect(vote).toBe(`1`);
                    vote = await votingContract.methods.getVote(1, accounts[1]).call();
                    expect(vote).toBe(`1`);
                    vote = await votingContract.methods.getVote(1, accounts[2]).call();
                    expect(vote).toBe(`2`);
                });

                // it('Should reject voting on proposals that have expired', async () => {
                    
                // });

                // it('Should reject voting on proposals that do not exist', async () => {
                    
                // });

                // it('Should reject voting by accounts that own no tokens', async () => {
                    
                // });

        //         describe('Finalizing proposals', () => {
                    
        //         });
            });
        });
    });
});
