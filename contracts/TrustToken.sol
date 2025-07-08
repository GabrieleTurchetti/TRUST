// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TrustToken is ERC20 {
    uint public RATE = 1000;

    constructor() ERC20("TrustToken", "TRST") {}

    function mint() external payable {
        require(msg.value > 0, "You must provide ETH to mint tokens");
        uint tokens = msg.value * RATE;
        _mint(msg.sender, tokens);
    }
}