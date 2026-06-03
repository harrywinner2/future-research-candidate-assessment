"""High-level read helpers built on top of ``GraphClient``.

These are the convenience queries used by retrieval, safety filtering, and the
``/graph`` API routes. They keep the rest of the code free of edge-direction
trivia.
"""

from __future__ import annotations

from typing import List, Optional, Set

from app.graph.client import Edge, GraphClient, Node
from app.graph.schema import EdgeType, NodeType


async def member_equipment(client: GraphClient, member_id: str) -> List[str]:
    edges = await client.get_edges(
        source_type=NodeType.MEMBER,
        source_key=member_id,
        edge_type=EdgeType.HAS_EQUIPMENT,
    )
    return [e.target_key for e in edges]


async def member_active_injuries(client: GraphClient, member_id: str) -> List[Node]:
    edges = await client.get_edges(
        source_type=NodeType.MEMBER,
        source_key=member_id,
        edge_type=EdgeType.HAS_INJURY,
    )
    out: List[Node] = []
    for e in edges:
        node = await client.get_node(NodeType.INJURY, e.target_key)
        if node and node.properties.get("status") == "active":
            out.append(node)
    return out


async def member_contraindicated_joints(client: GraphClient, member_id: str) -> Set[str]:
    """Joints currently affected by an active injury for this member."""
    injuries = await member_active_injuries(client, member_id)
    joints: Set[str] = set()
    for injury in injuries:
        edges = await client.get_edges(
            source_type=NodeType.INJURY,
            source_key=injury.key,
            edge_type=EdgeType.AFFECTS_JOINT,
        )
        joints.update(e.target_key for e in edges)
    return joints


async def exercise_joints(client: GraphClient, exercise_id: str) -> List[str]:
    edges = await client.get_edges(
        source_type=NodeType.EXERCISE,
        source_key=exercise_id,
        edge_type=EdgeType.LOADS_JOINT,
    )
    return [e.target_key for e in edges]


async def exercise_equipment(client: GraphClient, exercise_id: str) -> List[str]:
    edges = await client.get_edges(
        source_type=NodeType.EXERCISE,
        source_key=exercise_id,
        edge_type=EdgeType.USES_EQUIPMENT,
    )
    return [e.target_key for e in edges]


async def exercise_muscles(client: GraphClient, exercise_id: str) -> List[str]:
    edges = await client.get_edges(
        source_type=NodeType.EXERCISE,
        source_key=exercise_id,
        edge_type=EdgeType.TRAINS_MUSCLE,
    )
    return [e.target_key for e in edges]


async def exercise_patterns(client: GraphClient, exercise_id: str) -> List[str]:
    edges = await client.get_edges(
        source_type=NodeType.EXERCISE,
        source_key=exercise_id,
        edge_type=EdgeType.HAS_MOVEMENT_PATTERN,
    )
    return [e.target_key for e in edges]


async def find_bilateral_pair(client: GraphClient, exercise_id: str) -> Optional[str]:
    edges = await client.get_edges(
        source_type=NodeType.EXERCISE,
        source_key=exercise_id,
        edge_type=EdgeType.HAS_BILATERAL_PAIR,
    )
    return edges[0].target_key if edges else None


async def exercises_loading_joint(client: GraphClient, joint: str) -> List[str]:
    edges = await client.get_edges(
        target_type=NodeType.JOINT,
        target_key=joint,
        edge_type=EdgeType.LOADS_JOINT,
    )
    return [e.source_key for e in edges]


async def all_exercises(client: GraphClient) -> List[Node]:
    return await client.find_nodes(NodeType.EXERCISE, limit=10_000)


async def all_members(client: GraphClient) -> List[Node]:
    return await client.find_nodes(NodeType.MEMBER, limit=10_000)


def explain_path(*hops: str) -> str:
    """Render a short graph path string for the Why drawer.

    Example: ``explain_path("Member", "HAS_INJURY", "Injury", "AFFECTS_JOINT", "knee")``
    -> ``"Member -> HAS_INJURY -> Injury -> AFFECTS_JOINT -> knee"``.
    """
    return " -> ".join(str(h) for h in hops)


def edges_for_node(edges: List[Edge], node_type: NodeType, key: str) -> List[Edge]:
    return [e for e in edges if (e.source_type == node_type and e.source_key == key)
            or (e.target_type == node_type and e.target_key == key)]
