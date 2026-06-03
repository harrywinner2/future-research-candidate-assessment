"""Retrieve and recommend routes."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from app.agents.hub import HubServices, run_hub
from app.agents.state import HubState
from app.api.dependencies import get_rag, get_services, get_trace_store
from app.observability.trace import TraceStore, start_trace
from app.retrieval.graph_rag import GraphRAG
from app.schemas.retrieval import RetrievalRequest, RetrievalResult

router = APIRouter()


@router.post("/retrieve")
async def retrieve(
    request: RetrievalRequest,
    rag: GraphRAG = Depends(get_rag),
) -> RetrievalResult:
    return await rag.retrieve(request)


class RecommendRequest(HubState):
    pass


@router.post("/recommend")
async def recommend(
    body: RecommendRequest,
    services: HubServices = Depends(get_services),
    traces: TraceStore = Depends(get_trace_store),
) -> dict:
    async with start_trace(
        traces,
        request_summary=body.request,
        member_id=body.member_id,
        safety_policy_version=services.policy.version,
    ) as trace:
        final = await run_hub(services, body)
        payload = final.model_dump(exclude_none=True)
        payload["trace_id"] = trace.id
        if final.recommendation:
            payload["recommendation"] = final.recommendation.model_copy(
                update={"trace_id": trace.id}
            ).model_dump()
        return payload


class ExplainRequest(HubState):
    exercise_id: Optional[str] = None
    action: str = "skipped"


@router.post("/explain")
async def explain(
    body: ExplainRequest,
    services: HubServices = Depends(get_services),
    traces: TraceStore = Depends(get_trace_store),
) -> dict:
    state = body.model_copy(update={"scratch": {"explain_exercise_id": body.exercise_id}})
    state.decision = state.decision  # explicit no-op for clarity
    async with start_trace(
        traces,
        request_summary=body.request or f"why {body.action} {body.exercise_id}",
        member_id=body.member_id,
        safety_policy_version=services.policy.version,
    ) as trace:
        final = await run_hub(services, state)
        payload = final.model_dump(exclude_none=True)
        payload["trace_id"] = trace.id
        return payload


@router.post("/log")
async def log_workout_route(
    body: RecommendRequest,
    services: HubServices = Depends(get_services),
    traces: TraceStore = Depends(get_trace_store),
) -> dict:
    async with start_trace(
        traces, request_summary=body.request, member_id=body.member_id
    ) as trace:
        final = await run_hub(services, body)
        payload = final.model_dump(exclude_none=True)
        payload["trace_id"] = trace.id
        return payload
