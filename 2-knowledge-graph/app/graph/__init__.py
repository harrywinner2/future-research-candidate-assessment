"""Graph layer — ontology, client protocol, and backends."""

from app.graph.client import GraphClient, Edge, Node
from app.graph.memory_client import InMemoryGraphClient
from app.graph.schema import (
    SCHEMA_VERSION,
    EdgeType,
    NodeType,
    edge_catalogue,
    node_catalogue,
)

__all__ = [
    "Edge",
    "EdgeType",
    "GraphClient",
    "InMemoryGraphClient",
    "Node",
    "NodeType",
    "SCHEMA_VERSION",
    "edge_catalogue",
    "node_catalogue",
]
