"""In-process graph backend.

Fast, deterministic, zero-dependency. Used by tests and by ``COACH_KG_GRAPH_BACKEND=memory``
for offline demos. The Neo4j backend is the production target; behavioural parity
between the two is enforced by ``tests/_graph_contract.py``.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from app.graph.client import Edge, GraphClient, Node
from app.graph.schema import EdgeType, NodeType


def _node_id(node_type: NodeType, key: str) -> str:
    return f"{node_type.value}::{key}"


class InMemoryGraphClient:
    """Dictionary-backed graph. Implements ``GraphClient``."""

    def __init__(self) -> None:
        self._nodes: Dict[str, Node] = {}
        # adjacency: source_node_id -> list of edges
        self._edges_out: Dict[str, List[Edge]] = defaultdict(list)
        self._edges_in: Dict[str, List[Edge]] = defaultdict(list)

    async def initialize(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def healthcheck(self) -> bool:
        return True

    # -- Nodes ----------------------------------------------------------
    async def upsert_node(self, node: Node) -> Node:
        nid = _node_id(node.type, node.key)
        existing = self._nodes.get(nid)
        if existing:
            merged = {**existing.properties, **node.properties}
            self._nodes[nid] = Node(type=node.type, key=node.key, properties=merged)
        else:
            self._nodes[nid] = node.model_copy(deep=True)
        return self._nodes[nid]

    async def get_node(self, node_type: NodeType, key: str) -> Optional[Node]:
        return self._nodes.get(_node_id(node_type, key))

    async def find_nodes(
        self, node_type: NodeType, where: Optional[Dict[str, Any]] = None, limit: int = 100
    ) -> List[Node]:
        out: List[Node] = []
        for node in self._nodes.values():
            if node.type != node_type:
                continue
            if where:
                if not all(node.properties.get(k) == v for k, v in where.items()):
                    continue
            out.append(node)
            if len(out) >= limit:
                break
        return out

    async def delete_node(self, node_type: NodeType, key: str) -> bool:
        nid = _node_id(node_type, key)
        if nid not in self._nodes:
            return False
        del self._nodes[nid]
        # remove incident edges from both indexes
        for edge in self._edges_out.pop(nid, []):
            target_nid = _node_id(edge.target_type, edge.target_key)
            self._edges_in[target_nid] = [
                e for e in self._edges_in[target_nid] if not _same_edge(e, edge)
            ]
        for edge in self._edges_in.pop(nid, []):
            source_nid = _node_id(edge.source_type, edge.source_key)
            self._edges_out[source_nid] = [
                e for e in self._edges_out[source_nid] if not _same_edge(e, edge)
            ]
        return True

    # -- Edges ----------------------------------------------------------
    async def upsert_edge(self, edge: Edge) -> Edge:
        source_nid = _node_id(edge.source_type, edge.source_key)
        target_nid = _node_id(edge.target_type, edge.target_key)
        # Drop existing matching edge (same source/target/type), then append the new one.
        self._edges_out[source_nid] = [
            e for e in self._edges_out[source_nid] if not _same_edge(e, edge)
        ]
        self._edges_in[target_nid] = [
            e for e in self._edges_in[target_nid] if not _same_edge(e, edge)
        ]
        self._edges_out[source_nid].append(edge)
        self._edges_in[target_nid].append(edge)
        return edge

    async def get_edges(
        self,
        source_type: Optional[NodeType] = None,
        source_key: Optional[str] = None,
        edge_type: Optional[EdgeType] = None,
        target_type: Optional[NodeType] = None,
        target_key: Optional[str] = None,
    ) -> List[Edge]:
        candidates: List[Edge] = []
        if source_type and source_key:
            candidates = list(self._edges_out.get(_node_id(source_type, source_key), []))
        elif target_type and target_key:
            candidates = list(self._edges_in.get(_node_id(target_type, target_key), []))
        else:
            seen: Set[int] = set()
            for edges in self._edges_out.values():
                for e in edges:
                    if id(e) not in seen:
                        candidates.append(e)
                        seen.add(id(e))

        def match(e: Edge) -> bool:
            if edge_type and e.type != edge_type:
                return False
            if source_type and e.source_type != source_type:
                return False
            if source_key and e.source_key != source_key:
                return False
            if target_type and e.target_type != target_type:
                return False
            if target_key and e.target_key != target_key:
                return False
            return True

        return [e for e in candidates if match(e)]

    async def delete_edges(
        self,
        source_type: Optional[NodeType] = None,
        source_key: Optional[str] = None,
        edge_type: Optional[EdgeType] = None,
        target_type: Optional[NodeType] = None,
        target_key: Optional[str] = None,
    ) -> int:
        victims = await self.get_edges(
            source_type=source_type,
            source_key=source_key,
            edge_type=edge_type,
            target_type=target_type,
            target_key=target_key,
        )
        for v in victims:
            sn = _node_id(v.source_type, v.source_key)
            tn = _node_id(v.target_type, v.target_key)
            self._edges_out[sn] = [e for e in self._edges_out[sn] if not _same_edge(e, v)]
            self._edges_in[tn] = [e for e in self._edges_in[tn] if not _same_edge(e, v)]
        return len(victims)

    # -- Traversal ------------------------------------------------------
    async def neighborhood(
        self,
        node_type: NodeType,
        key: str,
        depth: int = 2,
        edge_types: Optional[List[EdgeType]] = None,
    ) -> Tuple[List[Node], List[Edge]]:
        start_id = _node_id(node_type, key)
        if start_id not in self._nodes:
            return ([], [])
        et_filter = set(edge_types) if edge_types else None
        seen_nodes: Dict[str, Node] = {start_id: self._nodes[start_id]}
        seen_edges: List[Edge] = []
        frontier: List[str] = [start_id]
        for _ in range(max(0, depth)):
            next_frontier: List[str] = []
            for nid in frontier:
                for direction in ("out", "in"):
                    edges = (
                        self._edges_out.get(nid, [])
                        if direction == "out"
                        else self._edges_in.get(nid, [])
                    )
                    for e in edges:
                        if et_filter and e.type not in et_filter:
                            continue
                        seen_edges.append(e)
                        other_type = e.target_type if direction == "out" else e.source_type
                        other_key = e.target_key if direction == "out" else e.source_key
                        other_id = _node_id(other_type, other_key)
                        if other_id not in seen_nodes and other_id in self._nodes:
                            seen_nodes[other_id] = self._nodes[other_id]
                            next_frontier.append(other_id)
            frontier = next_frontier
        # dedupe edges by identity-of-fields
        unique: List[Edge] = []
        seen: Set[Tuple[str, str, str, str, str]] = set()
        for e in seen_edges:
            sig = (e.type.value, e.source_type.value, e.source_key, e.target_type.value, e.target_key)
            if sig in seen:
                continue
            seen.add(sig)
            unique.append(e)
        return (list(seen_nodes.values()), unique)

    async def reset(self) -> None:
        self._nodes.clear()
        self._edges_out.clear()
        self._edges_in.clear()


def _same_edge(a: Edge, b: Edge) -> bool:
    return (
        a.type == b.type
        and a.source_type == b.source_type
        and a.source_key == b.source_key
        and a.target_type == b.target_type
        and a.target_key == b.target_key
    )
