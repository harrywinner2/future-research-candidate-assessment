"""Explainer sub-agent — produces graph-traceable rationales."""

from __future__ import annotations

from typing import List

from app.agents.prompts import EXPLAINER, render
from app.agents.state import HubState
from app.graph.client import GraphClient
from app.graph.queries import (
    exercise_joints,
    exercise_muscles,
    explain_path,
    member_active_injuries,
    member_contraindicated_joints,
)
from app.graph.schema import NodeType
from app.llm.client import LLMClient
from app.observability.trace import with_stage
from app.safety.filters import ExerciseFilter
from app.safety.policy import SafetyPolicy
from app.schemas.common import SafetyStatus
from app.schemas.trace import StageType


async def explain(
    state: HubState,
    *,
    llm: LLMClient,
    graph: GraphClient,
    policy: SafetyPolicy,
    exercise_id: str,
    action: str = "included",
) -> HubState:
    if not state.member_id:
        return state.add_note("explainer: skipped — no member_id provided.")

    node = await graph.get_node(NodeType.EXERCISE, exercise_id)
    if not node:
        return state.model_copy(update={"explanation": f"No exercise found with id {exercise_id}."})

    name = node.properties.get("name", exercise_id)
    joints = await exercise_joints(graph, exercise_id)
    muscles = await exercise_muscles(graph, exercise_id)
    contraindicated = await member_contraindicated_joints(graph, state.member_id)
    injuries = await member_active_injuries(graph, state.member_id)

    overlap = set(joints) & contraindicated
    if overlap and action == "skipped":
        joint = sorted(overlap)[0]
        graph_path = explain_path("Member", "HAS_INJURY", "Injury", "AFFECTS_JOINT", joint, "LOADED_BY", "Exercise")
    elif joints:
        graph_path = explain_path("Exercise", "LOADS_JOINT", joints[0])
    else:
        graph_path = "Exercise (no joint data)"

    filter_ = ExerciseFilter(graph, policy)
    decision = await filter_.evaluate(exercise_id, state.member_id)
    fact_lines: List[str] = []
    fact_lines.append(f"joints_loaded={joints or '(empty)'}")
    fact_lines.append(f"muscle_groups={muscles}")
    fact_lines.append(f"member.active_injuries={[i.properties.get('label') for i in injuries]}")
    fact_lines.append(f"member.contraindicated_joints={sorted(contraindicated)}")
    fact_lines.append(f"safety_decision={decision.status.value} ({decision.reason or 'n/a'})")

    async with with_stage(
        "explainer",
        StageType.EXPLAIN,
        inputs={"exercise_id": exercise_id, "action": action},
        prompt_template_id=EXPLAINER.id,
        prompt_template_version=EXPLAINER.version,
        model_id=llm.model_id,
    ) as stage:
        prompt = render(
            EXPLAINER,
            action=action,
            exercise_name=name,
            member_summary=state.member_id,
            facts="\n".join(fact_lines),
            graph_path=graph_path,
        )
        response = await llm.complete(prompt)
        stage.outputs = {"text_len": len(response.text)}

    return state.model_copy(
        update={
            "explanation": response.text,
            "scratch": {**state.scratch, "explainer_graph_path": graph_path, "decision": decision.status.value},
        }
    )
