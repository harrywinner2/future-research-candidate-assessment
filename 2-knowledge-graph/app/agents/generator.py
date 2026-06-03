"""Workout generator sub-agent.

Pipeline:

1. Call ``search_exercises`` with constraints derived from the request and the
   retrieval context (muscle, equipment, exclusion list).
2. Ask the LLM for a structured ``GeneratedWorkout`` referencing only candidate ids.
3. Hand off to the validator for correction / exclusion bookkeeping.
"""

from __future__ import annotations

import uuid
from typing import List

from pydantic import BaseModel, Field

from app.agents.prompts import GENERATOR, render
from app.agents.state import HubState
from app.agents.tools import SearchExerciseHit, SearchExercisesInput, search_exercises
from app.graph.client import GraphClient
from app.graph.schema import NodeType
from app.llm.client import LLMClient
from app.observability.trace import with_stage
from app.safety.policy import SafetyPolicy
from app.safety.validator import RecommendationValidator
from app.schemas.exercise import ExerciseRef
from app.schemas.recommendation import (
    GeneratedExercise,
    Recommendation,
    RecommendationSection,
    SafetyExclusion,
    ValidationReport,
)
from app.schemas.retrieval import RetrievalContext
from app.schemas.trace import StageType


class _GeneratedExerciseRef(BaseModel):
    exercise_id: str
    sets: int | None = None
    reps: int | None = None
    duration_seconds: float | None = None
    rest_seconds: float | None = None
    load_target: str | None = None
    notes: str | None = None


class _GeneratedSection(BaseModel):
    name: str
    exercises: List[_GeneratedExerciseRef] = Field(default_factory=list)


class GeneratedWorkout(BaseModel):
    summary: str
    sections: List[_GeneratedSection] = Field(default_factory=list)


async def generate(
    state: HubState,
    *,
    llm: LLMClient,
    graph: GraphClient,
    policy: SafetyPolicy,
    context: RetrievalContext,
    max_retries: int = 2,
) -> HubState:
    if not state.member_id:
        return state.add_note("generator: skipped — no member_id provided.")

    muscle_hints = _infer_muscles(state.request)
    pattern_hints = _infer_patterns(state.request)

    async with with_stage(
        "generator:search",
        StageType.GENERATE,
        inputs={"request": state.request},
    ) as stage:
        hits = await search_exercises(
            graph,
            SearchExercisesInput(
                muscle_groups=muscle_hints,
                movement_patterns=pattern_hints,
                equipment_available=context.available_equipment,
                excluded_joints=[],  # exclusion handled via id-list below
                exclude_ids=context.exclusion_list,
                limit=12,
            ),
        )
        stage.outputs = {"candidate_count": len(hits)}

    if not hits:
        return state.add_note(
            "generator: no candidates after applying safety filter; recovering with empty workout."
        )

    candidate_block = "\n".join(
        f"- ex_id:{h.exercise.id} | {h.exercise.name} | muscles={','.join(h.exercise.muscle_groups)} | equipment={','.join(h.exercise.equipment_required)}"
        for h in hits
    )

    rec = await _generate_once(
        state,
        llm=llm,
        graph=graph,
        policy=policy,
        context=context,
        candidate_block=candidate_block,
        hits=hits,
    )
    if rec.validation.passed:
        return state.model_copy(update={"recommendation": rec})

    retry = 0
    while retry < max_retries and not rec.validation.passed:
        retry += 1
        rec = await _generate_once(
            state.model_copy(update={"retry_count": retry}),
            llm=llm,
            graph=graph,
            policy=policy,
            context=context,
            candidate_block=candidate_block,
            hits=hits,
        )
    return state.model_copy(update={"recommendation": rec, "retry_count": retry})


async def _generate_once(
    state: HubState,
    *,
    llm: LLMClient,
    graph: GraphClient,
    policy: SafetyPolicy,
    context: RetrievalContext,
    candidate_block: str,
    hits: List[SearchExerciseHit],
) -> Recommendation:
    async with with_stage(
        "generator:llm",
        StageType.GENERATE,
        inputs={"request": state.request, "retry": state.retry_count},
        prompt_template_id=GENERATOR.id,
        prompt_template_version=GENERATOR.version,
        model_id=llm.model_id,
    ) as stage:
        prompt = render(
            GENERATOR,
            member_summary=context.member_summary,
            active_injuries=", ".join(context.active_injuries) or "none",
            available_equipment=", ".join(context.available_equipment) or "none",
            exclusion_list=", ".join(context.exclusion_list) or "none",
            candidates=candidate_block,
            request=state.request,
        )
        generated: GeneratedWorkout = await llm.structured_complete(prompt, GeneratedWorkout)
        stage.outputs = {"sections": len(generated.sections)}

    hit_index = {h.exercise.id: h.exercise for h in hits}
    sections: List[RecommendationSection] = []
    for section in generated.sections:
        items: List[GeneratedExercise] = []
        for ex_ref in section.exercises:
            exercise = hit_index.get(ex_ref.exercise_id)
            ref = ExerciseRef(
                id=ex_ref.exercise_id,
                name=exercise.name if exercise else ex_ref.exercise_id,
            )
            items.append(
                GeneratedExercise(
                    exercise=ref,
                    sets=ex_ref.sets,
                    reps=ex_ref.reps,
                    duration_seconds=ex_ref.duration_seconds,
                    rest_seconds=ex_ref.rest_seconds,
                    load_target=ex_ref.load_target,
                    notes=ex_ref.notes,
                )
            )
        sections.append(RecommendationSection(name=section.name, exercises=items))

    # Resolve human-readable names for the excluded ids (UUIDs in the graph).
    excluded_names: dict[str, str] = {}
    for eid in context.exclusion_list[:20]:
        cached = hit_index.get(eid)
        if cached:
            excluded_names[eid] = cached.name
            continue
        node = await graph.get_node(NodeType.EXERCISE, eid)
        excluded_names[eid] = node.properties.get("name", eid) if node else eid

    rec = Recommendation(
        id=str(uuid.uuid4()),
        member_id=state.member_id or "",
        request=state.request,
        summary=generated.summary,
        sections=sections,
        excluded=[
            SafetyExclusion(
                exercise=ExerciseRef(id=eid, name=excluded_names.get(eid, eid)),
                reason="In retrieval-time exclusion list.",
                rule="retrieval-filter",
            )
            for eid in context.exclusion_list[:20]
        ],
        validation=ValidationReport(passed=True),
        safety_policy_version=policy.version,
        prompt_template_versions={GENERATOR.id: GENERATOR.version},
        model_id=llm.model_id,
    )

    # Run validator
    validator = RecommendationValidator(graph, policy)
    outcome = await validator.validate(rec, state.member_id or "")
    return outcome.recommendation


# ----- naive intent helpers -----

_MUSCLE_VOCAB = {
    "lower": ["quads", "hamstrings", "glutes", "calves"],
    "leg": ["quads", "hamstrings", "glutes"],
    "upper": ["chest", "back", "deltoids", "triceps", "biceps"],
    "push": ["chest", "triceps", "deltoids"],
    "pull": ["back", "biceps"],
    "core": ["core"],
    "back": ["back"],
    "chest": ["chest"],
    "arm": ["biceps", "triceps"],
}

_PATTERN_VOCAB = {
    "press": ["upper push - horizontal", "upper push - vertical"],
    "squat": ["lower push - bilateral"],
    "deadlift": ["lower pull - bilateral"],
    "row": ["upper pull - horizontal"],
    "pull-up": ["upper pull - vertical"],
}


def _infer_muscles(text: str) -> List[str]:
    t = text.lower()
    out: List[str] = []
    for key, muscles in _MUSCLE_VOCAB.items():
        if key in t:
            out.extend(muscles)
    return list(dict.fromkeys(out))


def _infer_patterns(text: str) -> List[str]:
    t = text.lower()
    out: List[str] = []
    for key, patterns in _PATTERN_VOCAB.items():
        if key in t:
            out.extend(patterns)
    return list(dict.fromkeys(out))
