"""Standalone seed script.

Usage:

    python -m scripts.seed
"""

from __future__ import annotations

import asyncio

from app.config import get_settings
from app.ingestion.seed import seed_demo
from app.llm.client import build_llm
from app.main import _build_graph_client
from app.retrieval.embeddings import build_embedder
from app.retrieval.vector_store import InMemoryVectorStore


async def main() -> None:
    settings = get_settings()
    graph = _build_graph_client(settings)
    await graph.initialize()
    try:
        vectors = InMemoryVectorStore()
        embedder = build_embedder(settings)
        llm = build_llm(settings)
        result = await seed_demo(
            graph=graph,
            vectors=vectors,
            embedder=embedder,
            llm=llm,
            exercises_path=settings.exercises_path,
        )
        print("seed:", result)
    finally:
        await graph.close()


if __name__ == "__main__":
    asyncio.run(main())
