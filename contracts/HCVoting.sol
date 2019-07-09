pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Token.sol";
import "./Voting.sol";

contract HCVoting is Voting {
    using SafeMath for uint256;

    // Token used for staking on proposals.
    Token public stakeToken;

    // Error messages.
    string internal constant ERROR_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS      = "VOTING_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS";
    string internal constant ERROR_INSUFFICIENT_ALLOWANCE                 = "VOTING_ERROR_INSUFFICIENT_ALLOWANCE";
    string internal constant ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE    = "VOTING_ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE ";
    string internal constant ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE  = "VOTING_ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE ";
    string internal constant ERROR_PROPOSAL_DOESNT_HAVE_ENOUGH_CONFIDENCE = "VOTING_ERROR_PROPOSAL_DOESNT_HAVE_ENOUGH_CONFIDENCE";

    // Confidence multiplier.
    // Confidence = upstake / downstake;
    // To avoid precision issues, the value is mapped to a wider range using a multiplier.
    uint256 CONFIDENCE_MULTIPLIER = 10 ** 16;

    // Confidence threshold.
    // A proposal can be boosted if it's confidence, determined by staking, is above this threshold.
    uint256 CONFIDENCE_THRESHOLD = 4 * CONFIDENCE_MULTIPLIER;

    // Events.
    event UpstakeProposal(uint256 indexed _proposalId, address indexed _staker, uint256 _amount);
    event DownstakeProposal(uint256 indexed _proposalId, address indexed _staker, uint256 _amount);
    event WithdrawUpstake(uint256 indexed _proposalId, address indexed _staker, uint256 _amount);
    event WithdrawDownstake(uint256 indexed _proposalId, address indexed _staker, uint256 _amount);

    // TODO: Guard for only once calling.
    function initializeStaking(Token _stakeToken) public {
        stakeToken = _stakeToken;
    }

    function addUpstakeToProposal(uint256 _proposalId, uint256 _amount) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);
        require(stakeToken.balanceOf(msg.sender) >= _amount, ERROR_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS);
        require(stakeToken.allowance(msg.sender, address(this)) >= _amount, ERROR_INSUFFICIENT_ALLOWANCE);

        Proposal storage proposal_ = proposals[_proposalId];

        // Update the proposal's upstake.
        proposal_.upstake = proposal_.upstake.add(_amount);

        // Update the staker's upstake amount.
        proposal_.upstakes[msg.sender] = proposal_.upstakes[msg.sender].add(_amount);

        // Extract the tokens from the sender and store them in this contract.
        // Note: This assumes that the sender has provided the required allowance to this contract.
        stakeToken.transferFrom(msg.sender, address(this), _amount);

        emit UpstakeProposal(_proposalId, msg.sender, _amount);
    }

    function addDownstakeToProposal(uint256 _proposalId, uint256 _amount) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);
        require(stakeToken.balanceOf(msg.sender) >= _amount, ERROR_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS);
        require(stakeToken.allowance(msg.sender, address(this)) >= _amount, ERROR_INSUFFICIENT_ALLOWANCE);

        Proposal storage proposal_ = proposals[_proposalId];

        // Update the proposal's downstake.
        proposal_.downstake = proposal_.downstake.add(_amount);

        // Update the staker's downstake amount.
        proposal_.downstakes[msg.sender] = proposal_.downstakes[msg.sender].add(_amount);

        // Extract the tokens from the sender and store them in this contract.
        // Note: This assumes that the sender has provided the required allowance to this contract.
        stakeToken.transferFrom(msg.sender, address(this), _amount);

        emit DownstakeProposal(_proposalId, msg.sender, _amount);
    }

    function removeUpstakeFromProposal(uint256 _proposalId, uint256 _amount) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);

        Proposal storage proposal_ = proposals[_proposalId];

        // Verify that the sender holds the required upstake to be removed.
        require(proposal_.upstakes[msg.sender] >= _amount, ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE);
        
        // Verify that the proposal has the required upstake to be removed.
        require(proposal_.upstake >= _amount, ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE);

        // Remove the upstake from the proposal.
        proposal_.upstake = proposal_.upstake.sub(_amount);

        // Remove the upstake from the sender.
        proposal_.upstakes[msg.sender] = proposal_.upstakes[msg.sender].sub(_amount);

        // Return the tokens to the sender.
        stakeToken.transfer(msg.sender, _amount);

        emit WithdrawUpstake(_proposalId, msg.sender, _amount);
    }

    function removeDownstakeFromProposal(uint256 _proposalId, uint256 _amount) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);

        Proposal storage proposal_ = proposals[_proposalId];

        // Verify that the sender holds the required downstake to be removed.
        require(proposal_.downstakes[msg.sender] >= _amount, ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE);
        
        // Verify that the proposal has the required downstake to be removed.
        require(proposal_.downstake >= _amount, ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE);

        // Remove the upstake from the proposal.
        proposal_.downstake = proposal_.downstake.sub(_amount);

        // Remove the upstake from the sender.
        proposal_.downstakes[msg.sender] = proposal_.downstakes[msg.sender].sub(_amount);

        // Return the tokens to the sender.
        stakeToken.transfer(msg.sender, _amount);

        emit WithdrawDownstake(_proposalId, msg.sender, _amount);
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
        _confidence = proposal_.upstake.mul(CONFIDENCE_MULTIPLIER) / proposal_.downstake;
    }

    function boostProposal(uint256 _proposalId) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);

        // Require confidence to be above a certain threshold.
        uint256 confidence = getConfidence(_proposalId);
        require(confidence >= CONFIDENCE_THRESHOLD, ERROR_PROPOSAL_DOESNT_HAVE_ENOUGH_CONFIDENCE);

        // Boost the proposal.
        Proposal storage proposal_ = proposals[_proposalId];
        proposal_.boosted = true;
    }
}
