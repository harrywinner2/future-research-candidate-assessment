"""FastAPI application entrypoint.

Wires up:

- Singletons (graph client, vector store, embedder, LLM, GraphRAG, hub services,
  trace store, safety policy) on ``app.state`` at startup.
- Routes.
- Optional seed-on-boot.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.hub import HubServices
from app.api.dependencies import get_app_settings  # noqa: F401  (re-export for tests)
from app.api.routes import (
    eval as eval_routes,
    exercises as exercises_routes,
    graph as graph_routes,
    health as health_routes,
    ingest as ingest_routes,
    members as members_routes,
    metrics as metrics_routes,
    prompts as prompts_routes,
    retrieve as retrieve_routes,
    safety as safety_routes,
    sessions as sessions_routes,
    settings as settings_routes,
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
    try:
        llm = build_llm(settings)
    except Exception as exc:  # noqa: BLE001 - missing key shouldn't crash boot; fall back to fake
        from app.llm.fake import FakeLLM

        log.warning("llm.build_failed", provider=settings.llm_provider, error=str(exc))
        llm = FakeLLM(model_id=settings.llm_model)
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
    app.state.sessions = {}
    # Runtime-mutable LLM config (the Settings screen edits this; key held in-process only).
    app.state.llm_runtime = {
        "provider": settings.llm_provider,
        "model": settings.llm_model,
        "temperature": settings.llm_temperature,
        "max_tokens": settings.llm_max_tokens,
    }
    app.state.llm_keys = {
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
    }

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
    # CORS: open for the synthetic-data demo (separate Vite dev server, no auth).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_routes.router)
    app.include_router(settings_routes.router)
    app.include_router(members_routes.router)
    app.include_router(exercises_routes.router)
    app.include_router(ingest_routes.router)
    app.include_router(retrieve_routes.router)
    app.include_router(graph_routes.router)
    app.include_router(traces_routes.router)
    app.include_router(prompts_routes.router)
    app.include_router(safety_routes.router)
    app.include_router(metrics_routes.router)
    app.include_router(eval_routes.router)
    app.include_router(sessions_routes.router)

    _mount_frontend(app)
    return app


def _mount_frontend(app: FastAPI) -> None:
    """Serve the built Vite SPA if present (single-service production image).

    The static dir is populated by the Docker build (``web/dist`` -> ``app/static``).
    Mounted last so every API route above takes precedence. No-op in dev/tests
    when the build is absent.
    """
    static_dir = Path(__file__).parent / "static"
    index = static_dir / "index.html"
    if not index.exists():
        return

    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    assets = static_dir / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/", include_in_schema=False)
    async def _index() -> FileResponse:  # pragma: no cover - thin static handler
        return FileResponse(str(index))

    @app.get("/{full_path:path}", include_in_schema=False)
    async def _spa_fallback(full_path: str) -> FileResponse:  # pragma: no cover
        candidate = static_dir / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(index))


app = create_app()


def cli() -> None:
    """Convenience: ``coach-kg`` runs the dev server."""
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
