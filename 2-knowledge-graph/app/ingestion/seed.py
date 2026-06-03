"""End-to-end demo seed: exercises + synthetic personas + a sample signal."""

from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

from app.graph.client import GraphClient
from app.ingestion.exercises import ingest_exercises, load_exercises
from app.ingestion.members import (
    SYNTHETIC_PERSONAS,
    create_member,
    ingest_member,
)
from app.ingestion.signals import SignalExtractor, ingest_signal
from app.llm.client import LLMClient
from app.retrieval.embeddings import Embedder
from app.retrieval.vector_store import VectorRecord, VectorStore


async def seed_demo(
    *,
    graph: GraphClient,
    vectors: VectorStore,
    embedder: Embedder,
    llm: LLMClient,
    exercises_path: Path,
) -> dict:
    """Idempotent. Returns counts so the API/UI can show ingestion stats."""
    exercises = load_exercises(exercises_path)
    n_ex = await ingest_exercises(graph, exercises)

    member_ids: List[str] = []
    for persona in SYNTHETIC_PERSONAS:
        member = create_member(persona)
        await ingest_member(graph, member)
        member_ids.append(member.id)

    extractor = SignalExtractor(llm)
    # One illustrative signal on the first persona.
    await ingest_signal(
        graph,
        extractor,
        member_id=member_ids[0],
        text="My right knee felt a bit off again after lunges last session — sharp on the descent.",
    )

    # Vector seed: each exercise gets a doc; each persona gets a doc.
    vector_records: List[Tuple[str, str, dict]] = []
    for ex in exercises:
        text = " ".join(
            [ex.name]
            + ex.muscle_groups
            + ex.movement_patterns
            + ex.joints_loaded
            + ex.equipment_required
        )
        vector_records.append(
            (ex.id, text, {"namespace": "exercise", "node_type": "Exercise", "node_key": ex.id})
        )
    for mid in member_ids:
        vector_records.append((mid, mid, {"namespace": "member", "node_type": "Member", "node_key": mid}))

    records = [
        VectorRecord(id=rid, text=text, embedding=embedder.embed(text), metadata=meta)
        for rid, text, meta in vector_records
    ]
    await vectors.upsert_many(records)

    return {"exercises": n_ex, "members": len(member_ids), "vector_records": len(records)}
