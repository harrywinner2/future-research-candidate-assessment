"""Versioned prompt catalogue — backs the Prompt & Template Inspector screen.

Reads directly from ``app.agents.prompts.PROMPT_CATALOG`` so the UI shows the
exact templates the hub renders, with their version and content hash.
"""

from __future__ import annotations

import re
from typing import Any, List

from fastapi import APIRouter, HTTPException

from app.agents.prompts import PROMPT_CATALOG

router = APIRouter(prefix="/prompts")

_VAR = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def _serialise(template: Any) -> dict[str, Any]:
    return {
        "id": template.id,
        "version": template.version,
        "hash": template.hash,
        "description": template.description,
        "body": template.body,
        "variables": sorted(set(_VAR.findall(template.body))),
    }


@router.get("")
async def list_prompts() -> List[dict[str, Any]]:
    return [_serialise(t) for t in PROMPT_CATALOG.values()]


@router.get("/{prompt_id}")
async def get_prompt(prompt_id: str) -> dict[str, Any]:
    template = PROMPT_CATALOG.get(prompt_id)
    if not template:
        raise HTTPException(404, f"No prompt template {prompt_id!r}.")
    return _serialise(template)
