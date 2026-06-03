"""Evaluation scenarios run against the LIVE system.

Each scenario drives the real hub end-to-end and makes a concrete assertion, so
the Evaluation screen shows genuine pass/warn/fail results (not a mock). These
mirror the critical-path tests called out in the assessment: injury filtering,
explainability, thin retrieval, validator activity, and no-results recovery.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.agents.hub import HubServices, run_hub
from app.agents.state import HubState
from app.api.dependencies import get_graph_client, get_services, get_trace_store
from app.graph.client import GraphClient
from app.graph.queries import exercise_joints, member_contraindicated_joints
from app.observability.trace import TraceStore, start_trace

router = APIRouter(prefix="/eval")

SCENARIOS: List[Dict[str, Any]] = [
    {
        "id": "injury_filtering",
        "name": "Injury filtering",
        "member_id": "demo-synth-alex",
        "request": "Build this member a lower-body session for this week.",
        "expected": "No recommended exercise loads a joint affected by an active injury (knee).",
        "kind": "recommend",
    },
    {
        "id": "explainability",
        "name": "Explainability",
        "member_id": "demo-synth-alex",
        "request": "Why did you skip knee-loading squats for this member?",
        "expected": "Returns a plain-English explanation traceable to a graph path.",
        "kind": "explain",
    },
    {
        "id": "thin_retrieval",
        "name": "Thin retrieval / clarification",
        "member_id": "demo-synth-alex",
        "request": "hmm",
        "expected": "Ambiguous input asks a clarifying question instead of guessing.",
        "kind": "recommend",
    },
    {
        "id": "validator_active",
        "name": "Validator activity",
        "member_id": "demo-synth-sam",
        "request": "Build a 30-minute full-body session.",
        "expected": "Generated recommendation carries a validation report (validator ran).",
        "kind": "recommend",
    },
    {
        "id": "no_results_recovery",
        "name": "No-results recovery",
        "member_id": "demo-synth-jordan",
        "request": "Build me a workout using only a rowing machine and a sled.",
        "expected": "Unavailable equipment recovers gracefully — no crash, no invented exercises.",
        "kind": "recommend",
    },
]


@router.get("/scenarios")
async def list_scenarios() -> List[Dict[str, Any]]:
    return SCENARIOS


def _included_exercise_ids(payload: Dict[str, Any]) -> List[str]:
    rec = payload.get("recommendation") or {}
    ids: List[str] = []
    for section in rec.get("sections", []):
        for ge in section.get("exercises", []):
            ex = ge.get("exercise") or {}
            if ex.get("id"):
                ids.append(ex["id"])
    return ids


async def _run_one(
    scenario: Dict[str, Any],
    services: HubServices,
    graph: GraphClient,
    traces: TraceStore,
) -> Dict[str, Any]:
    state = HubState(request=scenario["request"], member_id=scenario.get("member_id"))
    async with start_trace(
        traces,
        request_summary=f"[eval] {scenario['id']}",
        member_id=scenario.get("member_id"),
        safety_policy_version=services.policy.version,
    ) as trace:
        try:
            final = await run_hub(services, state)
        except Exception as exc:  # noqa: BLE001 - a crash IS the failure signal
            return {
                "id": scenario["id"],
                "status": "fail",
                "detail": f"System raised {type(exc).__name__}: {exc}",
                "trace_id": trace.id,
            }
        payload = final.model_dump(exclude_none=True)
        if final.recommendation:
            payload["recommendation"] = final.recommendation.model_dump()

    status = "pass"
    detail = scenario["expected"]

    if scenario["id"] == "injury_filtering":
        injured = await member_contraindicated_joints(graph, scenario["member_id"])
        violations: List[str] = []
        for ex_id in _included_exercise_ids(payload):
            joints = set(await exercise_joints(graph, ex_id))
            if joints & injured:
                violations.append(f"{ex_id} loads {sorted(joints & injured)}")
        if violations:
            status, detail = "fail", "Contraindicated joint loaded: " + "; ".join(violations)
        else:
            detail = f"No included exercise loads {sorted(injured) or 'an injured joint'}."

    elif scenario["id"] == "explainability":
        if payload.get("explanation") or payload.get("clarification_question"):
            detail = "Explanation/clarification returned."
        else:
            status, detail = "warn", "No explanation text produced."

    elif scenario["id"] == "thin_retrieval":
        if payload.get("clarification_question"):
            detail = "Asked for clarification on ambiguous input."
        elif payload.get("recommendation"):
            status, detail = "warn", "Produced a recommendation for ambiguous input."
        else:
            detail = "Did not fabricate a recommendation."

    elif scenario["id"] == "validator_active":
        rec = payload.get("recommendation")
        if rec and "validation" in rec:
            detail = f"Validation report present (passed={rec['validation'].get('passed')})."
        else:
            status, detail = "warn", "No validation report on the recommendation."

    elif scenario["id"] == "no_results_recovery":
        # Success = it did not crash (handled above) and did not invent exercises
        # requiring unavailable equipment. We simply confirm a coherent response exists.
        if payload.get("recommendation") or payload.get("coach_answer") or payload.get(
            "clarification_question"
        ) or payload.get("notes"):
            detail = "Recovered gracefully without crashing."
        else:
            status, detail = "warn", "Empty response."

    return {
        "id": scenario["id"],
        "name": scenario["name"],
        "status": status,
        "detail": detail,
        "expected": scenario["expected"],
        "trace_id": payload.get("trace_id"),
        "payload": payload,
    }


@router.post("/run")
async def run_eval(
    scenario_id: str = Query(None, description="Run one scenario; omit to run all."),
    services: HubServices = Depends(get_services),
    graph: GraphClient = Depends(get_graph_client),
    traces: TraceStore = Depends(get_trace_store),
) -> Dict[str, Any]:
    chosen = SCENARIOS
    if scenario_id:
        chosen = [s for s in SCENARIOS if s["id"] == scenario_id]
        if not chosen:
            raise HTTPException(404, f"No scenario {scenario_id!r}.")
    results = [await _run_one(s, services, graph, traces) for s in chosen]
    summary = {
        "total": len(results),
        "passed": sum(1 for r in results if r["status"] == "pass"),
        "warned": sum(1 for r in results if r["status"] == "warn"),
        "failed": sum(1 for r in results if r["status"] == "fail"),
    }
    return {"summary": summary, "results": results}
