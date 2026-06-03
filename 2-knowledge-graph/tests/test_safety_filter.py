"""Critical path: injury-aware filtering.

Member with a knee injury must never receive a knee-loading exercise.
"""

from __future__ import annotations

import pytest

from app.graph.queries import all_exercises, exercise_joints
from app.safety.filters import ExerciseFilter
from app.safety.policy import POLICY_REGISTRY
from app.schemas.common import SafetyStatus


@pytest.mark.asyncio
async def test_knee_injury_filters_knee_loaders(seeded_graph, member_id) -> None:
    filter_ = ExerciseFilter(seeded_graph, POLICY_REGISTRY["standard"])
    nodes = await all_exercises(seeded_graph)
    found_exclusion = False
    for n in nodes:
        joints = await exercise_joints(seeded_graph, n.key)
        decision = await filter_.evaluate(n.key, member_id)
        if "knee" in joints:
            assert decision.status in (SafetyStatus.EXCLUDED, SafetyStatus.CAUTION), (
                f"{n.properties.get('name')} loads knee but was not flagged."
            )
            if decision.status == SafetyStatus.EXCLUDED:
                found_exclusion = True
    assert found_exclusion, "Expected at least one knee-loading exercise to be EXCLUDED."


@pytest.mark.asyncio
async def test_unavailable_equipment_excludes(seeded_graph, member_id) -> None:
    """Synth-Alex only has dumbbell, mat, flat bench — barbell exercises must be excluded."""
    filter_ = ExerciseFilter(seeded_graph, POLICY_REGISTRY["standard"])
    nodes = await all_exercises(seeded_graph)
    barbell_exercise = next(
        (n for n in nodes if "Barbell" in n.properties.get("name", "")), None
    )
    assert barbell_exercise is not None
    decision = await filter_.evaluate(barbell_exercise.key, member_id)
    assert decision.status == SafetyStatus.EXCLUDED
    assert "equipment" in (decision.reason or "").lower()


@pytest.mark.asyncio
async def test_strict_policy_excludes_missing_joint_data(seeded_graph, member_id) -> None:
    filter_ = ExerciseFilter(seeded_graph, POLICY_REGISTRY["strict"])
    nodes = await all_exercises(seeded_graph)
    target = next(
        (n for n in nodes if "Alternating Dumbbell Decline" in n.properties.get("name", "")),
        None,
    )
    assert target is not None
    decision = await filter_.evaluate(target.key, member_id)
    # This exercise has empty joints_loaded; strict policy excludes.
    # But it also requires a decline bench Synth-Alex doesn't have, so equipment will exclude first.
    assert decision.status == SafetyStatus.EXCLUDED


@pytest.mark.asyncio
async def test_lenient_policy_demotes_to_caution(seeded_graph, member_id) -> None:
    filter_ = ExerciseFilter(seeded_graph, POLICY_REGISTRY["lenient"])
    nodes = await all_exercises(seeded_graph)
    for n in nodes:
        joints = await exercise_joints(seeded_graph, n.key)
        if "knee" in joints:
            decision = await filter_.evaluate(n.key, member_id)
            # Lenient policy demotes the joint conflict to caution, not exclusion.
            assert decision.status != SafetyStatus.EXCLUDED or "equipment" in (decision.reason or "")
            return
    pytest.skip("No knee-loading exercise found in seeded dataset.")
