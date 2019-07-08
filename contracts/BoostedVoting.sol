pragma solidity ^0.5.0;

import "./Voting.sol";

contract BoostedVoting is Voting {
    using SafeMath for uint256;

    bool public allowExternalBoosting;

    // Error messages.
    string internal constant ERROR_EXTERNAL_BOOSTING_IS_NOT_ALLOWED = "VOTING_ERROR_EXTERNAL_BOOSTING_IS_NOT_ALLOWED";
    string internal constant ERROR_NOT_ENOUGH_RELATIVE_SUPPORT = "VOTING_ERROR_NOT_ENOUGH_RELATIVE_SUPPORT";
    
    // TODO: Guard for only once calling.
    function initializeBoosting(bool _allowExternalBoosting) public {
        allowExternalBoosting = _allowExternalBoosting;
    }

    function boostProposal(uint256 _proposalId) public {
        require(msg.sender == address(this) || allowExternalBoosting, ERROR_EXTERNAL_BOOSTING_IS_NOT_ALLOWED);

        Proposal storage proposal_ = proposals[_proposalId];
        proposal_.boosted = true;
    }

    function _finalizeProposal(Proposal storage proposal_) internal {
        if(proposal_.boosted) {

            // Has enough support been reached?
            uint256 totalVoted = proposal_.yea.add(proposal_.nay);
            uint256 yeaPct = _votesToPct(proposal_.yea, totalVoted);
            require(yeaPct > supportPct * PCT_MULTIPLIER, ERROR_NOT_ENOUGH_RELATIVE_SUPPORT);
        }
        else {
            super._finalizeProposal(proposal_);
        }
    }
}
