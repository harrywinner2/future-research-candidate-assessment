"""Aggregate metrics derived from the live trace store.

Backs the Cost / Token / Performance Dashboard and the metric tiles on the
Evaluation screen. Everything here is computed from real recorded traces — no
synthetic series. Cost is a labelled estimate using a small price table.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_trace_store
from app.observability.trace import TraceStore

router = APIRouter(prefix="/metrics")

# USD per 1M tokens (input, output). Labelled estimates; update as pricing changes.
_PRICE_PER_MTOK: Dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "fake": (0.0, 0.0),
}


def _percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return round(s[lo] + (s[hi] - s[lo]) * (k - lo), 2)


def _price(model_id: str) -> tuple[float, float]:
    if not model_id:
        return (0.0, 0.0)
    for key, price in _PRICE_PER_MTOK.items():
        if key in model_id:
            return price
    return (0.0, 0.0)


@router.get("")
async def metrics(
    limit: int = Query(500, ge=1, le=500),
    traces: TraceStore = Depends(get_trace_store),
) -> dict[str, Any]:
    recent = traces.list(limit=limit)

    per_stage: Dict[str, Dict[str, Any]] = {}
    total_prompt = total_completion = 0
    est_cost = 0.0
    total_stages = failed_stages = 0

    for tr in recent:
        for st in tr.stages:
            kind = st.kind.value if hasattr(st.kind, "value") else str(st.kind)
            bucket = per_stage.setdefault(
                kind, {"count": 0, "durations": [], "errors": 0, "tokens": 0}
            )
            bucket["count"] += 1
            total_stages += 1
            if st.duration_ms is not None:
                bucket["durations"].append(st.duration_ms)
            if not st.success:
                bucket["errors"] += 1
                failed_stages += 1
            tp = st.tokens_prompt or 0
            tc = st.tokens_completion or 0
            bucket["tokens"] += tp + tc
            total_prompt += tp
            total_completion += tc
            pin, pout = _price(st.model_id or "")
            est_cost += (tp / 1_000_000) * pin + (tc / 1_000_000) * pout

    stages_out = []
    for kind, b in per_stage.items():
        durs = b["durations"]
        stages_out.append(
            {
                "stage": kind,
                "count": b["count"],
                "p50_ms": _percentile(durs, 0.50),
                "p95_ms": _percentile(durs, 0.95),
                "p99_ms": _percentile(durs, 0.99),
                "error_rate": round(b["errors"] / b["count"], 4) if b["count"] else 0.0,
                "tokens": b["tokens"],
            }
        )
    stages_out.sort(key=lambda s: s["stage"])

    return {
        "request_count": len(recent),
        "stage_count": total_stages,
        "error_rate": round(failed_stages / total_stages, 4) if total_stages else 0.0,
        "tokens": {
            "prompt": total_prompt,
            "completion": total_completion,
            "total": total_prompt + total_completion,
        },
        "estimated_cost_usd": round(est_cost, 4),
        "cost_label": "estimated",
        "stages": stages_out,
    }
