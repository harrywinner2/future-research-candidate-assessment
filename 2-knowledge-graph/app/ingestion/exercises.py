"""Load ``exercises.json`` into the graph."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List

from app.graph.client import Edge, GraphClient, Node
from app.graph.schema import EdgeType, NodeType
from app.schemas.common import Lineage, utcnow
from app.schemas.exercise import Exercise


def load_exercises(path: Path) -> List[Exercise]:
    raw = json.loads(Path(path).read_text())
    return [Exercise.model_validate(row) for row in raw]


async def ingest_exercises(client: GraphClient, exercises: List[Exercise]) -> int:
    """Idempotent. Returns the number of exercises ingested."""
    lineage = Lineage(source="exercises.json", ingester="ingest_exercises", confidence=1.0)
    lineage_props = lineage.model_dump(mode="json")

    for ex in exercises:
        await client.upsert_node(
            Node(
                type=NodeType.EXERCISE,
                key=ex.id,
                properties={
                    "name": ex.name,
                    "priority_tier": ex.priority_tier,
                    "is_bilateral": ex.is_bilateral,
                    "side": ex.side,
                    "supports_weight": ex.supports_weight,
                    "is_reps": ex.is_reps,
                    "is_duration": ex.is_duration,
                    "estimated_rep_duration": ex.estimated_rep_duration,
                    "bilateral_pair_id": ex.bilateral_pair_id,
                    **lineage_props,
                },
            )
        )
        for joint in ex.joints_loaded:
            await client.upsert_node(Node(type=NodeType.JOINT, key=joint, properties={"name": joint}))
            await client.upsert_edge(
                Edge(
                    type=EdgeType.LOADS_JOINT,
                    source_type=NodeType.EXERCISE,
                    source_key=ex.id,
                    target_type=NodeType.JOINT,
                    target_key=joint,
                    properties=lineage_props,
                )
            )
        for muscle in ex.muscle_groups:
            await client.upsert_node(
                Node(type=NodeType.MUSCLE_GROUP, key=muscle, properties={"name": muscle})
            )
            await client.upsert_edge(
                Edge(
                    type=EdgeType.TRAINS_MUSCLE,
                    source_type=NodeType.EXERCISE,
                    source_key=ex.id,
                    target_type=NodeType.MUSCLE_GROUP,
                    target_key=muscle,
                    properties=lineage_props,
                )
            )
        for pattern in ex.movement_patterns:
            await client.upsert_node(
                Node(type=NodeType.MOVEMENT_PATTERN, key=pattern, properties={"name": pattern})
            )
            await client.upsert_edge(
                Edge(
                    type=EdgeType.HAS_MOVEMENT_PATTERN,
                    source_type=NodeType.EXERCISE,
                    source_key=ex.id,
                    target_type=NodeType.MOVEMENT_PATTERN,
                    target_key=pattern,
                    properties=lineage_props,
                )
            )
        for equip in ex.equipment_required:
            await client.upsert_node(
                Node(type=NodeType.EQUIPMENT, key=equip, properties={"name": equip})
            )
            await client.upsert_edge(
                Edge(
                    type=EdgeType.USES_EQUIPMENT,
                    source_type=NodeType.EXERCISE,
                    source_key=ex.id,
                    target_type=NodeType.EQUIPMENT,
                    target_key=equip,
                    properties=lineage_props,
                )
            )
        if ex.bilateral_pair_id:
            await client.upsert_edge(
                Edge(
                    type=EdgeType.HAS_BILATERAL_PAIR,
                    source_type=NodeType.EXERCISE,
                    source_key=ex.id,
                    target_type=NodeType.EXERCISE,
                    target_key=ex.bilateral_pair_id,
                    properties=lineage_props,
                )
            )

    return len(exercises)
