"""Trace list/detail routes — feed the System Trace screen."""

from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_trace_store
from app.observability.trace import TraceStore

router = APIRouter(prefix="/traces")


@router.get("")
async def list_traces(
    limit: int = Query(50, ge=1, le=500),
    member_id: Optional[str] = None,
    traces: TraceStore = Depends(get_trace_store),
) -> List[dict[str, Any]]:
    return [t.model_dump() for t in traces.list(limit=limit, member_id=member_id)]


@router.get("/{trace_id}")
async def get_trace(
    trace_id: str,
    traces: TraceStore = Depends(get_trace_store),
) -> dict[str, Any]:
    trace = traces.get(trace_id)
    if not trace:
        raise HTTPException(404, f"Trace {trace_id} not found.")
    return trace.model_dump()
