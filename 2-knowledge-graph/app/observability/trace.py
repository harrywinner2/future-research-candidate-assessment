"""In-process trace store.

Each ``/recommend`` request runs inside a ``start_trace`` context manager that
opens a :class:`Trace` and pushes it into a context var. Sub-agents wrap each
stage with ``with_stage`` so the trace builds up automatically. The API exposes
recent traces at ``/traces`` (feeds the System Trace and Cost Dashboard screens).
"""

from __future__ import annotations

import contextlib
import contextvars
import time
import uuid
from collections import deque
from typing import Any, AsyncIterator, Deque, Dict, List, Optional

from app.config import get_settings
from app.schemas.common import utcnow
from app.schemas.trace import StageType, Trace, TraceStage


_current_trace: contextvars.ContextVar[Optional[Trace]] = contextvars.ContextVar(
    "current_trace", default=None
)


class TraceStore:
    """Bounded deque of completed traces. Newest first."""

    def __init__(self, retention: Optional[int] = None) -> None:
        retention = retention or get_settings().trace_retention
        self._traces: Deque[Trace] = deque(maxlen=retention)

    def record(self, trace: Trace) -> None:
        self._traces.appendleft(trace)

    def list(self, limit: int = 50, member_id: Optional[str] = None) -> List[Trace]:
        out: List[Trace] = []
        for t in self._traces:
            if member_id and t.member_id != member_id:
                continue
            out.append(t)
            if len(out) >= limit:
                break
        return out

    def get(self, trace_id: str) -> Optional[Trace]:
        for t in self._traces:
            if t.id == trace_id:
                return t
        return None

    def clear(self) -> None:
        self._traces.clear()


def current_trace() -> Optional[Trace]:
    return _current_trace.get()


def record_stage_usage(
    prompt_tokens: int = 0, completion_tokens: int = 0, model_id: Optional[str] = None
) -> None:
    """Attribute token usage to the currently-active stage.

    LLM clients call this after each completion. Because ``with_stage`` appends
    its stage on entry, the last stage on the current trace is the one wrapping
    the in-flight LLM call. No-op when there is no active trace (e.g. seeding).
    """
    trace = _current_trace.get()
    if not trace or not trace.stages:
        return
    stage = trace.stages[-1]
    stage.tokens_prompt = (stage.tokens_prompt or 0) + (prompt_tokens or 0)
    stage.tokens_completion = (stage.tokens_completion or 0) + (completion_tokens or 0)
    if model_id and not stage.model_id:
        stage.model_id = model_id


@contextlib.asynccontextmanager
async def start_trace(
    store: TraceStore,
    *,
    request_summary: str,
    member_id: Optional[str] = None,
    safety_policy_version: Optional[str] = None,
    schema_version: Optional[str] = None,
) -> AsyncIterator[Trace]:
    trace = Trace(
        id=str(uuid.uuid4()),
        member_id=member_id,
        request_summary=request_summary,
        safety_policy_version=safety_policy_version,
        schema_version=schema_version,
    )
    token = _current_trace.set(trace)
    try:
        yield trace
    finally:
        trace.ended_at = utcnow().isoformat()
        store.record(trace)
        _current_trace.reset(token)


@contextlib.asynccontextmanager
async def with_stage(
    name: str,
    kind: StageType,
    *,
    inputs: Optional[Dict[str, Any]] = None,
    prompt_template_id: Optional[str] = None,
    prompt_template_version: Optional[str] = None,
    model_id: Optional[str] = None,
) -> AsyncIterator[TraceStage]:
    stage = TraceStage(
        name=name,
        kind=kind,
        started_at=utcnow().isoformat(),
        inputs=inputs or {},
        prompt_template_id=prompt_template_id,
        prompt_template_version=prompt_template_version,
        model_id=model_id,
    )
    start = time.perf_counter()
    trace = current_trace()
    if trace is not None:
        trace.stages.append(stage)
    try:
        yield stage
    except Exception as exc:  # noqa: BLE001
        stage.success = False
        stage.error = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        stage.ended_at = utcnow().isoformat()
        stage.duration_ms = (time.perf_counter() - start) * 1000.0
