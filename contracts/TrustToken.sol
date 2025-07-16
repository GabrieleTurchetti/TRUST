// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TrustToken is ERC20 {
    uint public RATE = 1000;

    event TokensMinted(
        address indexed recipient,
        uint ethAmount,
        uint tokenAmount
    );

    constructor() ERC20("TrustToken", "TRST") {}

    function mint() external payable {
        require(msg.value > 0, "Insufficient ETH");
        
        // Calculate tokens to mint based on ETH sent and current rate
        uint tokens = msg.value * RATE;
        
        // Mint tokens to the sender
        _mint(msg.sender, tokens);
        
        // Emit event for tracking
        emit TokensMinted(msg.sender, msg.value, tokens);
    }
}