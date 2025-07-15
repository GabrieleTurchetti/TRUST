// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "hardhat/console.sol";

library GraphLib {
    struct Node {
        address addr;
        int balance;
    }

    struct Edge {
        address source;
        address destination;
        uint weight;
        bool exists;
    }

    struct Graph {
        address[] nodeAddresses;
        mapping(address => Node) nodes;
        mapping(address => mapping(address => Edge)) edges;
    }

    function addEdge(Graph storage graph, address source, address destination, uint weight) internal {
        Edge storage edge = graph.edges[source][destination];
        edge.source = graph.nodes[source].addr;
        edge.destination = graph.nodes[destination].addr;
        edge.weight = weight;
        edge.exists = true;
        graph.nodes[source].balance -= int(weight);
        graph.nodes[destination].balance += int(weight);
    }

    function simplifyGraph(Graph storage graph) internal {
        int[] memory balances = new int[](graph.nodeAddresses.length);
        uint indexMin = 0;
        uint indexMax = 0;
        bool areAllZeros;

        for (uint i = 0; i < graph.nodeAddresses.length; i++) {
            balances[i] = graph.nodes[graph.nodeAddresses[i]].balance;

            for (uint j = 0; j < graph.nodeAddresses.length; j++) {
                delete graph.edges[graph.nodeAddresses[i]][graph.nodeAddresses[j]];
            }
        }


        for (uint i = 0; i < graph.nodeAddresses.length; i++) {
            areAllZeros = true;

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

            if (areAllZeros) {
                break;
            }
            
            uint weight = uint(-balances[indexMin] < balances[indexMax] ? -balances[indexMin] : balances[indexMax]);
            balances[indexMin] += int(weight);
            balances[indexMax] -= int(weight);
            Edge storage edge = graph.edges[graph.nodeAddresses[indexMin]][graph.nodeAddresses[indexMax]];
            edge.source = graph.nodeAddresses[indexMin];
            edge.destination = graph.nodeAddresses[indexMax];
            edge.weight = weight;
            edge.exists = true;
        }
    }
}