"""In-memory conversation sessions — backs Conversation History + Memory Inspector.

Multi-turn memory is a stretch goal; this provides the persistence + windowing
surface the UI needs to demonstrate it. Sessions are scoped per member and held
in-process (synthetic data only). A simple recency window + token estimate model
the conversation-memory budget shown in the Memory Inspector.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.schemas.common import utcnow

router = APIRouter(prefix="/sessions")

MEMORY_WINDOW_TURNS = 8
_CHARS_PER_TOKEN = 4


def _store(request: Request) -> Dict[str, Dict[str, Any]]:
    if not hasattr(request.app.state, "sessions"):
        request.app.state.sessions = {}
    return request.app.state.sessions


class SessionCreate(BaseModel):
    member_id: str
    title: Optional[str] = None


class MessageIn(BaseModel):
    role: str = Field(description="'user' or 'assistant'")
    content: str
    route: Optional[str] = None
    trace_id: Optional[str] = None
    recommendation_id: Optional[str] = None
    pinned: bool = False


def _summary(s: Dict[str, Any]) -> Dict[str, Any]:
    msgs = s["messages"]
    last = msgs[-1]["content"] if msgs else ""
    return {
        "id": s["id"],
        "member_id": s["member_id"],
        "title": s["title"],
        "created_at": s["created_at"],
        "updated_at": s["updated_at"],
        "message_count": len(msgs),
        "last_message": last[:160],
        "recommendations": sum(1 for m in msgs if m.get("recommendation_id")),
    }


def _memory_view(msgs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Recency window + token budget the Memory Inspector renders."""
    pinned = [m for m in msgs if m.get("pinned")]
    window = msgs[-MEMORY_WINDOW_TURNS:]
    in_window_idx = {id(m) for m in window} | {id(m) for m in pinned}
    evicted = [m for m in msgs if id(m) not in in_window_idx]
    used = sum(len(m["content"]) for m in (window + pinned)) // _CHARS_PER_TOKEN
    return {
        "window_turns": MEMORY_WINDOW_TURNS,
        "in_window": len(window),
        "pinned": len(pinned),
        "evicted": len(evicted),
        "evicted_summary": (
            f"{len(evicted)} earlier turn(s) summarised out of the verbatim window."
            if evicted
            else None
        ),
        "token_estimate": used,
    }


@router.post("", status_code=201)
async def create_session(request: Request, body: SessionCreate) -> Dict[str, Any]:
    store = _store(request)
    now = utcnow().isoformat()
    sid = f"sess-{uuid.uuid4().hex[:8]}"
    store[sid] = {
        "id": sid,
        "member_id": body.member_id,
        "title": body.title or "New conversation",
        "created_at": now,
        "updated_at": now,
        "messages": [],
    }
    return _summary(store[sid])


@router.get("")
async def list_sessions(
    request: Request, member_id: Optional[str] = Query(None)
) -> List[Dict[str, Any]]:
    store = _store(request)
    out = [
        _summary(s)
        for s in store.values()
        if member_id is None or s["member_id"] == member_id
    ]
    out.sort(key=lambda s: s["updated_at"], reverse=True)
    return out


@router.get("/{session_id}")
async def get_session(request: Request, session_id: str) -> Dict[str, Any]:
    store = _store(request)
    s = store.get(session_id)
    if not s:
        raise HTTPException(404, f"No session {session_id!r}.")
    return {**s, "memory": _memory_view(s["messages"])}


@router.post("/{session_id}/messages", status_code=201)
async def append_message(request: Request, session_id: str, body: MessageIn) -> Dict[str, Any]:
    store = _store(request)
    s = store.get(session_id)
    if not s:
        raise HTTPException(404, f"No session {session_id!r}.")
    s["messages"].append(body.model_dump())
    s["updated_at"] = utcnow().isoformat()
    if s["title"] == "New conversation" and body.role == "user":
        s["title"] = body.content[:48]
    return {**s, "memory": _memory_view(s["messages"])}


@router.delete("/{session_id}")
async def delete_session(request: Request, session_id: str) -> Dict[str, str]:
    store = _store(request)
    if session_id not in store:
        raise HTTPException(404, f"No session {session_id!r}.")
    del store[session_id]
    return {"status": "deleted", "id": session_id}
