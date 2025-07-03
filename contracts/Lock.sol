// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract Lock {
    struct SplitMethod {
        uint splitMethod;
        mapping(address => uint) splitting;
    }

    struct Node {
        string name;
    }

    struct Edge {
        Node source;
        Node destination;
        uint weight;
    }

    struct Graph {
        Node[] nodes;
        Edge[] edges;
    }

    struct Group {
        string name;
        mapping(address => bool) members;
        Graph graph;
        bool exists;
    }

    uint public unlockTime;
    address payable public owner;

    mapping (string => Group) public groups;

    event Withdrawal(uint amount, uint when);

    constructor(uint _unlockTime) payable {
        require(
            block.timestamp < _unlockTime,
            "Unlock time should be in the future"
        );

        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        // Uncomment this line, and the import of "hardhat/console.sol", to print a log in your terminal
        console.log("Unlock time is %o and block timestamp is %o", unlockTime, block.timestamp);

        require(block.timestamp >= unlockTime, "You can't withdraw yet");
        require(msg.sender == owner, "You aren't the owner");

        emit Withdrawal(address(this).balance, block.timestamp);

        owner.transfer(address(this).balance);
    }

    function createGroup(string calldata _name, address[] calldata _members) external {
        require(!groups[_name].exists, "Group already exists");
        Group storage group = groups[_name];
        group.name = _name;
        group.exists = true;

        for (uint i = 0; i < _members.length; i++) {
            group.members[_members[i]] = true;
        }
    }

    function joinGroup(string calldata _name) external {
        require(groups[_name].exists, "Group does not exists");
        require(!groups[_name].members[msg.sender], "Member already joined");
        groups[_name].members[msg.sender] = true;
    }

    function addExpense(
        uint amount,
        string calldata description,
        uint date,
        address payer,
        uint splitMethod,
        address[] calldata members,
        uint[] calldata amounts
    ) external {

    }
}
