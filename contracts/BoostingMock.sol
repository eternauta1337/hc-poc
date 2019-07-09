pragma solidity ^0.5.0;

import "./Voting.sol";

contract BoostingMock is Voting {
    
    // _boostProposal(...) is not supposed to have external visibility.
    // This function simply exposes it for testing purposes.
    // A boosted proposal can be resolved with relative majority.
    function boostProposal(uint256 _proposaId) public {
        _boostProposal(_proposaId);
    }
}
