pragma solidity ^0.5.0;

import "./SafeMath.sol";
import "./Token.sol";
import "./Voting.sol";

contract HCVoting is Voting {

    // Token used for staking on proposals.
    Token public stakeToken;

    // Error messages.
    string internal constant ERROR_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS = "VOTING_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS";
    string internal constant  ERROR_INSUFFICIENT_ALLOWANCE = "VOTING_ERROR_INSUFFICIENT_ALLOWANCE";
    string internal constant  ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE = "ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE ";
    string internal constant   ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE = "ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE ";

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
        proposal_.upstake.add(_amount);

        // Update the staker's upstake amount.
        proposal_.upstakers[msg.sender].add(_amount);

        // Extract the tokens from the sender and store them in this contract.
        // Note: This assumes that the sender has provided the required allowance to this contract.
        stakeToken.transferFrom(msg.sender, address(this), _amount);
    }

    function addDownstakeToProposal(uint256 _proposalId, uint256 _amount) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);
        require(stakeToken.balanceOf(msg.sender) >= _amount, ERROR_SENDER_DOES_NOT_HAVE_ENOUGH_FUNDS);
        require(stakeToken.allowance(msg.sender, address(this)) >= _amount, ERROR_INSUFFICIENT_ALLOWANCE);

        Proposal storage proposal_ = proposals[_proposalId];

        // Update the proposal's downstake.
        proposal_.downstake.add(_amount);

        // Update the staker's downstake amount.
        proposal_.downstakers[msg.sender].add(_amount);

        // Extract the tokens from the sender and store them in this contract.
        // Note: This assumes that the sender has provided the required allowance to this contract.
        stakeToken.transferFrom(msg.sender, address(this), _amount);
    }

    function removeUpstakeFromProposal(uint256 _proposalId, uint256 _amount) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);

        Proposal storage proposal_ = proposals[_proposalId];

        // Verify that the sender holds the required upstake to be removed.
        require(proposal_.upstakers[msg.sender] >= _amount, ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE);
        
        // Verify that the proposal has the required upstake to be removed.
        require(proposal_.upstake >= _amount, ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE);

        // Remove the upstake from the proposal.
        proposal_.upstake.sub(_amount);

        // Remove the upstake from the sender.
        proposal_.upstakers[msg.sender].sub(_amount);

        // Return the tokens to the sender.
        stakeToken.transfer(msg.sender, _amount);
    }

    function removeDownstakeFromProposal(uint256 _proposalId, uint256 _amount) public {
        require(_proposalExists(_proposalId), ERROR_PROPOSAL_DOES_NOT_EXIST);
        require(_proposalIsOpen(_proposalId), ERROR_PROPOSAL_IS_CLOSED);

        Proposal storage proposal_ = proposals[_proposalId];

        // Verify that the sender holds the required downstake to be removed.
        require(proposal_.downstakers[msg.sender] >= _amount, ERROR_SENDER_DOES_NOT_HAVE_REQUIRED_STAKE);
        
        // Verify that the proposal has the required downstake to be removed.
        require(proposal_.downstake >= _amount, ERROR_PROPOSAL_DOES_NOT_HAVE_REQUIRED_STAKE);

        // Remove the upstake from the proposal.
        proposal_.downstake.sub(_amount);

        // Remove the upstake from the sender.
        proposal_.downstakers[msg.sender].sub(_amount);

        // Return the tokens to the sender.
        stakeToken.transfer(msg.sender, _amount);
    }
}
