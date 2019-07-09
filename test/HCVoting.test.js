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
                    votingContract.methods.addUpstakeToProposal(9, 1).send({ ...txParams, from: accounts[0] }),
                    `VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`
                )).toBe(true);
                expect(await reverts(
                    votingContract.methods.addDownstakeToProposal(9, 1).send({ ...txParams, from: accounts[0] }),
                    `VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`
                )).toBe(true);
                expect(await reverts(
                    votingContract.methods.removeUpstakeFromProposal(9, 1).send({ ...txParams, from: accounts[0] }),
                    `VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`
                )).toBe(true);
                expect(await reverts(
                    votingContract.methods.removeDownstakeFromProposal(9, 1).send({ ...txParams, from: accounts[0] }),
                    `VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST`
                )).toBe(true);
            });

            describe('That are still open', () => {

                beforeEach(async () => {

                    // Mint some stake tokens.
                    await stakeTokenContract.methods.mint(accounts[0], 1000).send({ ...txParams });

                    // Increase allowance to the voting contract.
                    await stakeTokenContract.methods.approve(votingContract.options.address, `${10 ** 18}`).send({ ...txParams });
                });
                
                test('Should allow someone to stake on a proposal', async () => {
                    
                    // Stake tokens.
                    const upstakeReceipt = await votingContract.methods.addUpstakeToProposal(0, 10).send({ ...txParams });
                    const downstakeReceipt = await votingContract.methods.addDownstakeToProposal(0, 5).send({ ...txParams });

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
                    await votingContract.methods.addUpstakeToProposal(0, 5).send({ ...txParams });
                    await votingContract.methods.addDownstakeToProposal(0, 5).send({ ...txParams });

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
                    await votingContract.methods.addUpstakeToProposal(0, 10).send({ ...txParams });
                    await votingContract.methods.addDownstakeToProposal(0, 5).send({ ...txParams });
                    
                    // Verify owner stake token balance decrease.
                    let stakerBalance = await stakeTokenContract.methods.balanceOf(accounts[0]).call();
                    expect(stakerBalance).toBe(`985`);

                    // Verify that the voting contract now holds the stake tokens.
                    let votingBalance = await stakeTokenContract.methods.balanceOf(votingContract.options.address).call();
                    expect(votingBalance).toBe(`15`);

                    // Retrieve stake.
                    const unUpstakeReceipt = await votingContract.methods.removeUpstakeFromProposal(0, 10).send({ ...txParams });
                    const unDownstakeReceipt = await votingContract.methods.removeDownstakeFromProposal(0, 5).send({ ...txParams });

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
                        votingContract.methods.removeUpstakeFromProposal(0, 10).send({ ...txParams }),
                        `ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE`
                    )).toBe(true);
                });

                test('Should not allow someone to withdraw tokens that were not staked by the staker', async () => {

                    // Stake tokens from account 0.
                    await votingContract.methods.addUpstakeToProposal(0, 10).send({ ...txParams });

                    // Attempt to unstake tokens from account 1.
                    expect(await reverts(
                        votingContract.methods.removeUpstakeFromProposal(0, 10).send({ ...txParams, from: accounts[1] }),
                        `ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE`
                    )).toBe(true);
                });

                test('Can retrieve a proposals confidence factor', async () => {
                    
                    // Stake tokens.
                    await votingContract.methods.addUpstakeToProposal(0, 10).send({ ...txParams });
                    await votingContract.methods.addDownstakeToProposal(0, 5).send({ ...txParams });

                    // Retrieve the confidence factor.
                    const confidence = await votingContract.methods.getConfidence(0).call();
                    expect(confidence).toBe(`${2 * 10 ** 16}`);
                });

                test.todo('Should not allow a staker to stake more tokens that the staker owns');
                test.todo('Multiple upstakes/downstakes reflect properly on a proposal\'s state');
            });

            describe('That have expired', () => {

                beforeEach(async () => {
                    await util.skipTime(PROPOSAL_LIFETIME_SECS + 1);
                });
                
                test('Should reject staking on proposals that have expired', async () => {
                    expect(await reverts(
                        votingContract.methods.addUpstakeToProposal(0, 10).send({ ...txParams }),
                        `VOTING_ERROR_PROPOSAL_IS_CLOSED`
                    )).toBe(true);
                    expect(await reverts(
                        votingContract.methods.addDownstakeToProposal(0, 10).send({ ...txParams }),
                        `VOTING_ERROR_PROPOSAL_IS_CLOSED`
                    )).toBe(true);
                });

                // TODO: Test finalizing a proposal that expired
            });
        });
    });
});
