// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "hardhat/console.sol";

library GraphLib {
    struct Node {
        address addr; // Address of the node
        int balance; // Net balance: positive = owed money, negative = owes money
    }

    struct Edge {
        address source; // Address of the debtor (who owes money)
        address destination; // Address of the creditor (who is owed money)
        uint weight; // Amount of debt
        bool exists; // Whether this edge exists
    }

    struct Graph {
        address[] nodeAddresses; // Array of all node addresses
        mapping(address => Node) nodes; // Mapping from address to node
        mapping(address => mapping(address => Edge)) edges; // Mapping from source to destination to edge
    }

    function addEdge(Graph storage graph, address source, address destination, uint weight) internal {
        // Create the edge
        Edge storage edge = graph.edges[source][destination];

        // Set edge properties
        edge.source = graph.nodes[source].addr;
        edge.destination = graph.nodes[destination].addr;
        edge.weight = weight;
        edge.exists = true;

        // Update balances
        graph.nodes[source].balance -= int(weight);
        graph.nodes[destination].balance += int(weight);
    }

    function simplifyGraph(Graph storage graph) internal {
        int[] memory balances = new int[](graph.nodeAddresses.length); // Create a working copy of balances
        uint indexMin = 0; // Index of most negative balance (biggest debtor)
        uint indexMax = 0; // Index of most positive balance (biggest creditor)
        bool areAllZeros; // Flag to check if all balances are zero

        // Copy current balances and clear all existing edges
        for (uint i = 0; i < graph.nodeAddresses.length; i++) {
            balances[i] = graph.nodes[graph.nodeAddresses[i]].balance;

            // Remove all existing edges
            for (uint j = 0; j < graph.nodeAddresses.length; j++) {
                if (graph.edges[graph.nodeAddresses[i]][graph.nodeAddresses[j]].exists) {
                    delete graph.edges[graph.nodeAddresses[i]][graph.nodeAddresses[j]];
                }
            }
        }

        // Iteratively create optimal edges until all balances are zero
        for (uint i = 0; i < graph.nodeAddresses.length; i++) {
            areAllZeros = true;

            // Find the most negative and most positive balances
            for (uint j = 0; j < graph.nodeAddresses.length; j++) {
                if (balances[j] < balances[indexMin]) {
                    indexMin = j;
                }

                if (balances[j] > balances[indexMax]) {
                    indexMax = j;
                }

                if (balances[j] != 0) {
                    areAllZeros = false;
                } 
            }

            // If all balances are zero, we're done
            if (areAllZeros) {
                break;
            }

            // Calculate the transaction amount: minimum of absolute values
            uint weight = uint(-balances[indexMin] < balances[indexMax] ? -balances[indexMin] : balances[indexMax]);

            // Update balances
            balances[indexMin] += int(weight);
            balances[indexMax] -= int(weight);

            // Create the optimized edge
            Edge storage edge = graph.edges[graph.nodeAddresses[indexMin]][graph.nodeAddresses[indexMax]];
            edge.source = graph.nodeAddresses[indexMin];
            edge.destination = graph.nodeAddresses[indexMax];
            edge.weight = weight;
            edge.exists = true;
        }
    }
}