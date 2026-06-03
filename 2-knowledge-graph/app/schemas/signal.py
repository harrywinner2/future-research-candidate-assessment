"""Context signals — chat snippets, transcripts, coach notes, biometric summaries."""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import Lineage, utcnow


class SignalType(str, Enum):
    CHAT = "chat"
    TRANSCRIPT = "transcript"
    COACH_NOTE = "coach_note"
    BIOMETRIC = "biometric"


class ExtractedFact(BaseModel):
    """Proposed graph fact produced by the signal extractor."""

    kind: str = Field(description="Node or edge kind, e.g. 'Injury', 'AFFECTS_JOINT'.")
    payload: dict = Field(default_factory=dict)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    rationale: Optional[str] = None


class ContextSignal(BaseModel):
    id: str
    member_id: str
    signal_type: SignalType = SignalType.CHAT
    text: str
    captured_at: str = Field(default_factory=lambda: utcnow().isoformat())
    extracted_facts: List[ExtractedFact] = Field(default_factory=list)
    lineage: Optional[Lineage] = None
