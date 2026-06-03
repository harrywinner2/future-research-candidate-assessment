"""Recommendation output — what the workout-generator sub-agent produces."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import SafetyStatus, utcnow
from app.schemas.exercise import ExerciseRef


class GeneratedExercise(BaseModel):
    """One exercise inside a recommended workout."""

    exercise: ExerciseRef
    sets: Optional[int] = None
    reps: Optional[int] = None
    duration_seconds: Optional[float] = None
    rest_seconds: Optional[float] = None
    load_target: Optional[str] = None
    notes: Optional[str] = None
    safety_status: SafetyStatus = SafetyStatus.SAFE
    safety_reason: Optional[str] = None
    why_included: Optional[str] = None
    graph_path: Optional[str] = Field(
        default=None,
        description="Short Cypher-like path used as evidence, e.g. "
        "'Member -> HAS_EQUIPMENT -> Dumbbell -> USES_EQUIPMENT <- Exercise'.",
    )


class RecommendationSection(BaseModel):
    """warmup / main / cooldown grouping."""

    name: str
    exercises: List[GeneratedExercise] = Field(default_factory=list)


class SafetyExclusion(BaseModel):
    exercise: ExerciseRef
    reason: str
    rule: str = Field(description="Which safety policy clause fired.")
    graph_path: Optional[str] = None


class ValidationReport(BaseModel):
    passed: bool
    issues: List[str] = Field(default_factory=list)
    corrections_applied: List[str] = Field(default_factory=list)
    unknown_exercise_ids: List[str] = Field(default_factory=list)
    contraindicated_exercises: List[str] = Field(default_factory=list)


class Recommendation(BaseModel):
    """Top-level recommendation, returned by ``POST /recommend``."""

    id: str
    member_id: str
    request: str
    generated_at: str = Field(default_factory=lambda: utcnow().isoformat())
    summary: str
    sections: List[RecommendationSection] = Field(default_factory=list)
    excluded: List[SafetyExclusion] = Field(default_factory=list)
    validation: ValidationReport
    safety_policy_version: str
    prompt_template_versions: dict = Field(default_factory=dict)
    model_id: str
    trace_id: Optional[str] = None
