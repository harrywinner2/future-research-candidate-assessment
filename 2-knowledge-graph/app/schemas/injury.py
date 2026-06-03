"""Injury / condition schema."""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import Lineage, utcnow


class JointArea(str, Enum):
    """Joints we reason about. Aligned with ``joints_loaded`` values in exercises.json.

    Names are intentionally simple so that they can later be mapped to SNOMED
    or FMA concept ids without a schema rewrite.
    """

    SHOULDER = "shoulder"
    ELBOW = "elbow"
    WRIST = "wrist"
    HIP = "hip"
    KNEE = "knee"
    ANKLE = "ankle"
    CERVICAL_SPINE = "cervical spine"
    THORACIC_SPINE = "thoracic spine"
    LUMBAR_SPINE = "lumbar spine"


class InjuryStatus(str, Enum):
    ACTIVE = "active"
    IMPROVING = "improving"
    RESOLVED = "resolved"


class Injury(BaseModel):
    id: str
    label: str = Field(description="Human description, e.g. 'right knee pain after lunges'.")
    joints: List[JointArea] = Field(
        default_factory=list,
        description="Joints affected; empty triggers a 'no mapped joint' warning.",
    )
    severity: int = Field(default=2, ge=1, le=5)
    status: InjuryStatus = InjuryStatus.ACTIVE
    contraindicated_patterns: List[str] = Field(default_factory=list)
    noted_at: str = Field(default_factory=lambda: utcnow().date().isoformat())
    source_signal_id: Optional[str] = None
    lineage: Optional[Lineage] = None
