"""Tools available to sub-agents.

These are plain async functions with Pydantic input schemas. Sub-agents call
them directly; if/when we wire LangGraph's tool-node features in, they can be
registered with no body changes.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field
from rapidfuzz import fuzz

from app.graph.client import GraphClient
from app.graph.queries import (
    all_exercises,
    exercise_equipment,
    exercise_joints,
    exercise_muscles,
    exercise_patterns,
)
from app.graph.schema import NodeType
from app.schemas.common import ConfidenceLevel
from app.schemas.exercise import Exercise


class SearchExercisesInput(BaseModel):
    muscle_groups: List[str] = Field(default_factory=list)
    equipment_available: List[str] = Field(default_factory=list)
    movement_patterns: List[str] = Field(default_factory=list)
    exclude_ids: List[str] = Field(default_factory=list)
    excluded_joints: List[str] = Field(default_factory=list, description="Joints to avoid loading.")
    limit: int = 10


class SearchExerciseHit(BaseModel):
    exercise: Exercise
    score: float


async def search_exercises(client: GraphClient, args: SearchExercisesInput) -> List[SearchExerciseHit]:
    """Filter exercises against the requested constraints.

    Scoring is simple: count of matching desired criteria minus penalties.
    Returns at most ``args.limit`` hits.
    """
    nodes = await all_exercises(client)
    hits: List[SearchExerciseHit] = []
    for node in nodes:
        if node.key in args.exclude_ids:
            continue
        muscles = set(await exercise_muscles(client, node.key))
        equipment = set(await exercise_equipment(client, node.key))
        patterns = set(await exercise_patterns(client, node.key))
        joints = set(await exercise_joints(client, node.key))
        if args.muscle_groups and not any(m in muscles for m in args.muscle_groups):
            continue
        if args.movement_patterns and not any(p in patterns for p in args.movement_patterns):
            continue
        if args.equipment_available and equipment and not equipment.issubset(set(args.equipment_available)):
            continue
        if args.excluded_joints and (joints & set(args.excluded_joints)):
            continue
        score = (
            len(muscles & set(args.muscle_groups or [])) * 2
            + len(patterns & set(args.movement_patterns or []))
            - (3 if not joints else 0)
        )
        exercise = Exercise(
            id=node.key,
            name=node.properties.get("name", node.key),
            muscle_groups=sorted(muscles),
            joints_loaded=sorted(joints),
            movement_patterns=sorted(patterns),
            equipment_required=sorted(equipment),
            is_bilateral=bool(node.properties.get("is_bilateral", False)),
            side=node.properties.get("side"),
            priority_tier=int(node.properties.get("priority_tier", 3)),
            is_reps=bool(node.properties.get("is_reps", True)),
            is_duration=bool(node.properties.get("is_duration", False)),
            supports_weight=bool(node.properties.get("supports_weight", True)),
            estimated_rep_duration=float(node.properties.get("estimated_rep_duration", 1.0)),
            bilateral_pair_id=node.properties.get("bilateral_pair_id"),
        )
        hits.append(SearchExerciseHit(exercise=exercise, score=float(score)))
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits[: args.limit]


class FuzzyMatchInput(BaseModel):
    query: str
    limit: int = 5


class FuzzyMatch(BaseModel):
    exercise_id: str
    exercise_name: str
    score: int
    confidence: ConfidenceLevel


async def fuzzy_match_exercise(client: GraphClient, args: FuzzyMatchInput) -> List[FuzzyMatch]:
    nodes = await all_exercises(client)
    scored: List[FuzzyMatch] = []
    for node in nodes:
        name = node.properties.get("name", node.key)
        score = int(fuzz.token_set_ratio(args.query.lower(), name.lower()))
        conf = ConfidenceLevel.LOW
        if score >= 90:
            conf = ConfidenceLevel.HIGH
        elif score >= 75:
            conf = ConfidenceLevel.MEDIUM
        scored.append(
            FuzzyMatch(exercise_id=node.key, exercise_name=name, score=score, confidence=conf)
        )
    scored.sort(key=lambda m: m.score, reverse=True)
    return scored[: args.limit]


class BuildWorkoutInput(BaseModel):
    sections: dict
    notes: Optional[str] = None
