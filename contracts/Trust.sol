// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
import "hardhat/console.sol";

import "./libraries/GraphLib.sol";
import "./TrustToken.sol";

contract Trust {
    using GraphLib for GraphLib.Graph;

    struct SplitMethod {
        uint splitMethod;
        mapping(address => uint) splitting;
    }

    struct Expense {
        uint amount;
        string description;
        uint date;
        address payer;
        uint splitMethod;
        mapping(address => uint) split;
    }

    struct Group {
        string name;
        mapping(address => bool) members;
        Expense[] expenses;
        GraphLib.Graph graph;
        bool exists;
    }

    mapping(string => Group) private groups;
    TrustToken public token;

    constructor(address tokenAddress) {
        token = TrustToken(tokenAddress);
    }

    function createGroup(string calldata name, address[] calldata members) external {
        require(!groups[name].exists, "Group already exists");
        Group storage group = groups[name];
        group.name = name;
        group.exists = true;

        for (uint i = 0; i < members.length; i++) {
            group.members[members[i]] = true;
            GraphLib.Node memory node = GraphLib.Node(members[i], 0);
            group.graph.nodesList.push(node);
            group.graph.nodesMap[members[i]] = node;
        }
    }

    function joinGroup(string calldata groupName) external {
        require(groups[groupName].exists, "Group does not exists");
        require(!groups[groupName].members[msg.sender], "Member already joined");
        groups[groupName].members[msg.sender] = true;
    }

    function addExpense(
        string calldata groupName,
        uint amount,
        string calldata description,
        uint date,
        address payer,
        uint splitMethod,
        address[] calldata members,
        uint[] calldata split
    ) external {
        if (splitMethod == 0) {
            console.log("log", splitMethod);
        }
        require(amount > 0, "Expense amount must be greater than 0");
        require(date < block.timestamp, "Date must be before current date");
        require(splitMethod >= 0 && splitMethod <= 3, "Split method not found");
        require(members.length > 0, "Member list must be not empty");
        Expense storage expense = groups[groupName].expenses.push();
        expense.amount = amount;
        expense.description = description;
        expense.date = date;
        expense.payer = payer;
        expense.splitMethod = splitMethod;

        if (splitMethod == 0) {
            uint quotient = amount / members.length;
            uint rest = amount % members.length;
            
            for (uint i = 0; i < members.length; i++) {
                expense.split[members[i]] = quotient;
            }

            for (uint i = 0; i < rest; i++) {
                expense.split[members[i]] += 1;
            }
        } else if (splitMethod == 1) {
            require(members.length == split.length, "For this split method the members list and the split list must coincide");
            uint total = 0;

            for (uint i = 0; i < split.length; i++) {
                total += split[i];
            }

            require(total == amount, "Invalid split");

            for (uint i = 0; i < members.length; i++) {
                expense.split[members[i]] = split[i];
            }
        } else if (splitMethod == 2) {
            require(members.length == split.length, "For this split method the members list and the split list must coincide");
            uint total = 0;

            for (uint i = 0; i < split.length; i++) {
                uint memberAmount = amount * split[i] / 100;
                expense.split[members[i]] = memberAmount;
                total += memberAmount;
            }

            uint rest = amount - total;
            uint j = 0;

            while (rest > j) {
                expense.split[members[j]] += 1;
                j++;
            }
        }

        for (uint i = 0; i < members.length; i++) {
            console.log(expense.split[members[i]]);
            groups[groupName].graph.addEdge(members[i], payer, expense.split[members[i]]);
        }

        groups[groupName].graph.simplifyGraph();
    }

    function settleDebt(string calldata groupName, address receiver, uint amount) external {
        require(groups[groupName].graph.edgesMap[msg.sender][receiver].exists, "Debt does not exists");
        uint debt = groups[groupName].graph.edgesMap[msg.sender][receiver].weight;
        amount = debt < amount ? debt : amount;
        require(token.transferFrom(msg.sender, receiver, amount), "Token transfer failed");

        if (amount == debt) {
            groups[groupName].graph.removeEdge(msg.sender, receiver);
        }
    }
}
