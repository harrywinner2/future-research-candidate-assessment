"""Vector store backed by Python dicts.

A real deployment would swap in a Neo4j vector index or pgvector here; the
``VectorStore`` Protocol is small enough that the swap is mechanical.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol, Tuple

from app.retrieval.embeddings import Embedder, cosine


@dataclass
class VectorRecord:
    id: str
    text: str
    embedding: List[float]
    metadata: Dict[str, Any]


class VectorStore(Protocol):
    async def upsert(self, record: VectorRecord) -> None: ...
    async def upsert_many(self, records: List[VectorRecord]) -> None: ...
    async def search(
        self, embedding: List[float], k: int = 8, namespace: Optional[str] = None
    ) -> List[Tuple[VectorRecord, float]]: ...
    async def delete(self, id: str) -> bool: ...
    async def reset(self) -> None: ...


class InMemoryVectorStore:
    """O(N) cosine-similarity scan. Plenty for ~thousands of vectors; trivial to swap."""

    def __init__(self) -> None:
        self._records: Dict[str, VectorRecord] = {}

    async def upsert(self, record: VectorRecord) -> None:
        self._records[record.id] = record

    async def upsert_many(self, records: List[VectorRecord]) -> None:
        for r in records:
            self._records[r.id] = r

    async def search(
        self, embedding: List[float], k: int = 8, namespace: Optional[str] = None
    ) -> List[Tuple[VectorRecord, float]]:
        scored: List[Tuple[VectorRecord, float]] = []
        for record in self._records.values():
            if namespace and record.metadata.get("namespace") != namespace:
                continue
            scored.append((record, cosine(embedding, record.embedding)))
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return scored[:k]

    async def delete(self, id: str) -> bool:
        return self._records.pop(id, None) is not None

    async def reset(self) -> None:
        self._records.clear()

    @staticmethod
    def from_texts(
        embedder: Embedder, items: List[Tuple[str, str, Dict[str, Any]]]
    ) -> "InMemoryVectorStore":
        """Helper for seeding: items is a list of (id, text, metadata)."""
        store = InMemoryVectorStore()
        for rid, text, meta in items:
            store._records[rid] = VectorRecord(
                id=rid, text=text, embedding=embedder.embed(text), metadata=meta
            )
        return store
