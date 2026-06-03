"""Schema sanity — exercises.json round-trips through the Pydantic model."""

from __future__ import annotations

from pathlib import Path

from app.ingestion.exercises import load_exercises


EXERCISES_PATH = Path(__file__).resolve().parents[1] / "exercises.json"


def test_exercises_load_and_validate() -> None:
    exercises = load_exercises(EXERCISES_PATH)
    assert len(exercises) >= 40
    # Sanity: at least one of every type we'll filter on later.
    assert any(ex.joints_loaded for ex in exercises)
    assert any(ex.is_bilateral for ex in exercises)
    assert any(not ex.supports_weight for ex in exercises)
    assert any(ex.is_duration for ex in exercises)


def test_joint_missing_flag() -> None:
    exercises = load_exercises(EXERCISES_PATH)
    missing = [ex for ex in exercises if ex.joint_data_missing()]
    # The dataset contains exercises with empty joints_loaded (e.g. Alternating Dumbbell Decline Bench Press).
    assert any(missing), "Expected at least one exercise with empty joints_loaded."
