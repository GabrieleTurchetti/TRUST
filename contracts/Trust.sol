// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "hardhat/console.sol";
import "./libraries/GraphLib.sol";
import "./TrustToken.sol";

contract Trust {
    using GraphLib for GraphLib.Graph;

    struct Member {
        bool exists;
    }

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
        mapping(address => Member) members;
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
        Group storage group = groups[name];
        require(!group.exists, "Group already exists");
        group.name = name;
        group.exists = true;

        for (uint i = 0; i < members.length; i++) {
            group.members[members[i]].exists = true;
            group.graph.nodeAddresses.push(members[i]);
        }
    }

    function joinGroup(string calldata groupName) external {
        Group storage group = groups[groupName];
        require(group.exists, "Group does not exists");
        require(!group.members[msg.sender].exists, "Member already joined");
        group.members[msg.sender].exists = true;
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
        Group storage group = groups[groupName];
        require(debtors.length > 0, "Debtor list must be not empty");
        require(amount > 0, "Expense amount must be greater than 0");
        require(date <= block.timestamp, "Specified date must be before current date");
        require(splitMethod >= 0 && splitMethod <= 3, "Split method not found");
        require(group.members[payer].exists, "The payer does not exists");
        Expense storage expense = group.expenses.push();
        expense.amount = amount;
        expense.description = description;
        expense.date = date;
        expense.payer = payer;
        expense.splitMethod = splitMethod;

        for (uint i = 0; i < debtors.length; i++) {
            require(group.members[debtors[i]].exists, "A debtor does not exists");
        }

        if (splitMethod == 0) { // Equal split
            uint quotient = amount / debtors.length ;
            uint rest = amount % debtors.length;
            
            for (uint i = 0; i < debtors.length; i++) {
                expense.split[debtors[i]] = quotient;
            }

            for (uint i = 0; i < rest; i++) {
                expense.split[debtors[i % debtors.length]] += 1;
            }
        } else if (splitMethod == 1) { // Split by amount
            require(debtors.length == split.length, "For this split method the debtor list and the split list must have the same length");
            uint total = 0;

            for (uint i = 0; i < split.length; i++) {
                total += split[i];
            }

            require(total == amount, "Invalid split");

            for (uint i = 0; i < debtors.length; i++) {
                expense.split[debtors[i % debtors.length]] = split[i];
            }
        } else if (splitMethod == 2) { // Split by percentage
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
            group.graph.addEdge(debtors[i], payer, expense.split[debtors[i]]);
        }

        group.graph.simplifyGraph();
    }

    function settleDebt(string calldata groupName, address receiver, uint amount) external {
        Group storage group = groups[groupName];
        require(group.graph.edges[msg.sender][receiver].exists, "Debt does not exists");
        uint debt = group.graph.edges[msg.sender][receiver].weight;
        amount = debt < amount ? debt : amount;
        
        try token.transferFrom(msg.sender, receiver, amount){
            group.graph.nodes[msg.sender].balance += int(amount);
            group.graph.nodes[receiver].balance -= int(amount);

            if (amount == debt) {
                delete group.graph.edges[msg.sender][receiver];
                return;
            }

            group.graph.edges[msg.sender][receiver].weight = debt - amount;
        } catch {
            revert("Tokens transfer failed");
        }
    }
}
