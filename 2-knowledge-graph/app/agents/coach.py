"""Coach sub-agent — answers general questions grounded in retrieved context."""

from __future__ import annotations

from app.agents.prompts import COACH, render
from app.agents.state import HubState
from app.llm.client import LLMClient
from app.observability.trace import with_stage
from app.schemas.retrieval import RetrievalContext
from app.schemas.trace import StageType


async def answer(state: HubState, llm: LLMClient, context: RetrievalContext) -> HubState:
    async with with_stage(
        "coach",
        StageType.GENERATE,
        inputs={"request": state.request},
        prompt_template_id=COACH.id,
        prompt_template_version=COACH.version,
        model_id=llm.model_id,
    ) as stage:
        prompt = render(
            COACH,
            member_summary=context.member_summary,
            active_injuries=", ".join(context.active_injuries) or "none",
            available_equipment=", ".join(context.available_equipment) or "none",
            context="\n".join(f"- {f.label}" for f in context.facts[:12]),
            request=state.request,
        )
        response = await llm.complete(prompt)
        stage.outputs = {"text": response.text[:500]}
        stage.tokens_prompt = response.tokens_prompt
        stage.tokens_completion = response.tokens_completion
    return state.model_copy(update={"coach_answer": response.text})
