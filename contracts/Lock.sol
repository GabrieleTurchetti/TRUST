// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract Lock {
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

    function createGroup(
        string calldata _name,
        address[] calldata _members
    ) external {
        require(!groups[_name].exists, "Group already exists");
        
        Node[] memory emptyNodes;
        Edge[] memory emptyEdges;
        
        Graph memory emptyGraph = Graph({
            nodes: emptyNodes,
            edges: emptyEdges
        });
        
        mapping(address => bool) storage membersMap;

        for (uint i = 0; i < _members.lenght; i++) {
            membersMap[_members[i]] = true;
        }

        groups[_name] = Group({
            name: _name,
            members: _members,
            graph: emptyGraph,
            exists: true
        });
    }

    function joinGroup(string calldata _name) external {
        require(groups[_name].exists, "Group does not exists");

        groups[_name].members.push(msg.sender);
    }
}
