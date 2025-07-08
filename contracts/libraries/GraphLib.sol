// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "hardhat/console.sol";

library GraphLib {
    struct Node {
        address addr;
        int balance;
    }

    struct Edge {
        Node source;
        Node destination;
        uint weight;
        bool exists;
    }

    struct Graph {
        Node[] nodesList;
        Edge[] edgesList;
        mapping(address => Node) nodesMap;
        mapping(address => mapping(address => Edge)) edgesMap;
    }

    function addEdge(Graph storage graph, address source, address destination, uint weight) internal {
        Edge memory edge = graph.edgesList.push();
        edge.source = graph.nodesMap[source];
        edge.destination = graph.nodesMap[destination];
        edge.weight = weight;
        edge.source.balance -= int(weight);
        edge.destination.balance += int(weight);
        graph.edgesMap[source][destination] = edge;
    }

    function removeEdge(Graph storage graph, address source, address destination) internal {
        delete graph.edgesMap[source][destination];
    }

    function updateEdge(Graph storage graph, address source, address destination, uint weight) internal {
        graph.edgesMap[source][destination].weight = weight;
    }

    function simplifyGraph(Graph storage graph) internal {
        int[] memory balances = new int[](graph.nodesList.length);
        uint indexMin = 0;
        uint indexMax = 0;
        console.log("1");
        for (uint i = 0; i < graph.nodesList.length; i++) {
            balances[i] = int(graph.nodesList[i].balance);
        }
        console.log("2");

        for (uint i = 0; i < graph.nodesList.length; i++) {
            console.log("3");
            for (uint j = 0; j < graph.nodesList.length; j++) {
                if (balances[j] < balances[indexMax]) {
                    indexMin = j;
                }

                if (balances[j] > balances[indexMax]) {
                    indexMax = j;
                }
                console.log("4");
                delete graph.edgesMap[graph.nodesList[i].addr][graph.nodesList[j].addr];
            }
            console.log("4.1");
            if (balances[indexMin] == 0 && balances[indexMax] == 0) {
                console.log("ciao:", balances[indexMin] == 0);
                break;
            }
            console.log("5");
            
            uint newWeight = uint(-balances[indexMin] < balances[indexMax] ? -balances[indexMin] : balances[indexMax]);
            balances[indexMin] += int(newWeight);
            balances[indexMax] -= int(newWeight);
            Edge memory edge = Edge(graph.nodesList[indexMin], graph.nodesList[indexMax], newWeight, true);
            graph.edgesMap[graph.nodesList[indexMin].addr][graph.nodesList[indexMax].addr] = edge;
        }
    }
}