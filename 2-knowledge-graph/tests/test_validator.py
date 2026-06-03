"""Validator catches unknown ids and contraindicated exercises."""

from __future__ import annotations

import uuid

import pytest

from app.safety.policy import POLICY_REGISTRY
from app.safety.validator import RecommendationValidator
from app.schemas.exercise import ExerciseRef
from app.schemas.recommendation import (
    GeneratedExercise,
    Recommendation,
    RecommendationSection,
    ValidationReport,
)


def _make_rec(member_id: str, *exercise_ids: str) -> Recommendation:
    return Recommendation(
        id=str(uuid.uuid4()),
        member_id=member_id,
        request="fake",
        summary="fake",
        sections=[
            RecommendationSection(
                name="main",
                exercises=[
                    GeneratedExercise(exercise=ExerciseRef(id=eid, name=eid), sets=3, reps=10)
                    for eid in exercise_ids
                ],
            )
        ],
        excluded=[],
        validation=ValidationReport(passed=True),
        safety_policy_version="standard-1.0.0",
        prompt_template_versions={},
        model_id="fake",
    )


@pytest.mark.asyncio
async def test_unknown_id_flagged_and_substituted(seeded_graph, member_id) -> None:
    validator = RecommendationValidator(seeded_graph, POLICY_REGISTRY["standard"], strict=True)
    rec = _make_rec(member_id, "definitely-not-a-real-uuid")
    outcome = await validator.validate(rec, member_id)
    assert "definitely-not-a-real-uuid" in outcome.report.unknown_exercise_ids


@pytest.mark.asyncio
async def test_contraindicated_exercise_caught(seeded_graph, member_id) -> None:
    """Pick an exercise that loads knee and force it into a recommendation; validator must catch it."""
    from app.graph.queries import all_exercises, exercise_joints

    nodes = await all_exercises(seeded_graph)
    knee_loader = None
    for n in nodes:
        joints = await exercise_joints(seeded_graph, n.key)
        if "knee" in joints:
            knee_loader = n
            break
    assert knee_loader is not None, "Seeded dataset has no knee-loading exercise."

    rec = _make_rec(member_id, knee_loader.key)
    validator = RecommendationValidator(seeded_graph, POLICY_REGISTRY["standard"], strict=True)
    outcome = await validator.validate(rec, member_id)
    assert knee_loader.key in outcome.report.contraindicated_exercises
    assert outcome.report.issues, "Validator should report at least one issue."
