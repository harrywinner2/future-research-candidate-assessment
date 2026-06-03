"""Exercise schema — mirrors ``exercises.json``."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class Exercise(BaseModel):
    """One row from ``exercises.json``."""

    id: str
    name: str
    muscle_groups: List[str] = Field(default_factory=list)
    joints_loaded: List[str] = Field(default_factory=list)
    movement_patterns: List[str] = Field(default_factory=list)
    equipment_required: List[str] = Field(default_factory=list)
    is_bilateral: bool = False
    side: Optional[str] = None
    priority_tier: int = 3
    is_reps: bool = True
    is_duration: bool = False
    supports_weight: bool = True
    estimated_rep_duration: float = 1.0
    bilateral_pair_id: Optional[str] = None

    def joint_data_missing(self) -> bool:
        """True when joints_loaded is empty — should be treated as 'unknown', not 'safe'."""
        return not self.joints_loaded


class ExerciseRef(BaseModel):
    """Lightweight reference used in recommendation payloads."""

    id: str
    name: str
