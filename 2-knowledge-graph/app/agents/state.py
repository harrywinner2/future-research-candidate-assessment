"""Typed state passed through the LangGraph hub.

Every sub-agent reads and writes fields on :class:`HubState`. The shape of
this object is the contract between nodes; the StateGraph topology screen
described in ``screens.md`` is a UI for this state plus the graph edges.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.recommendation import Recommendation
from app.schemas.retrieval import RetrievalContext
from app.schemas.workout import WorkoutLog


class Route(str, Enum):
    COACH = "COACH"
    WORKOUT_GENERATE = "WORKOUT_GENERATE"
    WORKOUT_LOG = "WORKOUT_LOG"
    EXPLAIN = "EXPLAIN"
    CLARIFY = "CLARIFY"


class RouterDecision(BaseModel):
    """Structured-output schema for the router LLM call."""

    route: Route
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str


class HubState(BaseModel):
    """Single conversation turn's worth of state."""

    request: str
    member_id: Optional[str] = None
    history: List[Dict[str, str]] = Field(default_factory=list)

    # Filled by sub-agents
    decision: Optional[RouterDecision] = None
    retrieval: Optional[RetrievalContext] = None
    recommendation: Optional[Recommendation] = None
    workout_log: Optional[WorkoutLog] = None
    coach_answer: Optional[str] = None
    explanation: Optional[str] = None
    clarification_question: Optional[str] = None

    # Bookkeeping
    retry_count: int = 0
    errors: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)

    # Free-form scratch for sub-agents that need to communicate.
    scratch: Dict[str, Any] = Field(default_factory=dict)

    def add_note(self, note: str) -> "HubState":
        return self.model_copy(update={"notes": [*self.notes, note]})
