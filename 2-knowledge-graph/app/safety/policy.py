"""Configurable, versioned safety policy.

The Safety Policy Editor screen described in ``screens.md`` is a UI for the
``SafetyPolicy`` object. Every recommendation records the policy version it
was generated against; ``app/observability/trace.py`` writes that into the
trace stage.

The four built-in levels (lenient, standard, strict, max) are exposed in
``POLICY_REGISTRY``. A coach can swap levels via the ``/settings`` route or
edit individual rules via ``/settings/safety`` (the editor surface).
"""

from __future__ import annotations

from enum import Enum
from typing import Dict

from pydantic import BaseModel, Field

from app.config import SafetyLevel


class UnknownDataPolicy(str, Enum):
    """How to classify an exercise with empty ``joints_loaded``."""

    SAFE = "safe"
    CAUTION = "caution"
    EXCLUDED = "excluded"


class JointRule(str, Enum):
    EXCLUDE = "exclude"
    CAUTION = "caution"
    ALLOW_REDUCED = "allow_with_reduced_load"


class BilateralRule(str, Enum):
    EXCLUDE_BOTH = "exclude_both"
    CAUTION_OTHER_SIDE = "caution_other_side"
    ALLOW_OTHER_SIDE = "allow_other_side"


class SafetyRule(BaseModel):
    """One slice of policy. Pretty-prints in the editor."""

    name: str
    description: str
    enabled: bool = True


class SafetyPolicy(BaseModel):
    """Frozen-on-write safety configuration.

    Mutate via :meth:`with_overrides` so the version bumps with each change.
    """

    level: SafetyLevel
    version: str
    contraindicated_joint_rule: JointRule = JointRule.EXCLUDE
    bilateral_rule: BilateralRule = BilateralRule.EXCLUDE_BOTH
    unknown_data: UnknownDataPolicy = UnknownDataPolicy.CAUTION
    require_equipment_match: bool = True
    fade_resolved_injury_after_sessions: int = 6
    rules: Dict[str, SafetyRule] = Field(default_factory=dict)

    def with_overrides(self, **kwargs: object) -> "SafetyPolicy":
        merged = self.model_dump()
        merged.update(kwargs)
        bumped = _bump_version(self.version)
        merged["version"] = bumped
        return SafetyPolicy(**merged)  # type: ignore[arg-type]


def _bump_version(version: str) -> str:
    try:
        major, minor, patch = version.split(".")
        return f"{major}.{minor}.{int(patch) + 1}"
    except ValueError:
        return "1.0.1"


def default_policy() -> SafetyPolicy:
    return POLICY_REGISTRY["standard"]


def _lenient() -> SafetyPolicy:
    return SafetyPolicy(
        level="lenient",
        version="lenient-1.0.0",
        contraindicated_joint_rule=JointRule.CAUTION,
        bilateral_rule=BilateralRule.ALLOW_OTHER_SIDE,
        unknown_data=UnknownDataPolicy.SAFE,
        require_equipment_match=False,
        fade_resolved_injury_after_sessions=2,
    )


def _standard() -> SafetyPolicy:
    return SafetyPolicy(
        level="standard",
        version="standard-1.0.0",
        contraindicated_joint_rule=JointRule.EXCLUDE,
        bilateral_rule=BilateralRule.EXCLUDE_BOTH,
        unknown_data=UnknownDataPolicy.CAUTION,
        require_equipment_match=True,
        fade_resolved_injury_after_sessions=6,
    )


def _strict() -> SafetyPolicy:
    return SafetyPolicy(
        level="strict",
        version="strict-1.0.0",
        contraindicated_joint_rule=JointRule.EXCLUDE,
        bilateral_rule=BilateralRule.EXCLUDE_BOTH,
        unknown_data=UnknownDataPolicy.EXCLUDED,
        require_equipment_match=True,
        fade_resolved_injury_after_sessions=12,
    )


def _max() -> SafetyPolicy:
    return SafetyPolicy(
        level="max",
        version="max-1.0.0",
        contraindicated_joint_rule=JointRule.EXCLUDE,
        bilateral_rule=BilateralRule.EXCLUDE_BOTH,
        unknown_data=UnknownDataPolicy.EXCLUDED,
        require_equipment_match=True,
        fade_resolved_injury_after_sessions=99,
    )


POLICY_REGISTRY: Dict[str, SafetyPolicy] = {
    "lenient": _lenient(),
    "standard": _standard(),
    "strict": _strict(),
    "max": _max(),
}
