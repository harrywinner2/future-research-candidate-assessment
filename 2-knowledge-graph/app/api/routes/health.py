"""Liveness + settings introspection."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.dependencies import get_app_settings, get_graph_client, get_policy
from app.config import Settings
from app.graph.client import GraphClient
from app.graph.schema import SCHEMA_VERSION
from app.safety.policy import SafetyPolicy

router = APIRouter()


@router.get("/health")
async def health(graph: GraphClient = Depends(get_graph_client)) -> dict[str, Any]:
    ok = await graph.healthcheck()
    return {"status": "ok" if ok else "degraded", "graph": ok, "schema_version": SCHEMA_VERSION}


@router.get("/settings")
async def settings_view(
    settings: Settings = Depends(get_app_settings),
    policy: SafetyPolicy = Depends(get_policy),
) -> dict[str, Any]:
    return {
        "graph_backend": settings.graph_backend,
        "llm": {
            "provider": settings.llm_provider,
            "model": settings.llm_model,
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens,
        },
        "embeddings": {
            "provider": settings.embeddings_provider,
            "model": settings.embeddings_model,
            "dimension": settings.embeddings_dimension,
        },
        "retrieval": {
            "top_k": settings.retrieval_top_k,
            "graph_depth": settings.retrieval_graph_depth,
            "max_context_tokens": settings.retrieval_max_context_tokens,
        },
        "safety": {"level": policy.level, "version": policy.version},
        "validator": {
            "strict": settings.validator_strict,
            "max_retries": settings.validator_max_retries,
        },
        "schema_version": SCHEMA_VERSION,
    }
