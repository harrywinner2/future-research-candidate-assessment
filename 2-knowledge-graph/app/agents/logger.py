"""Workout logger sub-agent."""

from __future__ import annotations

import uuid
from typing import List, Optional

from pydantic import BaseModel, Field

from app.agents.prompts import LOGGER, render
from app.agents.state import HubState
from app.agents.tools import FuzzyMatchInput, fuzzy_match_exercise
from app.graph.client import GraphClient
from app.graph.queries import all_exercises
from app.llm.client import LLMClient
from app.observability.trace import with_stage
from app.schemas.common import ConfidenceLevel
from app.schemas.trace import StageType
from app.schemas.workout import WorkoutLog, WorkoutLogEntry


class _RawEntry(BaseModel):
    exercise_name_raw: str
    sets: Optional[int] = None
    reps: Optional[int] = None
    weight: Optional[float] = None
    weight_unit: Optional[str] = None
    duration_seconds: Optional[float] = None


class ExtractedLogPayload(BaseModel):
    entries: List[_RawEntry] = Field(default_factory=list)


async def log_workout(state: HubState, *, llm: LLMClient, graph: GraphClient) -> HubState:
    if not state.member_id:
        return state.add_note("logger: skipped — no member_id provided.")

    exercise_nodes = await all_exercises(graph)
    candidate_block = "\n".join(
        f"- {n.key}: {n.properties.get('name', n.key)}" for n in exercise_nodes[:80]
    )

    async with with_stage(
        "logger:extract",
        StageType.LOG,
        inputs={"request": state.request},
        prompt_template_id=LOGGER.id,
        prompt_template_version=LOGGER.version,
        model_id=llm.model_id,
    ) as stage:
        prompt = render(LOGGER, candidates=candidate_block, request=state.request)
        payload: ExtractedLogPayload = await llm.structured_complete(prompt, ExtractedLogPayload)
        stage.outputs = {"raw_entries": len(payload.entries)}

    enriched: List[WorkoutLogEntry] = []
    for raw in payload.entries:
        matches = await fuzzy_match_exercise(
            graph, FuzzyMatchInput(query=raw.exercise_name_raw, limit=3)
        )
        if not matches:
            enriched.append(
                WorkoutLogEntry(
                    exercise_name_raw=raw.exercise_name_raw,
                    sets=raw.sets,
                    reps=raw.reps,
                    weight=raw.weight,
                    weight_unit=raw.weight_unit,
                    duration_seconds=raw.duration_seconds,
                    missing_fields=_missing(raw),
                )
            )
            continue

        best = matches[0]
        ambiguous = (
            best.confidence != ConfidenceLevel.HIGH
            and len(matches) > 1
            and matches[1].score >= max(best.score - 10, 70)
        )
        entry = WorkoutLogEntry(
            exercise_id=best.exercise_id if not ambiguous else None,
            exercise_name_raw=raw.exercise_name_raw,
            exercise_name_matched=best.exercise_name if not ambiguous else None,
            match_confidence=best.confidence if not ambiguous else ConfidenceLevel.LOW,
            match_candidates=[m.exercise_id for m in matches],
            sets=raw.sets,
            reps=raw.reps,
            weight=raw.weight,
            weight_unit=raw.weight_unit,
            duration_seconds=raw.duration_seconds,
            missing_fields=_missing(raw),
        )
        enriched.append(entry)

    workout_log = WorkoutLog(
        id=str(uuid.uuid4()),
        member_id=state.member_id,
        raw_text=state.request,
        entries=enriched,
    )
    return state.model_copy(update={"workout_log": workout_log})


def _missing(raw: _RawEntry) -> List[str]:
    out: List[str] = []
    if raw.sets is None:
        out.append("sets")
    if raw.reps is None and raw.duration_seconds is None:
        out.append("reps_or_duration")
    if raw.weight is None:
        out.append("weight")
    return out
