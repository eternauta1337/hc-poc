pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Token.sol";
import "./Voting.sol";

contract HCVoting is Voting {
    using SafeMath for uint256;

    // Token used for staking on proposals.
    Token public stakeToken;

    // Error messages.
    string internal constant ERROR_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS         = "VOTING_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS";
    string internal constant ERROR_INSUFFICIENT_ALLOWANCE                    = "VOTING_ERROR_INSUFFICIENT_ALLOWANCE";
    string internal constant ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE       = "VOTING_ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE ";
    string internal constant ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE     = "VOTING_ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE ";
    string internal constant ERROR_PROPOSAL_DOESNT_HAVE_ENOUGH_CONFIDENCE    = "VOTING_ERROR_PROPOSAL_DOESNT_HAVE_ENOUGH_CONFIDENCE";
    string internal constant ERROR_PROPOSAL_IS_NOT_FINALIZED                 = "VOTING_ERROR_PROPOSAL_IS_NOT_FINALIZED";
    string internal constant ERROR_PROPOSAL_IS_NOT_BOOSTED                   = "VOTING_ERROR_PROPOSAL_IS_NOT_BOOSTED";
    string internal constant ERROR_NO_WINNING_STAKE                          = "VOTING_ERROR_NO_WINNING_STAKE";
    string internal constant ERROR_PROPOSAL_HASNT_HAD_CONFIDENCE_ENOUGH_TIME = "VOTING_ERROR_PROPOSAL_HASNT_HAD_CONFIDENCE_ENOUGH_TIME";

    // Confidence threshold.
    // A proposal can be boosted if it's confidence, determined by staking, is above this threshold.
    // TODO: Make dynamic.
    uint256 CONFIDENCE_THRESHOLD = uint256(4).mul(PRECISION_MULTIPLIER);

    // Time for a pended proposal to become boosted if it maintained confidence within such period.
    uint256 public pendedBoostPeriod;

    // Events.
    event UpstakeProposal(uint256 indexed _proposalId, address indexed _staker, uint256 _amount);
    event DownstakeProposal(uint256 indexed _proposalId, address indexed _staker, uint256 _amount);
    event WithdrawUpstake(uint256 indexed _proposalId, address indexed _staker, uint256 _amount);
    event WithdrawDownstake(uint256 indexed _proposalId, address indexed _staker, uint256 _amount);
    // TODO: Add an event for a proposal becoming boosted.

    // TODO: Guard for only once calling.
    function initializeStaking(Token _stakeToken, uint256 _pendedBoostPeriod) public {
        stakeToken = _stakeToken;
        // TODO: Check min pendendBoostPeriod?
        pendedBoostPeriod = _pendedBoostPeriod;
    }

    function stake(uint256 _proposalId, uint256 _amount, bool _supports) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);
        require(!_proposalIsBoosted(_proposalId), ERROR_PROPOSAL_IS_BOOSTED);
        require(stakeToken.balanceOf(msg.sender) >= _amount, ERROR_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS);
        require(stakeToken.allowance(msg.sender, address(this)) >= _amount, ERROR_INSUFFICIENT_ALLOWANCE);

        Proposal storage proposal_ = proposals[_proposalId];

        // Update the proposal's stake.
        if(_supports) proposal_.upstake = proposal_.upstake.add(_amount);
        else proposal_.downstake = proposal_.downstake.add(_amount);

        // Update the staker's stake amount.
        if(_supports) proposal_.upstakes[msg.sender] = proposal_.upstakes[msg.sender].add(_amount);
        else proposal_.downstakes[msg.sender] = proposal_.downstakes[msg.sender].add(_amount);

        // Extract the tokens from the sender and store them in this contract.
        // Note: This assumes that the sender has provided the required allowance to this contract.
        stakeToken.transferFrom(msg.sender, address(this), _amount);

        // Emit corresponding event.
        if(_supports) emit UpstakeProposal(_proposalId, msg.sender, _amount);
        else emit DownstakeProposal(_proposalId, msg.sender, _amount);

        // A stake can change the state of a proposal.
        _updateProposalAfterStaking(proposal_);
    }

    function unstake(uint256 _proposalId, uint256 _amount, bool _supports) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId) || !_proposalIsBoosted(_proposalId), ERROR_PROPOSAL_IS_CLOSED);

        Proposal storage proposal_ = proposals[_proposalId];

        // Verify that the sender holds the required stake to be removed.
        if(_supports) require(proposal_.upstakes[msg.sender] >= _amount, ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE);
        else require(proposal_.downstakes[msg.sender] >= _amount, ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE);
        
        // Verify that the proposal has the required stake to be removed.
        if(_supports) require(proposal_.upstake >= _amount, ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE);
        else require(proposal_.downstake >= _amount, ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE);

        // Remove the stake from the proposal.
        if(_supports) proposal_.upstake = proposal_.upstake.sub(_amount);
        else proposal_.downstake = proposal_.downstake.sub(_amount);

        // Remove the stake from the sender.
        if(_supports) proposal_.upstakes[msg.sender] = proposal_.upstakes[msg.sender].sub(_amount);
        else proposal_.downstakes[msg.sender] = proposal_.downstakes[msg.sender].sub(_amount);

        // Return the tokens to the sender.
        require(stakeToken.balanceOf(address(this)) >= _amount, ERROR_VOTING_DOES_NOT_HAVE_ENOUGH_FUNDS);
        stakeToken.transfer(msg.sender, _amount);

        // Emit corresponding event.
        if(_supports) emit WithdrawUpstake(_proposalId, msg.sender, _amount);
        else emit WithdrawDownstake(_proposalId, msg.sender, _amount);

        // A stake can change the state of a proposal.
        _updateProposalAfterStaking(proposal_);
    }

    function _updateProposalAfterStaking(Proposal storage proposal_) internal {

        // Get current proposal confidence.
        uint256 currentConfidence = proposal_.upstake.mul(PRECISION_MULTIPLIER) / proposal_.downstake;

        // If the proposal has enough confidence and it was in queue or unpended, pend it.
		// If it doesn't, unpend it.
        if(_proposalHasEnoughConfidence(proposal_)) {
            if(proposal_.state == ProposalState.Queued || proposal_.state == ProposalState.Unpended) {
                proposal_.lastPendedDate = now;
                _updateProposalState(_proposalId, ProposalState.Pended);
            }
        }
		else {
			if(proposal_.state == ProposalState.Pended) {
                _updateProposalState(_proposalId, ProposalState.Unpended);
			}
		}
    }

    function _proposalHasEnoughConfidence(Proposal storage proposal_) internal view returns(bool _hasConfidence) {
        uint256 currentConfidence = proposal_.upstake.mul(PRECISION_MULTIPLIER) / proposal_.downstake;
        _hasConfidence = currentConfidence >= CONFIDENCE_THRESHOLD;
    }

    function getUpstake(uint256 _proposalId, address _staker) public view returns (uint256) {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        Proposal storage proposal_ = proposals[_proposalId];
        return proposal_.upstakes[_staker];
    }

    function getDownstake(uint256 _proposalId, address _staker) public view returns (uint256) {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        Proposal storage proposal_ = proposals[_proposalId];
        return proposal_.downstakes[_staker];
    }

    function getConfidence(uint256 _proposalId) public view returns (uint256 _confidence) {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        Proposal storage proposal_ = proposals[_proposalId];
        // TODO: What happens when there is no downstake (division by 0).
        _confidence = proposal_.upstake.mul(PRECISION_MULTIPLIER) / proposal_.downstake;
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

    function withdrawStakeFromExpiredQueuedProposal(uint256 _proposalId) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsFinalized(_proposalId), ERROR_PROPOSAL_IS_NOT_FINALIZED);

        // Require the proposal's state to not be resolved or boosted.
        Proposal storage proposal_ = proposals[_proposalId];
        require(proposal_.state != ProposalState.Resolved);
        require(proposal_.state != ProposalState.Boosted);

        // Calculate the amount of that the user has staked.
        uint256 senderUpstake = proposal_.upstakes[msg.sender];
        uint256 senderDownstake = proposal_.downstakes[msg.sender];
        uint256 senderTotalStake = senderUpstake.add(senderDownstake);
        require(totalStake > 0, ERROR_NO_STAKE_TO_WITHDRAW);

        // Callculate the staker's final payout, by subtracting the
        // expiration call fee proportionally to the amount of stake that the user made.
        uint256 compensationFee = _calculateCompensationFee(_proposalId);
        uint256 totalStake = proposal_.upstake.add(proposal_.downstake);
        uint256 senderTotalStakeRatio = senderTotalStake.mul(PRECISION_MULTIPLIER) / totalStake;
        uint256 senderFeeContribution = senderTotalUpstakeRatio.mul(totalStake) / PRECISION_MULTIPLIER;
        uint256 payout = senderTotalStake.sub(senderFeeContribution);

        // Remove the stake from the proposal.
        proposal_.upstake = proposal_.upstake.sub(upstake);
        proposal_.downstake = proposal_.downstake.sub(downstake);

        // Remove the stake from the sender.
        proposal_.upstakes[msg.sender] = proposal_.upstakes[msg.sender].sub(upstake);
        proposal_.downstakes[msg.sender] = proposal_.downstakes[msg.sender].sub(downstake);

        // Return the tokens to the sender.
        require(stakeToken.balanceOf(address(this)) >= payout, ERROR_VOTING_DOES_NOT_HAVE_ENOUGH_FUNDS);
        stakeToken.transfer(msg.sender, payout);

    }

    function withdrawRewardFromResolvedBoostedProposal(uint256 _proposalId) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsFinalized(_proposalId), ERROR_PROPOSAL_IS_NOT_FINALIZED);
        require(_proposalIsBoosted(_proposalId), ERROR_PROPOSAL_IS_NOT_BOOSTED);

        // Get proposal outcome.
        Proposal storage proposal_ = proposals[_proposalId];
        bool supported = proposal_.yea > proposal_.nay;

        // Retrieve the sender's winning stake.
        uint256 winningStake = supported ? proposal_.upstakes[msg.sender] : proposal_.downstakes[msg.sender];
        require(winningStake > 0, ERROR_NO_WINNING_STAKE);

        // Calculate the sender's reward.
        uint256 compensationFee = _calculateCompensationFee(_proposalId);
        uint256 totalWinningStake = supported ? proposal_.upstake : proposal_.downstake;
        uint256 totalLosingStake = supported ? proposal_.downstake : proposal_.upstake;
        totalLosingStake = totalLosingStake.sub(compensationFee);
        uint256 sendersWinningRatio = winningStake.mul(PRECISION_MULTIPLIER) / totalWinningStake;
        uint256 reward = sendersWinningRatio.mul(totalLosingStake) / PRECISION_MULTIPLIER;
        uint256 total = winningStake.add(reward);

        // Transfer the tokens to the winner.
        require(stakeToken.balanceOf(address(this)) >= total, ERROR_VOTING_DOES_NOT_HAVE_ENOUGH_FUNDS);
        stakeToken.transfer(msg.sender, total);
    }

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
}
