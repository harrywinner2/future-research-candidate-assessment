"""Hub end-to-end: route -> retrieve -> generate -> validate."""

from __future__ import annotations

import pytest

from app.agents.hub import run_hub
from app.agents.state import HubState, Route
from app.observability.trace import start_trace
from app.schemas.common import SafetyStatus


@pytest.mark.asyncio
async def test_generate_lower_body_session(services, member_id, trace_store) -> None:
    async with start_trace(trace_store, request_summary="lower body", member_id=member_id) as trace:
        state = HubState(
            request="Build me a lower-body session with dumbbells for this week.",
            member_id=member_id,
        )
        final = await run_hub(services, state)
        assert final.decision is not None
        assert final.decision.route == Route.WORKOUT_GENERATE
        rec = final.recommendation
        assert rec is not None
        # No exercise in the final recommendation may load the knee.
        for section in rec.sections:
            for ex in section.exercises:
                assert ex.safety_status in (SafetyStatus.SAFE, SafetyStatus.CAUTION, SafetyStatus.UNKNOWN), (
                    f"{ex.exercise.name} slipped through with status {ex.safety_status}"
                )
        # Trace should have stages for each major phase.
        stage_names = {s.name for s in trace.stages}
        assert "router" in stage_names
        assert "retrieval" in stage_names


@pytest.mark.asyncio
async def test_clarify_path_returns_question(services, member_id) -> None:
    state = HubState(request="bench press", member_id=member_id)
    final = await run_hub(services, state)
    assert final.clarification_question is not None
    assert "more" in final.clarification_question.lower()


@pytest.mark.asyncio
async def test_log_path_returns_workout_log(services, member_id) -> None:
    state = HubState(
        request="I did 4x5 deadlift at 225 lbs yesterday", member_id=member_id
    )
    final = await run_hub(services, state)
    assert final.workout_log is not None
    assert final.workout_log.entries
