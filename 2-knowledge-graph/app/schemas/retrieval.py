"""Retrieval request/response schemas."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import SafetyStatus


class RetrievalRequest(BaseModel):
    member_id: str
    query: str
    top_k: Optional[int] = None
    graph_depth: Optional[int] = None
    include_unsafe: bool = False


class RetrievedFact(BaseModel):
    node_type: str
    node_id: str
    label: str
    score: float = Field(ge=0.0, le=1.0)
    source: str = Field(description="'vector', 'graph', or 'hybrid'.")
    safety_status: SafetyStatus = SafetyStatus.UNKNOWN
    payload: dict = Field(default_factory=dict)


class RetrievalContext(BaseModel):
    """Assembled, token-budgeted context window."""

    facts: List[RetrievedFact]
    member_summary: str
    exclusion_list: List[str] = Field(default_factory=list)
    available_equipment: List[str] = Field(default_factory=list)
    active_injuries: List[str] = Field(default_factory=list)
    token_estimate: int = 0


class RetrievalResult(BaseModel):
    context: RetrievalContext
    vector_hits: int
    graph_expansions: int
    excluded_count: int
