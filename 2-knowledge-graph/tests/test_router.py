"""Router: ambiguous input triggers clarification; explicit input routes confidently."""

from __future__ import annotations

import pytest

from app.agents.router import route
from app.agents.state import HubState, Route
from app.llm.fake import FakeLLM


@pytest.mark.asyncio
async def test_unambiguous_generate() -> None:
    state = HubState(request="Build me a 30-min lower-body session with dumbbells")
    out = await route(state, FakeLLM())
    assert out.decision is not None
    assert out.decision.route == Route.WORKOUT_GENERATE
    assert out.decision.confidence >= 0.5


@pytest.mark.asyncio
async def test_log_intent_detected() -> None:
    state = HubState(request="I just did 3x10 bench press at 185 lbs")
    out = await route(state, FakeLLM())
    assert out.decision is not None
    assert out.decision.route == Route.WORKOUT_LOG


@pytest.mark.asyncio
async def test_ambiguous_triggers_clarify() -> None:
    state = HubState(request="bench press")
    out = await route(state, FakeLLM())
    assert out.decision is not None
    assert out.decision.route == Route.CLARIFY, (
        f"Expected CLARIFY for ambiguous input, got {out.decision.route}"
    )


@pytest.mark.asyncio
async def test_low_confidence_router_demoted() -> None:
    """Even if the model returns a confident-looking route, low confidence -> CLARIFY."""
    llm = FakeLLM()
    llm.add_script(
        match="Build",
        payload={"route": "COACH", "confidence": 0.3, "rationale": "ambiguous"},
    )
    state = HubState(request="Build something maybe?")
    out = await route(state, llm)
    assert out.decision is not None
    assert out.decision.route == Route.CLARIFY
