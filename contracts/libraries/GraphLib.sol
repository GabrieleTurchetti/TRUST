// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

library GraphLib {
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

    function addEdge(
        Graph storage graph,
        address source,
        address destination,
        uint weight
    ) internal {
        Edge memory edge = graph.edges.push();
        edge.source = source;
        edge.destination = destination;
        edge.weight = weight;
        graph.outgoingEdges[source].push(edge);
        graph.incomingEdges[destination].push(edge);
    }
}