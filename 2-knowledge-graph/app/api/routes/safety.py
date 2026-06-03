"""Safety policy inspection + level switching — backs the Safety Policy Editor.

The active policy is held on ``app.state.policy``. Switching the level rebuilds
it from ``POLICY_REGISTRY`` and updates the hub's ``HubServices`` so subsequent
recommendations use it. Individual-rule overrides bump the policy version via
``SafetyPolicy.with_overrides``.
"""

from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.safety.policy import POLICY_REGISTRY, SafetyPolicy

router = APIRouter(prefix="/safety")


def _serialise(policy: SafetyPolicy) -> dict[str, Any]:
    return policy.model_dump()


@router.get("/policy")
async def get_active_policy(request: Request) -> dict[str, Any]:
    return _serialise(request.app.state.policy)


@router.get("/policies")
async def list_policy_levels() -> List[dict[str, Any]]:
    return [_serialise(p) for p in POLICY_REGISTRY.values()]


class PolicyUpdate(BaseModel):
    level: Optional[str] = None
    contraindicated_joint_rule: Optional[str] = None
    bilateral_rule: Optional[str] = None
    unknown_data: Optional[str] = None
    require_equipment_match: Optional[bool] = None
    fade_resolved_injury_after_sessions: Optional[int] = None


@router.put("/policy")
async def update_policy(request: Request, body: PolicyUpdate) -> dict[str, Any]:
    current: SafetyPolicy = request.app.state.policy

    if body.level:
        base = POLICY_REGISTRY.get(body.level)
        if not base:
            raise HTTPException(400, f"Unknown safety level {body.level!r}.")
        current = base

    overrides = {
        k: v
        for k, v in {
            "contraindicated_joint_rule": body.contraindicated_joint_rule,
            "bilateral_rule": body.bilateral_rule,
            "unknown_data": body.unknown_data,
            "require_equipment_match": body.require_equipment_match,
            "fade_resolved_injury_after_sessions": body.fade_resolved_injury_after_sessions,
        }.items()
        if v is not None
    }
    if overrides:
        try:
            current = current.with_overrides(**overrides)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"Invalid policy override: {exc}") from exc

    request.app.state.policy = current
    request.app.state.services.policy = current
    return _serialise(current)
