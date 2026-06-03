"""LLM client Protocol with an Anthropic implementation.

The rest of the codebase only depends on the Protocol; tests use ``FakeLLM``
from ``app.llm.fake`` which returns scripted responses.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Protocol, Type, TypeVar

from pydantic import BaseModel, Field

from app.config import Settings, get_settings

T = TypeVar("T", bound=BaseModel)


class LLMResponse(BaseModel):
    text: str
    model_id: str
    tokens_prompt: int = 0
    tokens_completion: int = 0
    raw: Dict[str, Any] = Field(default_factory=dict)


class LLMClient(Protocol):
    """Two-method LLM interface used by every sub-agent."""

    model_id: str

    async def complete(self, prompt: str, *, system: Optional[str] = None) -> LLMResponse: ...

    async def structured_complete(
        self,
        prompt: str,
        schema: Type[T],
        *,
        system: Optional[str] = None,
    ) -> T: ...


class AnthropicLLM:
    """Thin async wrapper over the Anthropic SDK."""

    def __init__(
        self,
        api_key: str,
        model_id: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> None:
        from anthropic import AsyncAnthropic

        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY missing; set COACH_KG_LLM_PROVIDER=fake to run offline.")
        self._client = AsyncAnthropic(api_key=api_key)
        self.model_id = model_id
        self._temperature = temperature
        self._max_tokens = max_tokens

    async def complete(self, prompt: str, *, system: Optional[str] = None) -> LLMResponse:
        response = await self._client.messages.create(
            model=self.model_id,
            max_tokens=self._max_tokens,
            temperature=self._temperature,
            system=system or "",
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            getattr(block, "text", "") for block in response.content if hasattr(block, "text")
        )
        usage = getattr(response, "usage", None)
        pt = getattr(usage, "input_tokens", 0) or 0
        ct = getattr(usage, "output_tokens", 0) or 0
        from app.observability.trace import record_stage_usage

        record_stage_usage(pt, ct, self.model_id)
        return LLMResponse(text=text, model_id=self.model_id, tokens_prompt=pt, tokens_completion=ct)

    async def structured_complete(
        self,
        prompt: str,
        schema: Type[T],
        *,
        system: Optional[str] = None,
    ) -> T:
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        wrapped = (
            f"{prompt}\n\nRespond with a single JSON object that conforms to this schema. "
            f"Do not wrap the response in markdown.\n\nSchema:\n{schema_json}"
        )
        response = await self.complete(wrapped, system=system)
        cleaned = _strip_code_fences(response.text)
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM did not return valid JSON: {e}\nResponse:\n{response.text}") from e
        return schema.model_validate(data)


def build_llm(settings: Optional[Settings] = None) -> LLMClient:
    """Factory that resolves provider from settings."""
    settings = settings or get_settings()
    if settings.llm_provider == "anthropic":
        return AnthropicLLM(
            api_key=settings.anthropic_api_key,
            model_id=settings.llm_model,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
    if settings.llm_provider == "openai":
        from app.llm.openai_llm import OpenAILLM

        return OpenAILLM(
            api_key=settings.openai_api_key,
            model_id=settings.llm_model,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
    from app.llm.fake import FakeLLM

    return FakeLLM(model_id=settings.llm_model)


def build_llm_from(
    provider: str,
    model_id: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 2048,
    api_key: str = "",
) -> "LLMClient":
    """Build an LLM client from explicit parameters.

    Used by the runtime Settings endpoint so a coach can switch provider/model/key
    without restarting the process. ``api_key`` is held in-process only.
    """
    if provider == "anthropic":
        return AnthropicLLM(
            api_key=api_key, model_id=model_id, temperature=temperature, max_tokens=max_tokens
        )
    if provider == "openai":
        from app.llm.openai_llm import OpenAILLM

        return OpenAILLM(
            api_key=api_key, model_id=model_id, temperature=temperature, max_tokens=max_tokens
        )
    from app.llm.fake import FakeLLM

    return FakeLLM(model_id=model_id)


def _strip_code_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        # ```json ... ``` or ``` ... ```
        s = s.split("\n", 1)[-1] if "\n" in s else s[3:]
        if s.endswith("```"):
            s = s[:-3]
    return s.strip()


__all__ = ["AnthropicLLM", "LLMClient", "LLMResponse", "build_llm"]
