"""Ingestion routes — profile, injury, signal, bulk seed."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.dependencies import (
    get_app_settings,
    get_embedder,
    get_graph_client,
    get_llm,
    get_vector_store,
)
from app.config import Settings
from app.graph.client import GraphClient
from app.ingestion.exercises import ingest_exercises, load_exercises
from app.ingestion.members import ingest_injury, ingest_member
from app.ingestion.seed import seed_demo
from app.ingestion.signals import SignalExtractor, ingest_signal
from app.llm.client import LLMClient
from app.retrieval.embeddings import Embedder
from app.retrieval.vector_store import VectorStore
from app.schemas.injury import Injury
from app.schemas.member import Member
from app.schemas.signal import ContextSignal, SignalType

router = APIRouter(prefix="/ingest")


@router.post("/profile", status_code=201)
async def ingest_profile(
    member: Member,
    graph: GraphClient = Depends(get_graph_client),
) -> dict[str, str]:
    await ingest_member(graph, member)
    return {"member_id": member.id, "status": "ingested"}


@router.post("/injury", status_code=201)
async def ingest_injury_route(
    member_id: str,
    injury: Injury,
    graph: GraphClient = Depends(get_graph_client),
) -> dict[str, str]:
    await ingest_injury(graph, member_id, injury)
    return {"injury_id": injury.id, "status": "ingested"}


@router.post("/signal", status_code=201)
async def ingest_signal_route(
    member_id: str,
    text: str,
    signal_type: SignalType = SignalType.CHAT,
    graph: GraphClient = Depends(get_graph_client),
    llm: LLMClient = Depends(get_llm),
) -> ContextSignal:
    extractor = SignalExtractor(llm)
    return await ingest_signal(graph, extractor, member_id, text, signal_type)


@router.post("/seed", status_code=201)
async def seed(
    settings: Settings = Depends(get_app_settings),
    graph: GraphClient = Depends(get_graph_client),
    vectors: VectorStore = Depends(get_vector_store),
    embedder: Embedder = Depends(get_embedder),
    llm: LLMClient = Depends(get_llm),
) -> dict[str, Any]:
    return await seed_demo(
        graph=graph,
        vectors=vectors,
        embedder=embedder,
        llm=llm,
        exercises_path=settings.exercises_path,
    )


@router.post("/exercises", status_code=201)
async def ingest_exercises_route(
    settings: Settings = Depends(get_app_settings),
    graph: GraphClient = Depends(get_graph_client),
) -> dict[str, int]:
    exercises = load_exercises(settings.exercises_path)
    n = await ingest_exercises(graph, exercises)
    return {"ingested": n}
