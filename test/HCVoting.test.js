const getWeb3 = require('../scripts/getWeb3.js');
const deploy = require('../scripts/deploy.js');
const util = require('../scripts/util.js');
const reverts = require('../scripts/reverts.js');

describe('HCVoting', () => {

    let web3;
    let accounts;
    let txParams;
    let voteTokenContract;
    let stakeTokenContract;
    let votingContract;

    const PROPOSAL_SUPPORT = 51;
    const PROPOSAL_LIFETIME_SECS = 60;

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
                PROPOSAL_SUPPORT,
                PROPOSAL_LIFETIME_SECS
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

        describe('When staking on proposals', () => {
            
            beforeEach(async () => {
                
                // Create a proposal.
                await votingContract.methods.createProposal(
                    `DAOs should rule the world`
                ).send({ ...txParams });
            });

            test('Should reject staking on proposals that do not exist', async () => {
                expect(await reverts(
                    votingContract.methods.stake(9, 1, true).send({ ...txParams, from: accounts[0] }),
                    `VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`
                )).toBe(true);
                expect(await reverts(
                    votingContract.methods.stake(9, 1, false).send({ ...txParams, from: accounts[0] }),
                    `VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`
                )).toBe(true);
                expect(await reverts(
                    votingContract.methods.unstake(9, 1, true).send({ ...txParams, from: accounts[0] }),
                    `VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`
                )).toBe(true);
                expect(await reverts(
                    votingContract.methods.unstake(9, 1, false).send({ ...txParams, from: accounts[0] }),
                    `VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`
                )).toBe(true);
            });

            describe('That are still open', () => {

                beforeEach(async () => {

                    // Mint some stake tokens.
                    await stakeTokenContract.methods.mint(accounts[0], 1000).send({ ...txParams });
                    await stakeTokenContract.methods.mint(accounts[1], 1000).send({ ...txParams });
                    await stakeTokenContract.methods.mint(accounts[2], 1000).send({ ...txParams });

                    // Increase allowance to the voting contract.
                    await stakeTokenContract.methods.approve(votingContract.options.address, `${10 ** 18}`).send({ ...txParams, from: accounts[0] });
                    await stakeTokenContract.methods.approve(votingContract.options.address, `${10 ** 18}`).send({ ...txParams, from: accounts[1] });
                    await stakeTokenContract.methods.approve(votingContract.options.address, `${10 ** 18}`).send({ ...txParams, from: accounts[2] });
                });
                
                test('Should allow someone to stake on a proposal', async () => {
                    
                    // Stake tokens.
                    const upstakeReceipt = await votingContract.methods.stake(0, 10, true).send({ ...txParams });
                    const downstakeReceipt = await votingContract.methods.stake(0, 5, false).send({ ...txParams });

                    // Verify that the proper events were triggered.
                    let event = upstakeReceipt.events.UpstakeProposal;
                    expect(event).not.toBeNull();
                    expect(event.returnValues._proposalId).toBe(`0`);
                    expect(event.returnValues._staker).toBe(accounts[0]);
                    expect(event.returnValues._amount).toBe(`10`);
                    event = downstakeReceipt.events.DownstakeProposal;
                    expect(event).not.toBeNull();
                    expect(event.returnValues._proposalId).toBe(`0`);
                    expect(event.returnValues._staker).toBe(accounts[0]);
                    expect(event.returnValues._amount).toBe(`5`);

                    // Stake some more.
                    await votingContract.methods.stake(0, 5, true).send({ ...txParams });
                    await votingContract.methods.stake(0, 5, false).send({ ...txParams });

                    // Verify that the proposal received the stakes.
                    const proposal = await votingContract.methods.getProposal(0).call();
                    expect(proposal.upstake).toBe(`15`);
                    expect(proposal.downstake).toBe(`10`);
 
                    // Verify that the proposal registers the sender's stakes.
                    const upstake = await votingContract.methods.getUpstake(0, accounts[0]).call();
                    expect(upstake).toBe(`15`);
                    const downstake = await votingContract.methods.getDownstake(0, accounts[0]).call();
                    expect(downstake).toBe(`10`);
                    
                    // Verify owner stake token balance decrease.
                    const stakerBalance = await stakeTokenContract.methods.balanceOf(accounts[0]).call();
                    expect(stakerBalance).toBe(`975`);

                    // Verify that the voting contract now holds the stake tokens.
                    const votingBalance = await stakeTokenContract.methods.balanceOf(votingContract.options.address).call();
                    expect(votingBalance).toBe(`25`);
                });

                test('Should allow someone to remove stake from a proposal', async () => {
                    
                    // Stake tokens.
                    await votingContract.methods.stake(0, 10, true).send({ ...txParams });
                    await votingContract.methods.stake(0, 5, false).send({ ...txParams });
                    
                    // Verify owner stake token balance decrease.
                    let stakerBalance = await stakeTokenContract.methods.balanceOf(accounts[0]).call();
                    expect(stakerBalance).toBe(`985`);

                    // Verify that the voting contract now holds the stake tokens.
                    let votingBalance = await stakeTokenContract.methods.balanceOf(votingContract.options.address).call();
                    expect(votingBalance).toBe(`15`);

                    // Retrieve stake.
                    const unUpstakeReceipt = await votingContract.methods.unstake(0, 10, true).send({ ...txParams });
                    const unDownstakeReceipt = await votingContract.methods.unstake(0, 5, false).send({ ...txParams });

                    // Verify that the proper events were triggered.
                    let event = unUpstakeReceipt.events.WithdrawUpstake;
                    expect(event).not.toBeNull();
                    expect(event.returnValues._proposalId).toBe(`0`);
                    expect(event.returnValues._staker).toBe(accounts[0]);
                    expect(event.returnValues._amount).toBe(`10`);
                    event = unDownstakeReceipt.events.WithdrawDownstake;
                    expect(event).not.toBeNull();
                    expect(event.returnValues._proposalId).toBe(`0`);
                    expect(event.returnValues._staker).toBe(accounts[0]);
                    expect(event.returnValues._amount).toBe(`5`);

                    // Verify that the staker retrieved the tokens.
                    stakerBalance = await stakeTokenContract.methods.balanceOf(accounts[0]).call();
                    expect(stakerBalance).toBe(`1000`);

                    // Verify that the voting contract no longer holds the tokens.
                    votingBalance = await stakeTokenContract.methods.balanceOf(votingContract.options.address).call();
                    expect(votingBalance).toBe(`0`);
                });

                test('Should not allow someone to withdraw tokens from a proposal that has no stake', async () => {
                    expect(await reverts(
                        votingContract.methods.unstake(0, 10, true).send({ ...txParams }),
                        `VOTING_ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE`
                    )).toBe(true);
                });

                test('Should not allow someone to withdraw tokens that were not staked by the staker', async () => {

                    // Stake tokens from account 0.
                    await votingContract.methods.stake(0, 10, true).send({ ...txParams });

                    // Attempt to unstake tokens from account 1.
                    expect(await reverts(
                        votingContract.methods.unstake(0, 10, true).send({ ...txParams, from: accounts[1] }),
                        `VOTING_ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE`
                    )).toBe(true);
                });

                test('Can retrieve a proposals confidence factor', async () => {
                    
                    // Stake tokens.
                    await votingContract.methods.stake(0, 10, true).send({ ...txParams });
                    await votingContract.methods.stake(0, 5, false).send({ ...txParams });

                    // Retrieve the confidence factor.
                    const confidence = await votingContract.methods.getConfidence(0).call();
                    expect(confidence).toBe(`${2 * 10 ** 16}`);
                });

                test.todo('Should not allow a staker to stake more tokens that the staker owns');
                test.todo('Multiple upstakes/downstakes reflect properly on a proposal\'s state');

                describe('When finalizing proposals', () => {

                    beforeEach(async () => {
                        
                        // Mint some vote tokens.
                        await voteTokenContract.methods.mint(accounts[0], 1).send({ ...txParams });
                        await voteTokenContract.methods.mint(accounts[1], 1).send({ ...txParams });
                        await voteTokenContract.methods.mint(accounts[2], 1).send({ ...txParams });
                        await voteTokenContract.methods.mint(accounts[3], 1).send({ ...txParams });
                        await voteTokenContract.methods.mint(accounts[4], 1).send({ ...txParams });
                        await voteTokenContract.methods.mint(accounts[5], 1).send({ ...txParams });
                    });

                    describe('With absolute majority', () => {
                        
                        beforeEach(async () => {

                            // Perform some stakes on the proposal.
                            await votingContract.methods.stake(0, 10, true).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.stake(0, 5, false).send({ ...txParams, from: accounts[1] });
                        });

                        test('Should allow stakers to withdraw their stakes when a proposal is finalized (with absolute majority)', async () => {
                            
                            // Cast votes with enough support.
                            await votingContract.methods.vote(0, true ).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.vote(0, true ).send({ ...txParams, from: accounts[1] });
                            await votingContract.methods.vote(0, true ).send({ ...txParams, from: accounts[2] });
                            await votingContract.methods.vote(0, true ).send({ ...txParams, from: accounts[3] });
                            await votingContract.methods.vote(0, false).send({ ...txParams, from: accounts[4] });
                            await votingContract.methods.vote(0, false).send({ ...txParams, from: accounts[5] });

                            // Finalize the proposal.
                            const proposalFinalizationReceipt = await votingContract.methods.finalizeProposal(0).send({ ...txParams });
                            expect(proposalFinalizationReceipt.events.FinalizeProposal).not.toBeNull();
                            const args = proposalFinalizationReceipt.events.FinalizeProposal.returnValues;
                            expect(args._proposalId).toBe(`0`);

                            // Verify that the proposal is finalized.
                            const proposal = await votingContract.methods.getProposal(0).call();
                            expect(proposal.finalized).toBe(true);

                            // Have stakers withdraw their tokens.
                            await votingContract.methods.unstake(0, 10, true).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.unstake(0, 5, false).send({ ...txParams, from: accounts[1] });

                            // Verify that the stakers retrieved their tokens.
                            expect(await stakeTokenContract.methods.balanceOf(accounts[0]).call()).toBe(`1000`);
                            expect(await stakeTokenContract.methods.balanceOf(accounts[1]).call()).toBe(`1000`);
                        });
                    });

                    describe('With relative majority (boosted)', () => {

                        beforeEach(async () => {

                            // Perform some stakes on the proposal.
                            await votingContract.methods.stake(0, 200, true).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.stake(0, 200, true).send({ ...txParams, from: accounts[1] });
                            await votingContract.methods.stake(0, 100, false).send({ ...txParams, from: accounts[2] });
                        });
                        
                        test('Should divide stakes pro-rata when a boosted proposal is finalized', async () => {
                            
                            // Cast votes without majority support.
                            await votingContract.methods.vote(0, true ).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.vote(0, true ).send({ ...txParams, from: accounts[1] });
                            await votingContract.methods.vote(0, false).send({ ...txParams, from: accounts[2] });

                            // Boost the proposal.
                            await votingContract.methods.boostProposal(0).send({ ...txParams });
                            let proposal = await votingContract.methods.getProposal(0).call();
                            expect(proposal.boosted).toBe(true);

                            // Finalize the proposal.
                            await votingContract.methods.finalizeProposal(0).send({ ...txParams });

                            // Verify that the proposal is finalized.
                            proposal = await votingContract.methods.getProposal(0).call();
                            expect(proposal.finalized).toBe(true);

                            // Have winning stakers retrieve their tokens.
                            await votingContract.methods.withdrawReward(0).send({ ...txParams, from: accounts[0] });
                            await votingContract.methods.withdrawReward(0).send({ ...txParams, from: accounts[1] });

                            // Have losing stakers try to retrieve their tokens (expected to fail).
                            expect(await reverts(
                                votingContract.methods.withdrawReward(0).send({ ...txParams, from: accounts[2] }),
                                `VOTING_ERROR_NO_WINNING_STAKE`
                            )).toBe(true);

                            // Verify that the stakers that predicted the outcome of the proposals received their reward.
                            expect(await stakeTokenContract.methods.balanceOf(accounts[0]).call()).toBe(`1050`);
                            expect(await stakeTokenContract.methods.balanceOf(accounts[1]).call()).toBe(`1050`);
                            expect(await stakeTokenContract.methods.balanceOf(accounts[2]).call()).toBe(`900`);
                        });

                        test('Should not allow to withdraw rewards from proposals that are not finalized', async () => {
                            expect(await reverts(
                                votingContract.methods.withdrawReward(0).send({ ...txParams, from: accounts[0] }),
                                `VOTING_ERROR_PROPOSAL_IS_NOT_FINALIZED`
                            )).toBe(true);
                        });
                    });

                    describe('That have expired', () => {

                        beforeEach(async () => {
                            await util.skipTime(PROPOSAL_LIFETIME_SECS + 1);
                        });
                        
                        test('Should reject staking on proposals that have expired', async () => {
                            expect(await reverts(
                                votingContract.methods.stake(0, 10, true).send({ ...txParams }),
                                `VOTING_ERROR_PROPOSAL_IS_CLOSED`
                            )).toBe(true);
                            expect(await reverts(
                                votingContract.methods.stake(0, 10, false).send({ ...txParams }),
                                `VOTING_ERROR_PROPOSAL_IS_CLOSED`
                            )).toBe(true);
                        });

                        test.todo('Should allow stakers to withdraw their stake');

                        // TODO: Test finalizing a proposal that expired
                    });
                });

                describe('When boosting proposals', () => {
                    
                    test('Should boost a proposal that has enough confidence', async () => {
                        
                        // Stake tokens.
                        await votingContract.methods.stake(0, 4, true).send({ ...txParams });
                        await votingContract.methods.stake(0, 1, false).send({ ...txParams });

                        // Retrieve the confidence factor.
                        const confidence = await votingContract.methods.getConfidence(0).call();
                        expect(confidence).toBe(`${4 * 10 ** 16}`);

                        // Boost the proposal.
                        await votingContract.methods.boostProposal(0).send({ ...txParams });
                        const proposal = await votingContract.methods.getProposal(0).call();
                        expect(proposal.boosted).toBe(true);
                    });

                    test('Should not boost a proposal that does not have enough confidence', async () => {
                        
                        // Stake tokens.
                        await votingContract.methods.stake(0, 3, true).send({ ...txParams });
                        await votingContract.methods.stake(0, 1, false).send({ ...txParams });

                        // Retrieve the confidence factor.
                        const confidence = await votingContract.methods.getConfidence(0).call();
                        expect(confidence).toBe(`${3 * 10 ** 16}`);

                        // Boost the proposal.
                        expect(await reverts(
                            votingContract.methods.boostProposal(0).send({ ...txParams }),
                            `VOTING_ERROR_PROPOSAL_DOESNT_HAVE_ENOUGH_CONFIDENCE`
                        )).toBe(true);
                        const proposal = await votingContract.methods.getProposal(0).call();
                        expect(proposal.boosted).toBe(false);
                    });
                });
            });
        });
    });
});
