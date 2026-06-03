"""Post-generation validator.

Runs after the workout-generator returns a structured recommendation. Catches:

- Unknown exercise ids (model hallucinated something not in the dataset).
- Contraindicated exercises that slipped past the prompt-time exclusion list.
- Exercises whose required equipment the member does not have.

When ``COACH_KG_VALIDATOR_STRICT=true`` (default), any contraindicated exercise
is *substituted* with a safe alternative when possible, otherwise the entire
section is flagged for regeneration.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.graph.client import GraphClient
from app.graph.queries import (
    all_exercises,
    exercise_joints,
    exercise_muscles,
    member_contraindicated_joints,
    member_equipment,
)
from app.graph.schema import NodeType
from app.safety.filters import ExerciseFilter
from app.safety.policy import SafetyPolicy
from app.schemas.common import SafetyStatus
from app.schemas.exercise import ExerciseRef
from app.schemas.recommendation import (
    GeneratedExercise,
    Recommendation,
    RecommendationSection,
    SafetyExclusion,
    ValidationReport,
)


@dataclass
class ValidatorOutcome:
    recommendation: Recommendation
    report: ValidationReport
    needs_regeneration: bool = False
    substitutions: Dict[str, str] = field(default_factory=dict)


class RecommendationValidator:
    def __init__(
        self,
        graph: GraphClient,
        policy: SafetyPolicy,
        strict: bool = True,
    ) -> None:
        self.graph = graph
        self.policy = policy
        self.strict = strict
        self.filter = ExerciseFilter(graph, policy)

    async def validate(
        self, recommendation: Recommendation, member_id: str
    ) -> ValidatorOutcome:
        report = ValidationReport(passed=True)
        substitutions: Dict[str, str] = {}
        contraindicated = await member_contraindicated_joints(self.graph, member_id)
        available_equip = set(await member_equipment(self.graph, member_id))

        # Cache all valid exercise ids once
        valid_exercises = await all_exercises(self.graph)
        valid_ids = {n.key for n in valid_exercises}

        new_sections: List[RecommendationSection] = []
        new_excluded: List[SafetyExclusion] = list(recommendation.excluded)

        for section in recommendation.sections:
            new_items: List[GeneratedExercise] = []
            for item in section.exercises:
                eid = item.exercise.id

                if eid not in valid_ids:
                    report.unknown_exercise_ids.append(eid)
                    report.issues.append(f"Unknown exercise id: {eid}")
                    if self.strict:
                        substitute = await self._find_substitute(item, member_id, contraindicated, available_equip)
                        if substitute:
                            substitutions[eid] = substitute.exercise.id
                            report.corrections_applied.append(
                                f"Replaced unknown {eid} with {substitute.exercise.name}"
                            )
                            new_items.append(substitute)
                        else:
                            report.passed = False
                    continue

                decision = await self.filter.evaluate(eid, member_id)
                if decision.status == SafetyStatus.EXCLUDED:
                    report.contraindicated_exercises.append(eid)
                    report.issues.append(
                        f"{item.exercise.name}: {decision.reason} ({decision.rule})"
                    )
                    new_excluded.append(
                        SafetyExclusion(
                            exercise=item.exercise,
                            reason=decision.reason or "contraindicated",
                            rule=decision.rule or "unknown",
                            graph_path=decision.graph_path,
                        )
                    )
                    if self.strict:
                        substitute = await self._find_substitute(item, member_id, contraindicated, available_equip)
                        if substitute:
                            substitutions[eid] = substitute.exercise.id
                            report.corrections_applied.append(
                                f"Replaced {item.exercise.name} with {substitute.exercise.name}"
                            )
                            new_items.append(substitute)
                        else:
                            report.passed = False
                    continue

                # Annotate safety inline so the UI can render badges.
                item = item.model_copy(
                    update={
                        "safety_status": decision.status,
                        "safety_reason": decision.reason,
                    }
                )
                new_items.append(item)

            new_sections.append(RecommendationSection(name=section.name, exercises=new_items))

        if report.issues and not report.corrections_applied:
            report.passed = False

        updated = recommendation.model_copy(
            update={"sections": new_sections, "excluded": new_excluded, "validation": report}
        )
        needs_regen = not report.passed and not report.corrections_applied
        return ValidatorOutcome(
            recommendation=updated,
            report=report,
            needs_regeneration=needs_regen,
            substitutions=substitutions,
        )

    async def _find_substitute(
        self,
        item: GeneratedExercise,
        member_id: str,
        contraindicated_joints: set[str],
        available_equip: set[str],
    ) -> Optional[GeneratedExercise]:
        """Pick a safe exercise that shares at least one muscle group with the offending one."""
        from app.graph.queries import all_exercises

        target_muscles = set(await exercise_muscles(self.graph, item.exercise.id))
        candidates = await all_exercises(self.graph)
        for node in candidates:
            if node.key == item.exercise.id:
                continue
            cand_muscles = set(await exercise_muscles(self.graph, node.key))
            if target_muscles and not (target_muscles & cand_muscles):
                continue
            decision = await self.filter.evaluate(node.key, member_id)
            if decision.status == SafetyStatus.SAFE:
                return item.model_copy(
                    update={
                        "exercise": ExerciseRef(id=node.key, name=node.properties.get("name", node.key)),
                        "safety_status": SafetyStatus.SAFE,
                        "safety_reason": "Substituted by validator from a safe alternative with the same muscle target.",
                        "why_included": f"Replaced {item.exercise.name}; validator selected this safe alternative.",
                    }
                )
        return None
