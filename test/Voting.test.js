const getWeb3 = require('../scripts/getWeb3.js');
const deploy = require('../scripts/deploy.js');
const util = require('../scripts/util.js');

describe('Voting', () => {

    let web3;
    let accounts;
    let txParams;
    let tokenContract;
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
            
            // Deploy Token contract and mint some tokens.
            tokenContract = await deploy('Token', [], txParams);

            // Deploy and initialize Voting contract.
            votingContract = await deploy('Voting', [], txParams);
            await votingContract.methods.initializeVoting(
                tokenContract.options.address,
                51,
                5
            ).send({ ...txParams });
        });

        test('Token gets deployed correctly', async () => {
            expect(web3.utils.isAddress(tokenContract.options.address)).toBe(true);
        });

        test('Voting gets deployed correctly', async () => {
            expect(web3.utils.isAddress(votingContract.options.address)).toBe(true);
        });

        test('Uses the correct token instance', async () => {
            const voteToken = await votingContract.methods.voteToken().call();
            expect(voteToken).toBe(tokenContract.options.address);
        });

        test('Has the correct absolute majority value set', async () => {
            const supportPct = await votingContract.methods.supportPct().call();
            expect(supportPct).toBe(`51`);
        });

        test('Has the correct proposal lifetime set', async () => {
            const proposalLifeTime = await votingContract.methods.proposalLifeTime().call();
            expect(proposalLifeTime).toBe(`5`);
        });

        describe('When creating proposals', () => {

            let proposalCreationReceipt;

            beforeEach(async () => {

                // Create a few proposals.
                for(let i = 0; i < 3; i++) {
                    proposalCreationReceipt = await votingContract.methods.createProposal(
                        `DAOs should rule the world ${i}`
                    ).send({ ...txParams });
                }
            });

            test('numProposals should increase', async () => {
                expect(await votingContract.methods.numProposals().call()).toBe(`3`);
            });

            test('Emits a CreateProposal event with appropriate data', async () => {
                expect(proposalCreationReceipt.events.StartProposal).not.toBeNull();
                const args = proposalCreationReceipt.events.StartProposal.returnValues;
                expect(args._proposalId).toBe(`2`);
                expect(args._creator).toBe(accounts[0]);
                expect(args._metadata).toBe(`DAOs should rule the world 2`);
            });

            test('Should retrieve the proposal', async () => {
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
                    await tokenContract.methods.mint(accounts[0], 1).send({ ...txParams });
                    await tokenContract.methods.mint(accounts[1], 1).send({ ...txParams });
                    await tokenContract.methods.mint(accounts[2], 1).send({ ...txParams });
                    await tokenContract.methods.mint(accounts[3], 1).send({ ...txParams });
                    await tokenContract.methods.mint(accounts[4], 1).send({ ...txParams });
                    await tokenContract.methods.mint(accounts[5], 1).send({ ...txParams });
                });

                describe('That are still open', () => {
                    
                    // TODO: Test emit vote event

                    test('Should allow addresses that own tokens to vote on an open proposal', async () => {

                        // Cast some random votes.
                        await votingContract.methods.vote(1, true).send({ ...txParams, from: accounts[0] });
                        await votingContract.methods.vote(1, true).send({ ...txParams, from: accounts[1] });
                        await votingContract.methods.vote(1, false).send({ ...txParams, from: accounts[2] });

                        // Retrieve the proposal and verify that the votes were recoreded.
                        const proposal = await votingContract.methods.getProposal(1).call();
                        expect(proposal.yea).toBe(`2`);
                        expect(proposal.nay).toBe(`1`);

                        // Verify that each voter's vote state is coherent with the vote.
                        let vote;
                        vote = await votingContract.methods.getVote(1, accounts[0]).call();
                        expect(vote).toBe(`1`);
                        vote = await votingContract.methods.getVote(1, accounts[1]).call();
                        expect(vote).toBe(`1`);
                        vote = await votingContract.methods.getVote(1, accounts[2]).call();
                        expect(vote).toBe(`2`);
                    });

                    test('Should reject voting on proposals that do not exist', async () => {
                        let error;
                        try {
                            await votingContract.methods.vote(9, true).send({ ...txParams, from: accounts[0] });
                        }
                        catch(e) { error = e }
                        expect(error.message).toContain(`VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`);
                    });

                    test('Should reject voting by accounts that own no tokens', async () => {
                        let error;
                        try {
                            await votingContract.methods.vote(1, true).send({ ...txParams, from: accounts[9] });
                        }
                        catch(e) { error = e }
                        expect(error.message).toContain(`VOTING_ERROR_USER_HAS_NO_VOTING_POWER`);
                    });

                    describe('When finalizing proposals', () => {

                        test('Should not allow a proposal to be resolved without absolute majority', async () => {
                            
                            // Cast votes with enough support.
                            await votingContract.methods.vote(1, true ).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.vote(1, true ).send({ ...txParams, from: accounts[1] });
                            await votingContract.methods.vote(1, false).send({ ...txParams, from: accounts[5] });

                            // Try to finalize the proposal.
                            // An error is expected, because the proposal has not reached an absolute majority.
                            let error;
                            try {
                                await votingContract.methods.finalizeProposal(1).send({ ...txParams });
                            }
                            catch(e) { error = e }
                            expect(error.message).toContain(`VOTING_NOT_ENOUGH_ABSOLUTE_SUPPORT`);
                        });
                        
                        test('Should allow to finalize a proposal with absolute majority approval, emitting an event', async () => {
                            
                            // Cast votes with enough support.
                            await votingContract.methods.vote(1, true ).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.vote(1, true ).send({ ...txParams, from: accounts[1] });
                            await votingContract.methods.vote(1, true ).send({ ...txParams, from: accounts[2] });
                            await votingContract.methods.vote(1, true ).send({ ...txParams, from: accounts[3] });
                            await votingContract.methods.vote(1, false).send({ ...txParams, from: accounts[4] });
                            await votingContract.methods.vote(1, false).send({ ...txParams, from: accounts[5] });

                            // Finalize the proposal.
                            const proposalFinalizationReceipt = await votingContract.methods.finalizeProposal(1).send({ ...txParams });
                            expect(proposalFinalizationReceipt.events.FinalizeProposal).not.toBeNull();
                            const args = proposalFinalizationReceipt.events.FinalizeProposal.returnValues;
                            expect(args._proposalId).toBe(`1`);

                            // Verify that the proposal is finalized.
                            const proposal = await votingContract.methods.getProposal(1).call();
                            expect(proposal.finalized).toBe(true);
                        });

                        test('Should allow a boosted proposal to be resolved locally (without absolute majority)', async () => {

                            // Create a proposal.
                            await votingContract.methods.createProposal('A proposal should be resolvable locally if boosted').send({ ...txParams });
                            
                            // Create some votes (with no majority).
                            await votingContract.methods.vote(0, true).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.vote(0, true).send({ ...txParams, from: accounts[1] });
                            await votingContract.methods.vote(0, false).send({ ...txParams, from: accounts[2] });

                            // Boost the proposal.
                            await votingContract.methods._boostProposal(0).send({ ...txParams });

                            // Finalize the proposal.
                            const proposalFinalizationReceipt = await votingContract.methods.finalizeProposal(0).send({ ...txParams });
                            expect(proposalFinalizationReceipt.events.FinalizeProposal).not.toBeNull();
                            const args = proposalFinalizationReceipt.events.FinalizeProposal.returnValues;
                            expect(args._proposalId).toBe(`0`);

                            // Verify that the proposal is finalized.
                            const proposal = await votingContract.methods.getProposal(0).call();
                            expect(proposal.finalized).toBe(true);
                        });
                    });
                });

                describe('That have expired', () => {

                    beforeEach(async () => {
                        await util.skipTime(5 + 1);
                    });
                    
                    test('Should reject voting on proposals that have expired', async () => {
                        let error;
                        try {
                            await votingContract.methods.vote(0, true).send({ ...txParams, from: accounts[0] })
                        }
                        catch(e) { error = e };
                        expect(error.message).toContain(`VOTING_ERROR_PROPOSAL_IS_CLOSED`);
                    });

                    // TODO: Test finalizing a proposal that expired
                });
            });
        });
    });
});
