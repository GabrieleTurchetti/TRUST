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
        Node[] nodesList;
        mapping(address => Node) nodesMap;
        mapping(address => mapping(address => Edge)) edgesMap;
    }

    function addEdge(Graph storage graph, address source, address destination, uint weight) internal {
        Edge storage edge = graph.edgesMap[source][destination];
        edge.source = graph.nodesMap[source].addr;
        edge.destination = graph.nodesMap[destination].addr;
        edge.weight = weight;
        edge.exists = true;
        graph.nodesMap[source].balance -= int(weight);
        graph.nodesMap[destination].balance += int(weight);
    }

    function removeEdge(Graph storage graph, address source, address destination) internal {
        delete graph.edgesMap[source][destination];
    }

    function updateEdge(Graph storage graph, address source, address destination, uint weight) internal {
        graph.edgesMap[source][destination].weight = weight;
    }

    function increaseNodeBalance(Graph storage graph, address addr, uint amount) internal {
        graph.nodesMap[addr].balance += int(amount);
    }

    function decreaseNodeBalance(Graph storage graph, address addr, uint amount) internal {
        graph.nodesMap[addr].balance -= int(amount);
    }

    function simplifyGraph(Graph storage graph) internal {
        int[] memory balances = new int[](graph.nodesList.length);
        uint indexMin = 0;
        uint indexMax = 0;

        for (uint i = 0; i < graph.nodesList.length; i++) {
            balances[i] = int(graph.nodesList[i].balance);
        }

        for (uint i = 0; i < graph.nodesList.length; i++) {
            for (uint j = 0; j < graph.nodesList.length; j++) {
                if (balances[j] < balances[indexMax]) {
                    indexMin = j;
                }

                if (balances[j] > balances[indexMax]) {
                    indexMax = j;
                }

                delete graph.edgesMap[graph.nodesList[i].addr][graph.nodesList[j].addr];
            }

            if (balances[indexMin] == 0 && balances[indexMax] == 0) {
                break;
            }
            
            uint weight = uint(-balances[indexMin] < balances[indexMax] ? -balances[indexMin] : balances[indexMax]);
            balances[indexMin] += int(weight);
            balances[indexMax] -= int(weight);
            Edge memory edge = graph.edgesMap[graph.nodesList[indexMin].addr][graph.nodesList[indexMax].addr];
            edge.source = graph.nodesList[indexMin].addr;
            edge.destination = graph.nodesList[indexMax].addr;
            edge.weight = weight;
            edge.exists = true;
        }
    }
}