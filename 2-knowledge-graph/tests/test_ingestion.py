"""Ingestion: exercises, members, chat signals."""

from __future__ import annotations

import pytest

from app.graph.queries import (
    all_exercises,
    all_members,
    member_active_injuries,
    member_contraindicated_joints,
)
from app.ingestion.exercises import ingest_exercises, load_exercises
from app.ingestion.members import SYNTHETIC_PERSONAS, create_member, ingest_member
from app.ingestion.signals import SignalExtractor, ingest_signal
from app.llm.fake import FakeLLM


@pytest.mark.asyncio
async def test_exercise_ingestion_creates_joints_and_equipment(graph) -> None:
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "exercises.json"
    exercises = load_exercises(path)
    await ingest_exercises(graph, exercises)
    nodes = await all_exercises(graph)
    assert len(nodes) == len(exercises)


@pytest.mark.asyncio
async def test_member_ingestion_creates_injury_and_joint(graph) -> None:
    persona = SYNTHETIC_PERSONAS[0]
    member = create_member(persona)
    await ingest_member(graph, member)
    injuries = await member_active_injuries(graph, member.id)
    assert injuries, "Member should have at least one active injury."
    joints = await member_contraindicated_joints(graph, member.id)
    assert "knee" in joints


@pytest.mark.asyncio
async def test_signal_extractor_creates_injury_from_chat(seeded_graph, member_id) -> None:
    extractor = SignalExtractor(FakeLLM())
    text = "My shoulder felt really tight after presses yesterday."
    sig = await ingest_signal(seeded_graph, extractor, member_id, text)
    assert sig.id
    # Heuristic FakeLLM proposes an Injury for shoulder.
    contraindicated = await member_contraindicated_joints(seeded_graph, member_id)
    assert "shoulder" in contraindicated


@pytest.mark.asyncio
async def test_privacy_check_blocks_real_looking_email(seeded_graph, member_id) -> None:
    extractor = SignalExtractor(FakeLLM())
    sig = await ingest_signal(
        seeded_graph,
        extractor,
        member_id,
        "Reach me at john.doe@gmail.com if anything changes.",
    )
    assert any(f.kind == "PrivacyRejection" for f in sig.extracted_facts)
