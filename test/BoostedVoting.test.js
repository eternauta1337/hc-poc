const getWeb3 = require('../scripts/getWeb3.js');
const deploy = require('../scripts/deploy.js');
const util = require('../scripts/util.js');

describe('BoostedVoting', () => {
    
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

    beforeEach(async () => {
        
        // Deploy Token contract and mint some tokens.
        tokenContract = await deploy('Token', [], txParams);

        // Deploy and initialize BoostedVoting contract.
        votingContract = await deploy('BoostedVoting', [], txParams);
        await votingContract.methods.initializeVoting(
            tokenContract.options.address,
            51,
            5
        ).send({ ...txParams });
        await votingContract.methods.initializeBoosting(
            true // Allows to boost any proposal externally
        ).send({ ...txParams });

        // Mint some vote tokens.
        await tokenContract.methods.mint(accounts[0], 1).send({ ...txParams });
        await tokenContract.methods.mint(accounts[1], 1).send({ ...txParams });
        await tokenContract.methods.mint(accounts[2], 1).send({ ...txParams });
        await tokenContract.methods.mint(accounts[3], 1).send({ ...txParams });
        await tokenContract.methods.mint(accounts[4], 1).send({ ...txParams });
        await tokenContract.methods.mint(accounts[5], 1).send({ ...txParams });
    });

    test('Should allow a boosted proposal to be resolved locally (without absolute majority)', async () => {

        // Create a proposal.
        await votingContract.methods.createProposal('A proposal should be resolvable locally if boosted').send({ ...txParams });
        
        // Create some votes (with no majority).
        await votingContract.methods.vote(0, true).send({ ...txParams, from: accounts[0] });
        await votingContract.methods.vote(0, true).send({ ...txParams, from: accounts[1] });
        await votingContract.methods.vote(0, false).send({ ...txParams, from: accounts[2] });

        // Boost the proposal.
        await votingContract.methods.boostProposal(0).send({ ...txParams });
        await votingContract.methods.getProposal(0).call();

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
