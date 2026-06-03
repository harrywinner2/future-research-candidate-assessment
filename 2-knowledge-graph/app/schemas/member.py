"""Member, goals, preferences, equipment."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.injury import Injury


class Goal(BaseModel):
    label: str
    priority: int = Field(default=2, ge=1, le=5)


class Preference(BaseModel):
    label: str
    polarity: str = Field(default="prefer", description="'prefer' or 'avoid'.")


class Equipment(BaseModel):
    name: str


class Member(BaseModel):
    """Synthetic member. Real personal data is not allowed — see the privacy banner."""

    id: str
    name: str = Field(description="Synthetic label; never a real person.")
    persona: Optional[str] = Field(
        default=None,
        description="Short persona descriptor (e.g. 'returning runner, mid-30s, knee history').",
    )
    age_range: Optional[str] = None
    training_days_per_week: int = Field(default=3, ge=1, le=7)
    skill_level: str = Field(default="intermediate")
    goals: List[Goal] = Field(default_factory=list)
    preferences: List[Preference] = Field(default_factory=list)
    equipment: List[Equipment] = Field(default_factory=list)
    injuries: List[Injury] = Field(default_factory=list)
    notes: Optional[str] = None
