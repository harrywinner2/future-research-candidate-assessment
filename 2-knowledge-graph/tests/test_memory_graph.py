"""In-memory graph adapter contract."""

from __future__ import annotations

import pytest

from app.graph.client import Edge, Node
from app.graph.memory_client import InMemoryGraphClient
from app.graph.schema import EdgeType, NodeType


@pytest.mark.asyncio
async def test_upsert_and_get() -> None:
    g = InMemoryGraphClient()
    await g.upsert_node(Node(type=NodeType.MEMBER, key="m1", properties={"name": "Alex"}))
    node = await g.get_node(NodeType.MEMBER, "m1")
    assert node is not None
    assert node.properties["name"] == "Alex"


@pytest.mark.asyncio
async def test_edges_and_neighborhood() -> None:
    g = InMemoryGraphClient()
    await g.upsert_node(Node(type=NodeType.MEMBER, key="m1", properties={}))
    await g.upsert_node(Node(type=NodeType.INJURY, key="i1", properties={"status": "active"}))
    await g.upsert_node(Node(type=NodeType.JOINT, key="knee", properties={}))
    await g.upsert_edge(
        Edge(type=EdgeType.HAS_INJURY, source_type=NodeType.MEMBER, source_key="m1",
             target_type=NodeType.INJURY, target_key="i1")
    )
    await g.upsert_edge(
        Edge(type=EdgeType.AFFECTS_JOINT, source_type=NodeType.INJURY, source_key="i1",
             target_type=NodeType.JOINT, target_key="knee")
    )
    nodes, edges = await g.neighborhood(NodeType.MEMBER, "m1", depth=2)
    assert {n.key for n in nodes} == {"m1", "i1", "knee"}
    assert any(e.type == EdgeType.AFFECTS_JOINT for e in edges)


@pytest.mark.asyncio
async def test_find_nodes_with_where() -> None:
    g = InMemoryGraphClient()
    await g.upsert_node(Node(type=NodeType.INJURY, key="i1", properties={"status": "active"}))
    await g.upsert_node(Node(type=NodeType.INJURY, key="i2", properties={"status": "resolved"}))
    found = await g.find_nodes(NodeType.INJURY, where={"status": "active"})
    assert [n.key for n in found] == ["i1"]


@pytest.mark.asyncio
async def test_delete_node_cleans_edges() -> None:
    g = InMemoryGraphClient()
    await g.upsert_node(Node(type=NodeType.MEMBER, key="m1"))
    await g.upsert_node(Node(type=NodeType.INJURY, key="i1"))
    await g.upsert_edge(
        Edge(type=EdgeType.HAS_INJURY, source_type=NodeType.MEMBER, source_key="m1",
             target_type=NodeType.INJURY, target_key="i1")
    )
    assert await g.delete_node(NodeType.INJURY, "i1") is True
    edges = await g.get_edges(source_type=NodeType.MEMBER, source_key="m1")
    assert edges == []
