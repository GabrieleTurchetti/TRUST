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
            GraphLib.Node storage node = group.graph.nodesMap[members[i]];
            group.graph.nodesList.push(node);
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
        address[] calldata debtors,
        uint[] calldata split
    ) external {
        require(debtors.length > 0, "Debtor list must be not empty");
        require(amount > 0, "Expense amount must be greater than 0");
        require(date < block.timestamp, "Date must be before current date");
        require(splitMethod >= 0 && splitMethod <= 3, "Split method not found");
        Expense storage expense = groups[groupName].expenses.push();
        expense.amount = amount;
        expense.description = description;
        expense.date = date;
        expense.payer = payer;
        expense.splitMethod = splitMethod;

        if (splitMethod == 0) {
            uint quotient = amount / debtors.length ;
            uint rest = amount % debtors.length;
            
            for (uint i = 0; i < debtors.length; i++) {
                expense.split[debtors[i]] = quotient;
            }

            for (uint i = 0; i < rest; i++) {
                expense.split[debtors[i % debtors.length]] += 1;
            }
        } else if (splitMethod == 1) {
            require(debtors.length == split.length, "For this split method the debtor list and the split list must have the same length");
            uint total = 0;

            for (uint i = 0; i < split.length; i++) {
                total += split[i];
            }

            require(total == amount, "Invalid split");

            for (uint i = 0; i < debtors.length; i++) {
                expense.split[debtors[i % debtors.length]] = split[i];
            }
        } else if (splitMethod == 2) {
            require(debtors.length == split.length, "For this split method the debtor list and the split list must have the same length");
            uint total = 0;

            for (uint i = 0; i < split.length; i++) {
                uint memberAmount = amount * split[i] / 100;
                expense.split[debtors[i]] = memberAmount;
                total += memberAmount;
            }

            uint rest = amount - total;
            uint j = 0;

            while (rest > j) {
                expense.split[debtors[j % debtors.length]] += 1;
                j++;
            }
        }

        for (uint i = 0; i < debtors.length; i++) {
            groups[groupName].graph.addEdge(debtors[i], payer, expense.split[debtors[i]]);
        }

        groups[groupName].graph.simplifyGraph();
    }

    function settleDebt(string calldata groupName, address receiver, uint amount) external {
        require(groups[groupName].graph.edgesMap[msg.sender][receiver].exists, "Debt does not exists");
        uint debt = groups[groupName].graph.edgesMap[msg.sender][receiver].weight;
        amount = debt < amount ? debt : amount;
        require(token.transferFrom(msg.sender, receiver, amount), "Token transfer failed");
        groups[groupName].graph.increaseNodeBalance(msg.sender, amount);
        groups[groupName].graph.decreaseNodeBalance(receiver, amount);

        if (amount == debt) {
            groups[groupName].graph.removeEdge(msg.sender, receiver);
            return;
        }

        groups[groupName].graph.updateEdge(msg.sender, receiver, debt - amount);
    }

    function getBalance(string calldata groupName) external view returns (int) {
        return groups[groupName].graph.nodesMap[msg.sender].balance;
    }
}
