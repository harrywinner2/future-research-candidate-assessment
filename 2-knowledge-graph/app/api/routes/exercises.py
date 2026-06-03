"""Exercise library routes — list, detail, member-aware safety labels."""

from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_graph_client, get_policy
from app.graph.client import GraphClient
from app.graph.queries import (
    all_exercises,
    exercise_equipment,
    exercise_joints,
    exercise_muscles,
    exercise_patterns,
)
from app.graph.schema import NodeType
from app.safety.filters import ExerciseFilter
from app.safety.policy import SafetyPolicy

router = APIRouter(prefix="/exercises")


@router.get("")
async def list_exercises(
    muscle: Optional[str] = Query(None),
    equipment: Optional[str] = Query(None),
    member_id: Optional[str] = Query(None),
    limit: int = 200,
    graph: GraphClient = Depends(get_graph_client),
    policy: SafetyPolicy = Depends(get_policy),
) -> List[dict[str, Any]]:
    nodes = await all_exercises(graph)
    out: List[dict[str, Any]] = []
    filter_ = ExerciseFilter(graph, policy) if member_id else None
    for n in nodes:
        muscles = await exercise_muscles(graph, n.key)
        equip = await exercise_equipment(graph, n.key)
        if muscle and muscle not in muscles:
            continue
        if equipment and equipment not in equip:
            continue
        row: dict[str, Any] = {
            "id": n.key,
            "name": n.properties.get("name", n.key),
            "muscle_groups": muscles,
            "joints_loaded": await exercise_joints(graph, n.key),
            "movement_patterns": await exercise_patterns(graph, n.key),
            "equipment_required": equip,
            "priority_tier": n.properties.get("priority_tier"),
            "is_bilateral": n.properties.get("is_bilateral"),
        }
        if filter_ and member_id:
            decision = await filter_.evaluate(n.key, member_id)
            row["safety_status"] = decision.status.value
            row["safety_reason"] = decision.reason
        out.append(row)
        if len(out) >= limit:
            break
    return out


@router.get("/{exercise_id}")
async def exercise_detail(
    exercise_id: str,
    member_id: Optional[str] = Query(None),
    graph: GraphClient = Depends(get_graph_client),
    policy: SafetyPolicy = Depends(get_policy),
) -> dict[str, Any]:
    node = await graph.get_node(NodeType.EXERCISE, exercise_id)
    if not node:
        raise HTTPException(404, f"Exercise {exercise_id} not found.")
    detail: dict[str, Any] = {
        "id": node.key,
        "name": node.properties.get("name", node.key),
        "priority_tier": node.properties.get("priority_tier"),
        "muscle_groups": await exercise_muscles(graph, exercise_id),
        "joints_loaded": await exercise_joints(graph, exercise_id),
        "movement_patterns": await exercise_patterns(graph, exercise_id),
        "equipment_required": await exercise_equipment(graph, exercise_id),
        "is_bilateral": node.properties.get("is_bilateral"),
        "side": node.properties.get("side"),
        "supports_weight": node.properties.get("supports_weight"),
        "is_reps": node.properties.get("is_reps"),
        "is_duration": node.properties.get("is_duration"),
        "bilateral_pair_id": node.properties.get("bilateral_pair_id"),
    }
    if member_id:
        filter_ = ExerciseFilter(graph, policy)
        decision = await filter_.evaluate(exercise_id, member_id)
        detail["safety"] = {
            "status": decision.status.value,
            "reason": decision.reason,
            "rule": decision.rule,
            "graph_path": decision.graph_path,
        }
    return detail
