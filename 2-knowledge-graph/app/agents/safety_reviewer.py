"""Final safety review node. Re-runs the validator after generation.

Belt-and-braces: even if the validator inside the generator passed, this node
runs once more against the *current* graph state in case ingestion happened
mid-flight (e.g. a new injury was logged).
"""

from __future__ import annotations

from app.agents.state import HubState
from app.graph.client import GraphClient
from app.observability.trace import with_stage
from app.safety.policy import SafetyPolicy
from app.safety.validator import RecommendationValidator
from app.schemas.trace import StageType


async def review(state: HubState, *, graph: GraphClient, policy: SafetyPolicy) -> HubState:
    if not state.recommendation or not state.member_id:
        return state
    async with with_stage(
        "safety_reviewer", StageType.SAFETY_REVIEW, inputs={"member_id": state.member_id}
    ) as stage:
        validator = RecommendationValidator(graph, policy, strict=True)
        outcome = await validator.validate(state.recommendation, state.member_id)
        stage.outputs = {
            "passed": outcome.report.passed,
            "issues": len(outcome.report.issues),
            "substitutions": len(outcome.substitutions),
        }
    return state.model_copy(update={"recommendation": outcome.recommendation})
