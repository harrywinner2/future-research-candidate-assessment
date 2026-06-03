"""Shared FastAPI dependency providers.

The app stores singletons on ``app.state`` at startup; these dependencies just
read them out. This keeps the routes free of singleton plumbing.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import Depends, Request

from app.agents.hub import HubServices
from app.config import Settings, get_settings
from app.graph.client import GraphClient
from app.llm.client import LLMClient
from app.observability.trace import TraceStore
from app.retrieval.embeddings import Embedder
from app.retrieval.graph_rag import GraphRAG
from app.retrieval.vector_store import VectorStore
from app.safety.policy import SafetyPolicy


if TYPE_CHECKING:
    pass


def get_graph_client(request: Request) -> GraphClient:
    return request.app.state.graph


def get_vector_store(request: Request) -> VectorStore:
    return request.app.state.vectors


def get_embedder(request: Request) -> Embedder:
    return request.app.state.embedder


def get_llm(request: Request) -> LLMClient:
    return request.app.state.llm


def get_rag(request: Request) -> GraphRAG:
    return request.app.state.rag


def get_policy(request: Request) -> SafetyPolicy:
    return request.app.state.policy


def get_trace_store(request: Request) -> TraceStore:
    return request.app.state.traces


def get_services(request: Request) -> HubServices:
    return request.app.state.services


def get_app_settings(settings: Settings = Depends(get_settings)) -> Settings:
    return settings
