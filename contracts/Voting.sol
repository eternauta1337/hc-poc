pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Token.sol";

contract Voting {
    using SafeMath for uint256;

    Token public voteToken; // Token used for actual voting.

    // Vote percentages.
    // Percentages are represented as a uint256 between 0 and 10^18 (or xx * 10^16),
    // i.e. 0% = 0; 1% = 1 * 10^16; 50% = 50 * 10^16; 100% = 100 * 10^18.
    uint256 public absMajoritySupportPct; // Percentage required for a vote to pass with absolute majority, e.g. 50%.
    uint256 public constant PCT_MIN = 50  * (10 ** 16); 
    uint256 public constant PCT_MAX = 100 * (10 ** 16); 

    // Vote times.
    uint256 public proposalLifeTime;

    // Votes.
    enum Vote { Absent, Yea, Nay }
    struct Proposal {
        bool finalized;
        uint256 startDate;
        uint256 yea;
        uint256 nay;
        mapping (address => Vote) votes;
    }
    mapping (uint256 => Proposal) internal proposals;
    uint256 public numProposals;

    // Error messages.
    string private constant ERROR_INIT_SUPPORT_TOO_SMALL      = "VOTING_ERROR_INIT_SUPPORT_TOO_SMALL";
    string private constant ERROR_INIT_SUPPORT_TOO_BIG        = "VOTING_ERROR_INIT_SUPPORT_TOO_BIG";
    string private constant ERROR_USER_HAS_NO_VOTING_POWER    = "VOTING_ERROR_USER_HAS_NO_VOTING_POWER";
    string private constant ERROR_PROPOSAL_DOES_NOT_EXIST     = "VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST";
    string private constant ERROR_PROPOSAL_IS_CLOSED          = "VOTING_ERROR_PROPOSAL_IS_CLOSED";
    string private constant ERROR_NOT_ENOUGH_ABSOLUTE_SUPPORT = "VOTING_NOT_ENOUGH_ABSOLUTE_SUPPORT";

    // Events.
    event StartProposal(uint256 indexed _proposalId, address indexed _creator, string _metadata);
    event CastVote(uint256 indexed _proposalId, address indexed voter, bool _supports, uint256 _stake);
    event FinalizeProposal(uint256 indexed _proposalId);
  
    // Constructor (Could be replaced by an initializer).
    constructor(
        address _voteToken, 
        uint256 _absMajoritySupportPct,
        uint256 _proposalLifeTime
    ) 
        public
    {
        voteToken = Token(_voteToken);

        // Validate and assign percentages.
        require(_absMajoritySupportPct >= PCT_MIN, ERROR_INIT_SUPPORT_TOO_SMALL);
        require(_absMajoritySupportPct < PCT_MAX, ERROR_INIT_SUPPORT_TOO_BIG);
        absMajoritySupportPct = _absMajoritySupportPct;

        // Assign vote time.
        // TODO: Require a min absolute majority vote time?
        proposalLifeTime = _proposalLifeTime;
    }

    /*
     * External functions.
     */

    function createProposal(string memory _metadata) public returns (uint256 proposalId) {
        proposalId = numProposals;
        numProposals++;

        Proposal storage proposal_ = proposals[proposalId];
        proposal_.startDate = now;

        emit StartProposal(proposalId, msg.sender, _metadata);
    }

    function getProposal(uint256 _proposalId) public view returns (
        bool finalized,
        uint256 startDate,
        uint256 yea,
        uint256 nay
    ) {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);

        Proposal storage proposal_ = proposals[_proposalId];
        finalized = proposal_.finalized;
        startDate = proposal_.startDate;
        yea = proposal_.yea;
        nay = proposal_.nay;
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

        // Has enough support been reached?
        uint256 yeaPct = _votesToPct(proposal_.yea);
        require(yeaPct > PCT_MIN, ERROR_NOT_ENOUGH_ABSOLUTE_SUPPORT);

        // Finalize the proposal.
        proposal_.finalized = true;

        emit FinalizeProposal(_proposalId);
    }

    /*
     * Internal functions.
     */

    function _votesToPct(uint256 votes) internal view returns (uint256) {
        return votes.mul(PCT_MAX) / voteToken.totalSupply();
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
