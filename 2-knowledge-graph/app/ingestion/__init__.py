"""Ingestion — exercises, members, signals, bulk seed."""

from app.ingestion.exercises import load_exercises, ingest_exercises
from app.ingestion.members import (
    SYNTHETIC_PERSONAS,
    SyntheticPersona,
    create_member,
    ingest_member,
)
from app.ingestion.seed import seed_demo
from app.ingestion.signals import SignalExtractor, ingest_signal

__all__ = [
    "SYNTHETIC_PERSONAS",
    "SignalExtractor",
    "SyntheticPersona",
    "create_member",
    "ingest_exercises",
    "ingest_member",
    "ingest_signal",
    "load_exercises",
    "seed_demo",
]
