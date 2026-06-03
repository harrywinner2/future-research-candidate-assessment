"""Workout log entries — output of the workout logger sub-agent."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ConfidenceLevel, utcnow


class WorkoutLogEntry(BaseModel):
    """One exercise's worth of logged work."""

    exercise_id: Optional[str] = Field(
        default=None,
        description="Resolved dataset id; null when fuzzy match could not be confidently made.",
    )
    exercise_name_raw: str = Field(description="What the user typed.")
    exercise_name_matched: Optional[str] = None
    match_confidence: ConfidenceLevel = ConfidenceLevel.LOW
    match_candidates: List[str] = Field(
        default_factory=list,
        description="Alternative dataset ids when the match is ambiguous.",
    )
    sets: Optional[int] = None
    reps: Optional[int] = None
    weight: Optional[float] = None
    weight_unit: Optional[str] = None
    duration_seconds: Optional[float] = None
    missing_fields: List[str] = Field(default_factory=list)


class WorkoutLog(BaseModel):
    id: str
    member_id: str
    raw_text: str
    entries: List[WorkoutLogEntry]
    logged_at: str = Field(default_factory=lambda: utcnow().isoformat())
