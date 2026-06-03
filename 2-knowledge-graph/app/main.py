"""FastAPI application entrypoint.

Wires up:

- Singletons (graph client, vector store, embedder, LLM, GraphRAG, hub services,
  trace store, safety policy) on ``app.state`` at startup.
- Routes.
- Optional seed-on-boot.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.agents.hub import HubServices
from app.api.dependencies import get_app_settings  # noqa: F401  (re-export for tests)
from app.api.routes import (
    exercises as exercises_routes,
    graph as graph_routes,
    health as health_routes,
    ingest as ingest_routes,
    members as members_routes,
    retrieve as retrieve_routes,
    traces as traces_routes,
)
from app.config import Settings, get_settings
from app.graph.client import GraphClient
from app.graph.memory_client import InMemoryGraphClient
from app.ingestion.seed import seed_demo
from app.llm.client import build_llm
from app.observability.logging import get_logger, setup_logging
from app.observability.trace import TraceStore
from app.retrieval.embeddings import build_embedder
from app.retrieval.graph_rag import GraphRAG
from app.retrieval.vector_store import InMemoryVectorStore
from app.safety.policy import POLICY_REGISTRY


def _build_graph_client(settings: Settings) -> GraphClient:
    if settings.graph_backend == "neo4j":
        from app.graph.neo4j_client import Neo4jGraphClient

        return Neo4jGraphClient(
            uri=settings.neo4j_uri,
            user=settings.neo4j_user,
            password=settings.neo4j_password,
            database=settings.neo4j_database,
        )
    return InMemoryGraphClient()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    log = get_logger("app.main")
    settings = get_settings()

    graph = _build_graph_client(settings)
    await graph.initialize()
    vectors = InMemoryVectorStore()
    embedder = build_embedder(settings)
    llm = build_llm(settings)
    rag = GraphRAG(graph=graph, vectors=vectors, embedder=embedder)
    policy = POLICY_REGISTRY.get(settings.safety_level, POLICY_REGISTRY["standard"])
    services = HubServices(llm=llm, graph=graph, rag=rag, policy=policy)
    traces = TraceStore()

    app.state.settings = settings
    app.state.graph = graph
    app.state.vectors = vectors
    app.state.embedder = embedder
    app.state.llm = llm
    app.state.rag = rag
    app.state.policy = policy
    app.state.services = services
    app.state.traces = traces

    if settings.seed_on_boot:
        try:
            result = await seed_demo(
                graph=graph,
                vectors=vectors,
                embedder=embedder,
                llm=llm,
                exercises_path=settings.exercises_path,
            )
            log.info("seed.complete", **result)
        except Exception as exc:  # noqa: BLE001
            log.warning("seed.failed", error=str(exc))

    try:
        yield
    finally:
        await graph.close()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Knowledge Graph Coaching Platform",
        description="GraphRAG-powered injury-aware coaching API. Synthetic data only.",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(health_routes.router)
    app.include_router(members_routes.router)
    app.include_router(exercises_routes.router)
    app.include_router(ingest_routes.router)
    app.include_router(retrieve_routes.router)
    app.include_router(graph_routes.router)
    app.include_router(traces_routes.router)
    return app


app = create_app()


def cli() -> None:
    """Convenience: ``coach-kg`` runs the dev server."""
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
