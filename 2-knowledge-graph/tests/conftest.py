"""Shared fixtures.

The full test suite runs offline:

- ``graph`` is the in-memory backend.
- ``llm`` is the deterministic FakeLLM.
- ``embedder`` is the hash embedder (no model download).
"""

from __future__ import annotations

from pathlib import Path
from typing import AsyncIterator

import pytest
import pytest_asyncio

from app.agents.hub import HubServices
from app.config import get_settings
from app.graph.client import GraphClient
from app.graph.memory_client import InMemoryGraphClient
from app.ingestion.exercises import ingest_exercises, load_exercises
from app.ingestion.members import (
    SYNTHETIC_PERSONAS,
    create_member,
    ingest_member,
)
from app.llm.client import LLMClient
from app.llm.fake import FakeLLM
from app.observability.trace import TraceStore
from app.retrieval.embeddings import HashEmbedder
from app.retrieval.graph_rag import GraphRAG
from app.retrieval.vector_store import InMemoryVectorStore, VectorRecord
from app.safety.policy import POLICY_REGISTRY


EXERCISES_PATH = Path(__file__).resolve().parents[1] / "exercises.json"


@pytest_asyncio.fixture
async def graph() -> AsyncIterator[GraphClient]:
    g = InMemoryGraphClient()
    await g.initialize()
    yield g
    await g.close()


@pytest.fixture
def llm() -> LLMClient:
    return FakeLLM()


@pytest.fixture
def embedder() -> HashEmbedder:
    return HashEmbedder(dimension=128)


@pytest_asyncio.fixture
async def seeded_graph(graph: GraphClient, embedder: HashEmbedder) -> GraphClient:
    """Graph populated with exercises + one persona (Synth-Alex)."""
    exercises = load_exercises(EXERCISES_PATH)
    await ingest_exercises(graph, exercises)
    persona = SYNTHETIC_PERSONAS[0]  # Synth-Alex with knee history
    member = create_member(persona)
    await ingest_member(graph, member)
    return graph


@pytest_asyncio.fixture
async def vectors(seeded_graph: GraphClient, embedder: HashEmbedder) -> InMemoryVectorStore:
    """Vector store seeded with exercise docs from the graph."""
    from app.graph.queries import all_exercises

    store = InMemoryVectorStore()
    nodes = await all_exercises(seeded_graph)
    records = []
    for n in nodes:
        text = n.properties.get("name", n.key)
        records.append(
            VectorRecord(
                id=n.key,
                text=text,
                embedding=embedder.embed(text),
                metadata={"namespace": "exercise", "node_type": "Exercise", "node_key": n.key},
            )
        )
    await store.upsert_many(records)
    return store


@pytest_asyncio.fixture
async def rag(seeded_graph: GraphClient, vectors: InMemoryVectorStore, embedder: HashEmbedder) -> GraphRAG:
    return GraphRAG(graph=seeded_graph, vectors=vectors, embedder=embedder)


@pytest.fixture
def policy():
    return POLICY_REGISTRY["standard"]


@pytest_asyncio.fixture
async def services(seeded_graph: GraphClient, llm: LLMClient, rag: GraphRAG, policy) -> HubServices:
    return HubServices(llm=llm, graph=seeded_graph, rag=rag, policy=policy)


@pytest.fixture
def trace_store() -> TraceStore:
    return TraceStore(retention=50)


@pytest_asyncio.fixture
async def member_id(seeded_graph: GraphClient) -> str:
    return create_member(SYNTHETIC_PERSONAS[0]).id
