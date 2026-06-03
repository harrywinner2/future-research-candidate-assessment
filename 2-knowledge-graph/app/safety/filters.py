"""Exercise filter — applies a ``SafetyPolicy`` against a member's graph context."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Set

from app.graph.client import GraphClient
from app.graph.queries import (
    exercise_equipment,
    exercise_joints,
    explain_path,
    find_bilateral_pair,
    member_active_injuries,
    member_contraindicated_joints,
    member_equipment,
)
from app.graph.schema import NodeType
from app.safety.policy import (
    BilateralRule,
    JointRule,
    SafetyPolicy,
    UnknownDataPolicy,
)
from app.schemas.common import SafetyStatus


@dataclass
class SafetyDecision:
    exercise_id: str
    status: SafetyStatus
    reason: Optional[str] = None
    rule: Optional[str] = None
    graph_path: Optional[str] = None


class ExerciseFilter:
    """Stateless evaluator. One instance per request."""

    def __init__(self, graph: GraphClient, policy: SafetyPolicy) -> None:
        self.graph = graph
        self.policy = policy

    async def evaluate(self, exercise_id: str, member_id: str) -> SafetyDecision:
        joints = set(await exercise_joints(self.graph, exercise_id))
        contraindicated = await member_contraindicated_joints(self.graph, member_id)
        equipment_needed = set(await exercise_equipment(self.graph, exercise_id))
        equipment_available = set(await member_equipment(self.graph, member_id))

        # 1. Joint conflict
        overlap = joints & contraindicated
        if overlap:
            joint = sorted(overlap)[0]
            if self.policy.contraindicated_joint_rule == JointRule.EXCLUDE:
                return SafetyDecision(
                    exercise_id=exercise_id,
                    status=SafetyStatus.EXCLUDED,
                    reason=f"Loads {joint}; member has an active injury affecting {joint}.",
                    rule="contraindicated_joint_rule=exclude",
                    graph_path=explain_path(
                        "Member", "HAS_INJURY", "Injury", "AFFECTS_JOINT", joint, "LOADED_BY", "Exercise"
                    ),
                )
            if self.policy.contraindicated_joint_rule == JointRule.CAUTION:
                return SafetyDecision(
                    exercise_id=exercise_id,
                    status=SafetyStatus.CAUTION,
                    reason=f"Loads {joint}; member has an active injury affecting {joint}.",
                    rule="contraindicated_joint_rule=caution",
                )

        # 2. Equipment availability
        if self.policy.require_equipment_match and equipment_needed and not equipment_needed.issubset(equipment_available):
            missing = sorted(equipment_needed - equipment_available)
            return SafetyDecision(
                exercise_id=exercise_id,
                status=SafetyStatus.EXCLUDED,
                reason=f"Requires unavailable equipment: {', '.join(missing)}.",
                rule="require_equipment_match=true",
            )

        # 3. Missing joint data
        if not joints:
            if self.policy.unknown_data == UnknownDataPolicy.EXCLUDED:
                return SafetyDecision(
                    exercise_id=exercise_id,
                    status=SafetyStatus.EXCLUDED,
                    reason="Joint loading data missing for this exercise.",
                    rule="unknown_data=excluded",
                )
            if self.policy.unknown_data == UnknownDataPolicy.CAUTION:
                return SafetyDecision(
                    exercise_id=exercise_id,
                    status=SafetyStatus.CAUTION,
                    reason="Joint loading data missing for this exercise.",
                    rule="unknown_data=caution",
                )

        # 4. Bilateral pair sweep — if the pair is contraindicated, defer to bilateral_rule.
        pair = await find_bilateral_pair(self.graph, exercise_id)
        if pair:
            pair_joints = set(await exercise_joints(self.graph, pair))
            if pair_joints & contraindicated and self.policy.bilateral_rule == BilateralRule.EXCLUDE_BOTH:
                return SafetyDecision(
                    exercise_id=exercise_id,
                    status=SafetyStatus.EXCLUDED,
                    reason="Bilateral pair loads a contraindicated joint.",
                    rule="bilateral_rule=exclude_both",
                )
            if pair_joints & contraindicated and self.policy.bilateral_rule == BilateralRule.CAUTION_OTHER_SIDE:
                return SafetyDecision(
                    exercise_id=exercise_id,
                    status=SafetyStatus.CAUTION,
                    reason="Bilateral pair loads a contraindicated joint.",
                    rule="bilateral_rule=caution_other_side",
                )

        return SafetyDecision(exercise_id=exercise_id, status=SafetyStatus.SAFE)

    async def batch_evaluate(
        self, exercise_ids: List[str], member_id: str
    ) -> List[SafetyDecision]:
        return [await self.evaluate(eid, member_id) for eid in exercise_ids]

    async def exclusion_set(self, member_id: str, exercise_ids: List[str]) -> Set[str]:
        decisions = await self.batch_evaluate(exercise_ids, member_id)
        return {d.exercise_id for d in decisions if d.status == SafetyStatus.EXCLUDED}

    async def member_summary(self, member_id: str) -> dict:
        """Snapshot used in trace records and the API."""
        injuries = await member_active_injuries(self.graph, member_id)
        contraindicated = await member_contraindicated_joints(self.graph, member_id)
        equipment = await member_equipment(self.graph, member_id)
        return {
            "active_injuries": [i.properties.get("label", i.key) for i in injuries],
            "contraindicated_joints": sorted(contraindicated),
            "available_equipment": sorted(equipment),
            "policy_version": self.policy.version,
            "policy_level": self.policy.level,
        }
