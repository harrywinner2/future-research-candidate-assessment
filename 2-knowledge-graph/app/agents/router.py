"""Router sub-agent — LLM-structured-output classification."""

from __future__ import annotations

from app.agents.prompts import ROUTER, render
from app.agents.state import HubState, Route, RouterDecision
from app.llm.client import LLMClient
from app.observability.trace import with_stage
from app.schemas.trace import StageType


async def route(state: HubState, llm: LLMClient) -> HubState:
    """Returns a new HubState with ``decision`` filled."""
    async with with_stage(
        "router",
        StageType.ROUTE,
        inputs={"request": state.request, "member_id": state.member_id},
        prompt_template_id=ROUTER.id,
        prompt_template_version=ROUTER.version,
        model_id=llm.model_id,
    ) as stage:
        prompt = render(ROUTER, request=state.request)
        decision: RouterDecision = await llm.structured_complete(prompt, RouterDecision)
        if decision.confidence < 0.5 and decision.route != Route.CLARIFY:
            decision = RouterDecision(
                route=Route.CLARIFY,
                confidence=decision.confidence,
                rationale=f"Low confidence ({decision.confidence:.2f}) on '{decision.route.value}'.",
            )
        stage.outputs = decision.model_dump()
    return state.model_copy(update={"decision": decision})
