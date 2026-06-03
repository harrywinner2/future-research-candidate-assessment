"""Graph client Protocol — the abstraction every backend implements."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Protocol, Tuple

from pydantic import BaseModel, Field

from app.graph.schema import EdgeType, NodeType


class Node(BaseModel):
    """A graph node with its labels and properties.

    ``key`` is a stable cross-backend identifier; for nodes that have an
    application id (Member, Exercise, Injury, …) ``key`` equals ``id``. For
    value-typed nodes (Joint, MuscleGroup, MovementPattern, Equipment) we use
    the canonical name.
    """

    type: NodeType
    key: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class Edge(BaseModel):
    type: EdgeType
    source_type: NodeType
    source_key: str
    target_type: NodeType
    target_key: str
    properties: Dict[str, Any] = Field(default_factory=dict)


class GraphClient(Protocol):
    """All graph backends implement this interface.

    The interface is intentionally small. Anything that does not fit (custom
    Cypher, vector queries) goes through ``run_query``.
    """

    async def initialize(self) -> None: ...
    async def close(self) -> None: ...
    async def healthcheck(self) -> bool: ...

    async def upsert_node(self, node: Node) -> Node: ...
    async def get_node(self, node_type: NodeType, key: str) -> Optional[Node]: ...
    async def find_nodes(
        self, node_type: NodeType, where: Optional[Dict[str, Any]] = None, limit: int = 100
    ) -> List[Node]: ...
    async def delete_node(self, node_type: NodeType, key: str) -> bool: ...

    async def upsert_edge(self, edge: Edge) -> Edge: ...
    async def get_edges(
        self,
        source_type: Optional[NodeType] = None,
        source_key: Optional[str] = None,
        edge_type: Optional[EdgeType] = None,
        target_type: Optional[NodeType] = None,
        target_key: Optional[str] = None,
    ) -> List[Edge]: ...
    async def delete_edges(
        self,
        source_type: Optional[NodeType] = None,
        source_key: Optional[str] = None,
        edge_type: Optional[EdgeType] = None,
        target_type: Optional[NodeType] = None,
        target_key: Optional[str] = None,
    ) -> int: ...

    async def neighborhood(
        self,
        node_type: NodeType,
        key: str,
        depth: int = 2,
        edge_types: Optional[List[EdgeType]] = None,
    ) -> Tuple[List[Node], List[Edge]]: ...

    async def reset(self) -> None:
        """Drop all data. Used by tests and the seed script."""
