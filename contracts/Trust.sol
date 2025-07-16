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

    struct Expense {
        uint amount;                    // Total amount of the expense
        string description;             // Description of the expense
        uint date;                      // Date of the expense (timestamp)
        address payer;                  // Address of who paid
        uint splitMethod;               // Split method (0 = equal, 1 = by amount, 2 = by percentage)
        mapping(address => uint) split; // Mapping indicating how much each debtor owes
    }

    struct Group {
        string name;                        // Group name
        mapping(address => Member) members; // Mapping of group members
        Expense[] expenses;                 // Array of group expenses
        GraphLib.Graph graph;               // Graph to manage debts
        bool exists;                        // Indicates if the group exists
    }

    mapping(string => Group) private groups; // Mapping of groups identified by name
    TrustToken public token; // Reference to the token used for payments

    event GroupCreated(
        string indexed groupName,
        address indexed creator,
        address[] members
    );

    event MemberJoined(
        string indexed groupName,
        address indexed member
    );

    event ExpenseAdded(
        string indexed groupName,
        uint indexed expenseId,
        uint amount,
        string description,
        address indexed payer,
        uint splitMethod,
        address[] debtors
    );

    event DebtSettled(
        string indexed groupName,
        address indexed debtor,
        address indexed creditor,
        uint amount,
        uint remainingDebt
    );

    constructor(address tokenAddress) {
        token = TrustToken(tokenAddress);
    }

    function createGroup(string calldata name, address[] calldata members) external {
        Group storage group = groups[name];
        require(!group.exists, "Group already exist");

        group.name = name;
        group.exists = true;

        // Add all initial members to the group
        for (uint i = 0; i < members.length; i++) {
            group.members[members[i]].exists = true;
            group.graph.nodeAddresses.push(members[i]);
        }

        emit GroupCreated(name, msg.sender, members);
    }

    function joinGroup(string calldata groupName) external {
        Group storage group = groups[groupName];
        require(group.exists, "Group does not exist");
        require(!group.members[msg.sender].exists, "Member already joined");

        group.members[msg.sender].exists = true;

        emit MemberJoined(groupName, msg.sender);
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
        require(group.members[msg.sender].exists, "The sender is not in the group");
        require(debtors.length > 0, "Debtor list must be not empty");
        require(amount > 0, "Expense amount must be greater than 0");
        require(date <= block.timestamp, "Specified date must be before current date");
        require(splitMethod <= 3, "Split method not found");
        require(group.members[payer].exists, "The payer does not exist");
        
        // Create new expense
        Expense storage expense = group.expenses.push();
        expense.amount = amount;
        expense.description = description;
        expense.date = date;
        expense.payer = payer;
        expense.splitMethod = splitMethod;

        // Validate all debtors exist in the group
        for (uint i = 0; i < debtors.length; i++) {
            require(group.members[debtors[i]].exists, "A debtor does not exist");
        }

        // Handle different split methods
        if (splitMethod == 0) { 
            // Equal split: divide amount equally among debtors
            uint quotient = amount / debtors.length;
            uint rest = amount % debtors.length;
            
            // Assign base amount to each debtor
            for (uint i = 0; i < debtors.length; i++) {
                expense.split[debtors[i]] = quotient;
            }

            // Distribute remainder starting from the last debtor
            for (uint i = 0; i < rest; i++) {
                expense.split[debtors[debtors.length - (i % debtors.length) - 1]] += 1;
            }
        } else if (splitMethod == 1) { 
            // Split by amount: each debtor pays a specific amount
            require(debtors.length == split.length, "For this split method the debtor list and the split list must have the same length");
            uint total = 0;

            // Calculate total to validate it matches expense amount
            for (uint i = 0; i < split.length; i++) {
                total += split[i];
            }

            require(total == amount, "Invalid split");

            // Assign specific amounts to each debtor
            for (uint i = 0; i < debtors.length; i++) {
                expense.split[debtors[i]] = split[i];
            }
        } else if (splitMethod == 2) { 
            // Split by percentage: each debtor pays a percentage of the total
            require(debtors.length == split.length, "For this split method the debtor list and the split list must have the same length");
            uint total = 0;

            // Calculate amounts based on percentages
            for (uint i = 0; i < split.length; i++) {
                uint memberAmount = amount * split[i] / 100;
                expense.split[debtors[i]] = memberAmount;
                total += memberAmount;
            }

            uint rest = amount - total;

            // Distribute any remainder due to rounding
            for (uint i = 0; i < rest; i++) {
                expense.split[debtors[debtors.length - (i % debtors.length) - 1]] += 1;
            }
        }

        // Add edges to the debt graph for each debtor
        for (uint i = 0; i < debtors.length; i++) {
            group.graph.addEdge(debtors[i], payer, expense.split[debtors[i]]);
        }

        // Simplify the graph to optimize debt relationships
        group.graph.simplifyGraph();

        emit ExpenseAdded(
            groupName,
            group.expenses.length - 1,
            amount,
            description,
            payer,
            splitMethod,
            debtors
        );
    }

    function settleDebt(string calldata groupName, address receiver, uint amount) external {
        Group storage group = groups[groupName];
        require(group.graph.edges[msg.sender][receiver].exists, "Debt does not exist");
        uint debt = group.graph.edges[msg.sender][receiver].weight;
        amount = debt < amount ? debt : amount; // Cap amount at actual debt
        require(token.balanceOf(msg.sender) >= amount, "Insufficient token balance");
        require(token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");
        
        // Update graph balances
        group.graph.nodes[msg.sender].balance += int(amount);
        group.graph.nodes[receiver].balance -= int(amount);

        uint remainingDebt = 0;

        // Update or remove the debt edge
        if (amount == debt) {
            delete group.graph.edges[msg.sender][receiver];
        } else {
            group.graph.edges[msg.sender][receiver].weight = debt - amount;
            remainingDebt = debt - amount;
        }
        
        // Transfer tokens from debtor to creditor
        token.transferFrom(msg.sender, receiver, amount);

        emit DebtSettled(groupName, msg.sender, receiver, amount, remainingDebt);
    }
}