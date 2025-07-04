// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract Lock {
    struct SplitMethod {
        uint splitMethod;
        mapping(address => uint) splitting;
    }

    struct Edge {
        address source;
        address destination;
        uint weight;
    }

    struct Graph {
        Edge[] edges;
        mapping(address => Edge[]) outgoingEdges;
        mapping(address => Edge[]) incomingEdges;
    }

    struct Expense {
        uint amount;
        string description;
        uint date;
        address payer;
        uint8 splitMethod;
        mapping(address => uint) split;
    }

    struct Group {
        string name;
        mapping(address => bool) members;
        Expense[] expenses;
        Graph graph;
        bool exists;
    }

    uint public unlockTime;
    address payable public owner;

    mapping(string => Group) private groups;

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

    function joinGroup(string calldata _groupName) external {
        require(groups[_groupName].exists, "Group does not exists");
        require(!groups[_groupName].members[msg.sender], "Member already joined");
        groups[_groupName].members[msg.sender] = true;
    }

    function addExpense(
        string calldata _groupName,
        uint _amount,
        string calldata _description,
        uint _date,
        address _payer,
        uint8 _splitMethod,
        address[] calldata _members,
        uint[] calldata _split
    ) external {
        require(_amount > 0, "Expense amount must be greater than 0");
        require(_date < block.timestamp, "Date must be before current date");
        require(_splitMethod >= 0 && _splitMethod <= 3, "Split method not found");
        require(_members.length > 0, "Member list must be not empty");
        require(_split.length > 0, "Split lilst must be not empty");
        
        if (_splitMethod != 0) {
        }

        Expense storage expense = groups[_groupName].expenses.push();
        expense.amount = _amount;
        expense.description = _description;
        expense.date = _date;
        expense.payer = _payer;
        expense.splitMethod = _splitMethod;

        if (_splitMethod == 0) {
            uint256 quotient = _amount / _members.length;
            uint256 rest = _amount % _members.length;
            
            for (uint i = 0; i < _members.length; i++) {
                expense.split[_members[i]] = quotient;
            }

            for (uint i = 0; i < rest; i++) {
                expense.split[_members[i]] += 1;
            }
        } else if (_splitMethod == 1) {
            require(_members.length == _split.length, "For this split method the members list and the split list must coincide");
            uint total = 0;

            for (uint i = 0; i < _split.length; i++) {
                total += _split[i];
            }

            require(total == _amount, "Invalid split");

            for (uint i = 0; i < _members.length; i++) {
                expense.split[_members[i]] = _split[i];
            }
        } else if (_splitMethod == 2) {
            require(_members.length == _split.length, "For this split method the members list and the split list must coincide");
            uint total = 0;

            for (uint i = 0; i < _split.length; i++) {
                uint memberAmount = _amount * _split[i] / 100;
                expense.split[_members[i]] = memberAmount;
                total += memberAmount;
            }

            uint rest = _amount - total;
            uint i = 0;

            while (rest > i) {
                expense.split[_members[i]] += 1;
                i++;
            }
        }

        // Update group graph
        for (uint i = 0; i < _members.length; i++) {
            Edge storage edge = groups[_groupName].graph.edges.push();
            edge.source = _members[i];
            edge.destination = _payer;
            edge.weight = expense.split[_members[i]];
            groups[_groupName].graph.outgoingEdges[_members[i]].push(edge);
            groups[_groupName].graph.incomingEdges[_payer].push(edge);
        }
    }
}
