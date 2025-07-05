// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

library GraphLib {
    struct Node {
        address addr;
        uint balance;
    }

    struct Edge {
        Node source;
        Node destination;
        uint weight;
    }

    struct Graph {
        Node[] nodes;
        Edge[] edges;
        mapping(address => Node) nodesMap;
        mapping(address => Edge[]) outgoingEdges;
    }

    function addEdge(
        Graph storage graph,
        address source,
        address destination,
        uint weight
    ) internal {
        Edge memory edge = graph.edges.push();
        edge.source = graph.nodesMap[source];
        edge.destination = graph.nodesMap[destination];
        edge.weight = weight;
        edge.source.balance -= weight;
        edge.destination.balance += weight;
        graph.outgoingEdges[source].push(edge);
    }

    function simplifyGraph(Graph storage graph) internal {
        int[] memory balances = new int[](graph.nodes.length);
        uint indexMin = 0;
        uint indexMax = 0;

        for (uint i = 0; i < graph.nodes.length; i++) {
            balances[i] = int(graph.nodes[i].balance);

            Edge[] storage outgoingEdges = graph.outgoingEdges[graph.nodes[i].addr];

            for (uint j = 0; j < outgoingEdges.length; j++) {
                outgoingEdges.pop();
            }
        }

        for (uint i = 0; i < graph.edges.length; i++) {
            graph.edges.pop();
        }

        for (uint i = 0; i < graph.nodes.length; i++) {
            for (uint j = 0; j < graph.nodes.length; j++) {
                if (balances[j] < balances[indexMax]) {
                    indexMin = j;
                }

                if (balances[j] > balances[indexMax]) {
                    indexMax = j;
                }
            }

            if (balances[indexMin] == 0 && balances[indexMax] == 0) {
                break;
            }
            
            uint newWeight = uint(-balances[indexMin] < balances[indexMax] ? -balances[indexMin] : balances[indexMax]);
            balances[indexMin] += int(newWeight);
            balances[indexMax] -= int(newWeight);
            Edge memory edge = Edge(graph.nodes[indexMin], graph.nodes[indexMax], newWeight);
            graph.edges.push(edge);
        }
    }
}