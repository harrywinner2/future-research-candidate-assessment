"""Logger: fuzzy-match and never-invent-weight invariants."""

from __future__ import annotations

import pytest

from app.agents.logger import log_workout
from app.agents.state import HubState
from app.llm.fake import FakeLLM


@pytest.mark.asyncio
async def test_fuzzy_match_bench_press(seeded_graph, member_id) -> None:
    state = HubState(
        request="I just did 3x10 bench press at 185 lbs", member_id=member_id
    )
    out = await log_workout(state, llm=FakeLLM(), graph=seeded_graph)
    assert out.workout_log is not None
    assert out.workout_log.entries, "Logger returned no entries."
    first = out.workout_log.entries[0]
    assert first.exercise_name_raw.lower().startswith("bench press")
    assert first.sets == 3
    assert first.reps == 10
    assert first.weight == 185.0


@pytest.mark.asyncio
async def test_missing_weight_stays_null(seeded_graph, member_id) -> None:
    state = HubState(request="3x10 push-ups", member_id=member_id)
    out = await log_workout(state, llm=FakeLLM(), graph=seeded_graph)
    assert out.workout_log is not None
    assert out.workout_log.entries
    first = out.workout_log.entries[0]
    assert first.weight is None
    assert "weight" in first.missing_fields
