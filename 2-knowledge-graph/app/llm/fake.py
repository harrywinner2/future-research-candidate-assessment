"""Deterministic LLM stub used for tests and offline demos.

The hub asks the LLM for several different things (routing, generation,
extraction, explanation). The fake returns context-aware scripted responses
based on simple heuristics over the prompt and the requested schema. This is
intentionally not a real model — it exists so the pipeline shape can be
exercised end-to-end without an API key.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Type, TypeVar

from pydantic import BaseModel

from app.llm.client import LLMResponse

T = TypeVar("T", bound=BaseModel)

Script = Callable[[str, Optional[Type[BaseModel]]], Any]


@dataclass
class FakeScript:
    """A scripted reply keyed by a substring match against the prompt."""

    match: str
    payload: Any
    once: bool = False
    used: bool = field(default=False, init=False)


class FakeLLM:
    """Returns deterministic responses. Tests configure scripts at construction time."""

    def __init__(
        self,
        model_id: str = "fake-claude-haiku",
        scripts: Optional[List[FakeScript]] = None,
    ) -> None:
        self.model_id = model_id
        self.scripts: List[FakeScript] = list(scripts or [])
        self.calls: List[Dict[str, Any]] = []

    def add_script(self, match: str, payload: Any, once: bool = False) -> None:
        self.scripts.append(FakeScript(match=match, payload=payload, once=once))

    async def complete(self, prompt: str, *, system: Optional[str] = None) -> LLMResponse:
        self.calls.append({"kind": "complete", "prompt": prompt, "system": system})
        payload = self._resolve(prompt, schema=None)
        text = payload if isinstance(payload, str) else json.dumps(payload)
        return LLMResponse(
            text=text,
            model_id=self.model_id,
            tokens_prompt=_estimate_tokens(prompt),
            tokens_completion=_estimate_tokens(text),
        )

    async def structured_complete(
        self,
        prompt: str,
        schema: Type[T],
        *,
        system: Optional[str] = None,
    ) -> T:
        self.calls.append(
            {"kind": "structured", "prompt": prompt, "schema": schema.__name__, "system": system}
        )
        payload = self._resolve(prompt, schema=schema)
        return schema.model_validate(payload)

    def _resolve(self, prompt: str, schema: Optional[Type[BaseModel]]) -> Any:
        for script in self.scripts:
            if script.match in prompt and not (script.once and script.used):
                script.used = script.once or script.used
                return script.payload
        # Fall back to schema-aware default heuristics.
        return _default_for_prompt(prompt, schema)


def _default_for_prompt(prompt: str, schema: Optional[Type[BaseModel]]) -> Any:
    schema_name = schema.__name__ if schema else ""

    if schema_name == "RouterDecision":
        return _default_router_decision(prompt)
    if schema_name == "GeneratedWorkout":
        return _default_generated_workout(prompt)
    if schema_name == "ExtractedLogPayload":
        return _default_extracted_log(prompt)
    if schema_name == "ExtractedSignalPayload":
        return _default_extracted_signal(prompt)

    return "I'm a fake model. Configure a script for this prompt to get a tailored response."


_USER_TEXT_RE = re.compile(
    r"(?:User request|User text|Request|Message)\s*:\s*(.+?)(?:\n\n|\Z)",
    re.IGNORECASE | re.DOTALL,
)


def _user_payload(prompt: str) -> str:
    """Pull the actual user-supplied snippet out of the wrapped prompt body."""
    match = _USER_TEXT_RE.search(prompt)
    if match:
        return match.group(1).strip()
    # Fallback: use the last non-empty line.
    lines = [ln.strip() for ln in prompt.splitlines() if ln.strip()]
    return lines[-1] if lines else prompt


def _default_router_decision(prompt: str) -> Dict[str, Any]:
    text = _user_payload(prompt).lower()
    if any(w in text for w in ["did", "logged", "completed", "x10", "x 10", "lbs", "kg"]):
        return {
            "route": "WORKOUT_LOG",
            "confidence": 0.78,
            "rationale": "Mentions a completed set with weight/reps.",
        }
    if any(w in text for w in ["build", "generate", "plan", "session", "workout for"]):
        return {
            "route": "WORKOUT_GENERATE",
            "confidence": 0.82,
            "rationale": "Asks for a workout to be produced.",
        }
    if any(w in text for w in ["why", "explain", "what should i watch"]):
        return {
            "route": "EXPLAIN",
            "confidence": 0.74,
            "rationale": "Asks for an explanation.",
        }
    if len(text.strip().split()) <= 3:
        return {
            "route": "CLARIFY",
            "confidence": 0.35,
            "rationale": "Input is too short to route confidently.",
        }
    return {
        "route": "COACH",
        "confidence": 0.6,
        "rationale": "General coaching question.",
    }


def _default_generated_workout(prompt: str) -> Dict[str, Any]:
    # Extract candidate exercise ids the prompt mentions; the generator includes them.
    ids = re.findall(r"\bex_id:([a-f0-9\-]+)\b", prompt)
    exercises = [{"exercise_id": eid, "sets": 3, "reps": 10, "rest_seconds": 60} for eid in ids[:5]]
    if not exercises:
        exercises = [
            {"exercise_id": "fallback-1", "sets": 3, "reps": 10, "rest_seconds": 60},
        ]
    return {
        "summary": "A deliberate session that respects the safety exclusion list.",
        "sections": [
            {"name": "warmup", "exercises": exercises[:1]},
            {"name": "main", "exercises": exercises[1:] or exercises},
            {"name": "cooldown", "exercises": []},
        ],
    }


def _default_extracted_log(prompt: str) -> Dict[str, Any]:
    text = _user_payload(prompt)
    # Variant 1: "3x10 <name> at <weight> <unit>"
    m = re.search(
        r"(\d+)\s*[xX]\s*(\d+)\s+(.+?)\s+at\s+(\d+(?:\.\d+)?)\s*(\w+)",
        text,
    )
    if m:
        sets, reps, name, weight, unit = m.groups()
        return {
            "entries": [
                {
                    "exercise_name_raw": name.strip(),
                    "sets": int(sets),
                    "reps": int(reps),
                    "weight": float(weight),
                    "weight_unit": unit,
                }
            ]
        }
    # Variant 2: "3x10 <name>" with no weight
    m = re.search(r"(\d+)\s*[xX]\s*(\d+)\s+([A-Za-z][\w\s\-]+)", text)
    if m:
        sets, reps, name = m.groups()
        return {
            "entries": [
                {
                    "exercise_name_raw": name.strip().rstrip(".,!?"),
                    "sets": int(sets),
                    "reps": int(reps),
                }
            ]
        }
    return {"entries": []}


def _default_extracted_signal(prompt: str) -> Dict[str, Any]:
    facts = []
    text = _user_payload(prompt).lower()
    for joint in ["knee", "shoulder", "elbow", "wrist", "hip", "ankle", "lumbar spine", "thoracic spine", "cervical spine"]:
        if joint in text:
            facts.append(
                {
                    "kind": "Injury",
                    "payload": {
                        "label": f"{joint} discomfort noted in chat",
                        "joints": [joint],
                        "severity": 2,
                        "status": "active",
                    },
                    "confidence": 0.6,
                    "rationale": f"'{joint}' mentioned with discomfort context.",
                }
            )
    return {"facts": facts}


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


__all__ = ["FakeLLM", "FakeScript"]
