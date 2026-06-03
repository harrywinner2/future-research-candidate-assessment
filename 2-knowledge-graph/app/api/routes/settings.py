"""Runtime LLM settings — switch provider / model / key without a restart.

The API key is held in-process on ``app.state`` only. It is never returned in a
response, written to disk, or logged. This backs the Settings screen described
in ``screens.md`` (LLM provider + model + key).
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.llm.client import build_llm_from

router = APIRouter(prefix="/settings")


class LLMSettingsUpdate(BaseModel):
    provider: Optional[str] = Field(default=None, description="fake | openai | anthropic")
    model: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=32000)
    api_key: Optional[str] = Field(default=None, description="Write-only; never returned.")


def _public_llm_state(request: Request) -> dict[str, Any]:
    rt = request.app.state.llm_runtime
    keys = request.app.state.llm_keys
    return {
        "provider": rt["provider"],
        "model": rt["model"],
        "temperature": rt["temperature"],
        "max_tokens": rt["max_tokens"],
        # never the key itself — just whether one is present for each provider
        "key_present": {p: bool(keys.get(p)) for p in ("openai", "anthropic")},
    }


@router.get("/llm")
async def get_llm_settings(request: Request) -> dict[str, Any]:
    return _public_llm_state(request)


@router.put("/llm")
async def update_llm_settings(request: Request, body: LLMSettingsUpdate) -> dict[str, Any]:
    rt = request.app.state.llm_runtime
    keys = request.app.state.llm_keys

    provider = (body.provider or rt["provider"]).lower()
    if provider not in ("fake", "openai", "anthropic"):
        raise HTTPException(400, f"Unknown provider {provider!r}.")
    model = body.model or rt["model"]
    temperature = body.temperature if body.temperature is not None else rt["temperature"]
    max_tokens = body.max_tokens if body.max_tokens is not None else rt["max_tokens"]

    if body.api_key:
        keys[provider] = body.api_key.strip()

    try:
        llm = build_llm_from(
            provider,
            model,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=keys.get(provider, ""),
        )
    except Exception as exc:  # noqa: BLE001 - surface a clean 400 to the UI
        raise HTTPException(400, f"Could not initialise {provider} LLM: {exc}") from exc

    # Swap the live client everywhere it is referenced.
    request.app.state.llm = llm
    request.app.state.services.llm = llm
    rt.update(
        {"provider": provider, "model": model, "temperature": temperature, "max_tokens": max_tokens}
    )
    return _public_llm_state(request)
