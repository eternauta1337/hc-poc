pragma solidity ^0.5.0;

import "./SafeMath.sol";

contract Proposals {
    using SafeMath for uint256;
    
    // Votes.
    enum Vote { Absent, Yea, Nay }

    // Store proposals in a mapping, by numeric id.
    mapping (uint256 => Proposal) internal proposals;
    uint256 public numProposals;

    // Proposal times.
    uint256 public proposalLifeTime;

    // Error messages.
    string internal constant ERROR_PROPOSAL_DOES_NOT_EXIST = "VOTING_ERROR_PROPOSAL_DOES_NOT_EXIST";
    string internal constant ERROR_PROPOSAL_IS_CLOSED      = "VOTING_ERROR_PROPOSAL_IS_CLOSED";

    // Proposals.
    struct Proposal {
        bool finalized;
        uint256 startDate;
        uint256 yea;
        uint256 nay;
        mapping (address => Vote) votes;
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

    /*
     * Internal functions.
     */

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
