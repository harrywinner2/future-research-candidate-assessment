"""Trace store schemas."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import utcnow


class StageType(str, Enum):
    ROUTE = "route"
    RETRIEVE = "retrieve"
    GENERATE = "generate"
    VALIDATE = "validate"
    EXPLAIN = "explain"
    INGEST = "ingest"
    LOG = "log"
    SAFETY_REVIEW = "safety_review"


class TraceStage(BaseModel):
    name: str
    kind: StageType
    started_at: str
    ended_at: Optional[str] = None
    duration_ms: Optional[float] = None
    success: bool = True
    error: Optional[str] = None
    inputs: Dict[str, Any] = Field(default_factory=dict)
    outputs: Dict[str, Any] = Field(default_factory=dict)
    prompt_template_id: Optional[str] = None
    prompt_template_version: Optional[str] = None
    model_id: Optional[str] = None
    tokens_prompt: Optional[int] = None
    tokens_completion: Optional[int] = None


class Trace(BaseModel):
    id: str
    member_id: Optional[str] = None
    request_summary: str
    started_at: str = Field(default_factory=lambda: utcnow().isoformat())
    ended_at: Optional[str] = None
    stages: List[TraceStage] = Field(default_factory=list)
    safety_policy_version: Optional[str] = None
    schema_version: Optional[str] = None
    notes: List[str] = Field(default_factory=list)
