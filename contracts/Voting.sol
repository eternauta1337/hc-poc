pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Token.sol";

contract Voting {
    using SafeMath for uint256;

    // Token used for voting.
    Token public voteToken;

    // Store proposals in a mapping, by numeric id.
    mapping (uint256 => Proposal) internal proposals;
    uint256 public numProposals;

    // Proposal times.
    uint256 public proposalLifeTime;

    // Vote state.
    // TODO: Rename to VoteState.
    enum Vote { Absent, Yea, Nay }

    // Proposals.
    struct Proposal {
        bool finalized;
        bool boosted;
        uint256 startDate;
        uint256 yea;
        uint256 nay;
        uint256 upstake;
        uint256 downstake;
        mapping (address => Vote) votes;
        mapping (address => uint256) upstakes;
        mapping (address => uint256) downstakes;
    }

    function getProposal(uint256 _proposalId) public view returns (
        bool finalized,
        bool boosted,
        uint256 startDate,
        uint256 yea,
        uint256 nay,
        uint256 upstake,
        uint256 downstake
    ) {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);

        Proposal storage proposal_ = proposals[_proposalId];
        finalized = proposal_.finalized;
        boosted = proposal_.boosted;
        startDate = proposal_.startDate;
        yea = proposal_.yea;
        nay = proposal_.nay;
        upstake = proposal_.upstake;
        downstake = proposal_.downstake;
    }

    // Vote percentages.
    // Percentages are represented as a uint256 between 0 and 10^18 (or xx * 10^16),
    // i.e. 0% = 0; 1% = 1 * 10^16; 50% = 50 * 10^16; 100% = 100 * 10^18.
    uint256 internal constant PCT_MULTIPLIER = 10 ** 16;
    uint256 public supportPct; // Percentage required for a vote to pass with absolute majority, e.g. 50%.

    // Error messages.
    string internal constant ERROR_PROPOSAL_DOES_NOT_EXIST = "VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST";
    string internal constant ERROR_PROPOSAL_IS_CLOSED      = "VOTING_ERROR_PROPOSAL_IS_CLOSED";
    string internal constant ERROR_INIT_SUPPORT_TOO_SMALL      = "VOTING_ERROR_INIT_SUPPORT_TOO_SMALL";
    string internal constant ERROR_INIT_SUPPORT_TOO_BIG        = "VOTING_ERROR_INIT_SUPPORT_TOO_BIG";
    string internal constant ERROR_USER_HAS_NO_VOTING_POWER    = "VOTING_ERROR_USER_HAS_NO_VOTING_POWER";
    string internal constant ERROR_NOT_ENOUGH_ABSOLUTE_SUPPORT = "VOTING_NOT_ENOUGH_ABSOLUTE_SUPPORT";
    string internal constant ERROR_NOT_ENOUGH_RELATIVE_SUPPORT = "VOTING_ERROR_NOT_ENOUGH_RELATIVE_SUPPORT";

    // Events.
    event StartProposal(uint256 indexed _proposalId, address indexed _creator, string _metadata);
    event CastVote(uint256 indexed _proposalId, address indexed voter, bool _supports, uint256 _stake);
    event FinalizeProposal(uint256 indexed _proposalId);
  
    /*
     * External functions.
     */

    // TODO: Guard for only once calling.
    function initializeVoting(
        address _voteToken, 
        uint256 _supportPct,
        uint256 _proposalLifeTime
    ) 
        public
    {
        // TODO: Need to cast here or can have param type directly?
        voteToken = Token(_voteToken);

        // Validate and assign percentages.
        require(_supportPct >= 50, ERROR_INIT_SUPPORT_TOO_SMALL);
        require(_supportPct < 100, ERROR_INIT_SUPPORT_TOO_BIG);
        supportPct = _supportPct;

        // Assign vote time.
        // TODO: Require a min absolute majority vote time?
        proposalLifeTime = _proposalLifeTime;
    }


    function createProposal(string memory _metadata) public returns (uint256 proposalId) {
        proposalId = numProposals;
        numProposals++;

        Proposal storage proposal_ = proposals[proposalId];
        proposal_.startDate = now;

        emit StartProposal(proposalId, msg.sender, _metadata);
    }

    function getVote(uint256 _proposalId, address _voter) public view returns (Vote) {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        Proposal storage proposal_ = proposals[_proposalId];
        return proposal_.votes[_voter];
    }

    // TODO: Guard on who can vote?
    function vote(uint256 _proposalId, bool _supports) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);
        require(_userHasVotingPower(msg.sender), ERROR_USER_HAS_NO_VOTING_POWER);

        Proposal storage proposal_ = proposals[_proposalId];

        // Get the user's voting power.
        uint256 votingPower = voteToken.balanceOf(msg.sender);

        // Has the user previously voted?
        Vote previousVote = proposal_.votes[msg.sender];

        // TODO: Can be optimized, but be careful.
        // Clean up the user's previous vote, if existent.
        if(previousVote == Vote.Yea) {
            proposal_.yea = proposal_.yea.sub(votingPower);
        }
        else if(previousVote == Vote.Nay) {
            proposal_.nay = proposal_.nay.sub(votingPower);
        }

        // Update the user's vote in the proposal's yea/nay count.
        if(_supports) {
            proposal_.yea = proposal_.yea.add(votingPower);
        }
        else {
            proposal_.nay = proposal_.nay.add(votingPower);
        }

        // Update the user's vote state.
        proposal_.votes[msg.sender] = _supports ? Vote.Yea : Vote.Nay;

        emit CastVote(_proposalId,msg.sender, _supports, votingPower);
    }

    function finalizeProposal(uint256 _proposalId) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsNotFinalized(_proposalId), ERROR_PROPOSAL_IS_CLOSED);
        
        Proposal storage proposal_ = proposals[_proposalId];

        // Standard proposal resolution (absolute majority).
        if(proposal_.boosted) {
            _verifyFinalizationWithRelativemajority(proposal_);
        }
        else {
            _verifyFinalizationWithAbsoluteMajority(proposal_);
        }

        // Finalize the proposal.
        proposal_.finalized = true;

        emit FinalizeProposal(_proposalId);
    }

    function _verifyFinalizationWithAbsoluteMajority(Proposal storage proposal_) internal view {
        uint256 yeaPct = _votesToPct(proposal_.yea, voteToken.totalSupply());
        require(yeaPct > supportPct * PCT_MULTIPLIER, ERROR_NOT_ENOUGH_ABSOLUTE_SUPPORT);
    }

    function _verifyFinalizationWithRelativemajority(Proposal storage proposal_) internal view {
        uint256 totalVoted = proposal_.yea.add(proposal_.nay);
        uint256 yeaPct = _votesToPct(proposal_.yea, totalVoted);
        require(yeaPct > supportPct * PCT_MULTIPLIER, ERROR_NOT_ENOUGH_RELATIVE_SUPPORT);
    }

    /*
     * Internal functions.
     */

    // TODO: Make internal!
    function _boostProposal(uint256 _proposalId) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);

        Proposal storage proposal_ = proposals[_proposalId];
        proposal_.boosted = true;
    }

    function _votesToPct(uint256 votes, uint256 totalVotes) internal pure returns (uint256) {
        return votes.mul(100 * PCT_MULTIPLIER) / totalVotes;
    }

    function _userHasVotingPower(address _voter) internal view returns (bool) {
        return voteToken.balanceOf(_voter) > 0;
    }

    function _proposalExists(uint256 _proposalId) internal view returns (bool) {
        return _proposalId < numProposals;
    }

    function _proposalIsOpen(uint256 _proposalId) internal view returns (bool) {
        return 
            _proposalIsNotFinalized(_proposalId) && 
            _proposalIsNotExpired(_proposalId);
    }

    function _proposalIsNotFinalized(uint256 _proposalId) internal view returns (bool) {
        Proposal storage proposal_ = proposals[_proposalId];
        return !proposal_.finalized;
    }

    function _proposalIsNotExpired(uint256 _proposalId) internal view returns (bool) {
        Proposal storage proposal_ = proposals[_proposalId];
        return now < proposal_.startDate.add(proposalLifeTime);
    }
}
