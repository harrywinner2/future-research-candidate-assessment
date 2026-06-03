"""Shared primitives used across schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SafetyStatus(str, Enum):
    """Member-relative safety classification for an exercise."""

    SAFE = "safe"
    CAUTION = "caution"
    EXCLUDED = "excluded"
    UNKNOWN = "unknown"


class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Lineage(BaseModel):
    """Where a fact came from. Attached to every node and edge.

    The Why Explanation drawer reads this directly so a coach can always
    trace a recommendation back to the form, chat snippet, or rule that
    created the underlying fact.
    """

    source: str = Field(description="Form name, signal type, or rule id.")
    source_id: Optional[str] = Field(default=None, description="Originating record id when known.")
    created_at: datetime = Field(default_factory=utcnow)
    ingester: str = Field(default="manual", description="Who/what created the fact.")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
