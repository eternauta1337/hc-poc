pragma solidity ^0.5.0;

import "./HCStaking.sol";

contract HCResolutions is HCStaking {

    /*
     * External functions.
     */
    
    function resolveBoostedProposal(uint256 _proposalId) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsBoosted(_proposalId), ERROR_PROPOSAL_IS_NOT_BOOSTED);
        require(now >= proposal_.startDate.add(proposal_.lifetime), ERROR_PROPOSAL_IS_STILL_ACTIVE);

        // Compensate the caller.
        uint256 fee = _calculateCompensationFee(_proposalId);
        require(stakeToken.balanceOf(address(this)) >= _fee, ERROR_VOTING_DOES_NOT_HAVE_ENOUGH_FUNDS);
        stakeToken.transfer(msg.sender, _fee);

        // Resolve the proposal.
        Proposal storage proposal_ = proposals[_proposalId];
        _updateProposalState(_proposalId, ProposalState.Resolved);
    }

    function expireNonBoostedProposal(uint256 _proposalId) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsExpired(_proposalId), ERROR_PROPOSAL_IS_CLOSED);
        require(!_proposalIsBoosted, ERROR_PROPOSAL_IS_BOOSTED);

        // Verify that the proposal's lifetime has ended.
        Proposal storage proposal_ = proposals[_proposalId];
        require(now >= proposal_.startDate.add(proposal_.lifetime), ERROR_PROPOSAL_IS_STILL_ACTIVE);

        // Compensate the caller.
        uint256 fee = _calculateCompensationFee(_proposalId);
        require(stakeToken.balanceOf(address(this)) >= _fee, ERROR_VOTING_DOES_NOT_HAVE_ENOUGH_FUNDS);
        stakeToken.transfer(msg.sender, _fee);

        // Update the proposal's state and emit an event.
        _updateProposalState(_proposalId, ProposalState.Expired);
    }

    function boostProposal(uint256 _proposalId) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);

        // Require that the proposal is currently pended.
        Proposal storage proposal_ = proposals[_proposalId];
        require(proposal_.state == ProposalState.Pended);

        // Require that the proposal has had enough confidence for a period of time.
        require(_proposalHasEnoughConfidence(proposal_), ERROR_PROPOSAL_DOESNT_HAVE_ENOUGH_CONFIDENCE);
        require(now >= proposal_.lastPendedDate.add(pendedBoostPeriod), ERROR_PROPOSAL_HASNT_HAD_CONFIDENCE_ENOUGH_TIME);

        // Compensate the caller.
        uint256 fee = _calculateCompensationFee(_proposalId);
        require(stakeToken.balanceOf(address(this)) >= _fee, ERROR_VOTING_DOES_NOT_HAVE_ENOUGH_FUNDS);
        stakeToken.transfer(msg.sender, _fee);

        // Boost the proposal.
        _updateProposalState(_proposalId, ProposalState.Boosted);
        proposal_.lifetime = boostPeriod;
    }

    /*
     * Utility functions.
     */

    function _calculateCompensationFee(_proposalId) internal returns(uint256 _fee) {

        // Require that the proposal has potentially expired.
        Proposal storage proposal_ = proposals[_proposalId];
        require(now >= proposal_.startDate.add(proposal_.lifetime), ERROR_PROPOSAL_IS_STILL_ACTIVE);

        // Calculate fee.
        uint256 timeSinceExpiration = now.sub(proposal_.startDate.add(proposal_.lifetime));
        _fee = timeSinceExpiration / compensationFeePct.mul(proposal_.upstake);
    }
}
