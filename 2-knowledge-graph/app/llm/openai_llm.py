"""OpenAI LLM provider.

Mirrors :class:`app.llm.client.AnthropicLLM` so the rest of the codebase keeps
depending only on the ``LLMClient`` Protocol. Structured output uses the same
"schema-in-prompt + JSON parse" contract as the Anthropic provider, with the
``json_object`` response format requested when the model supports it. This keeps
behaviour identical across providers and the LangGraph hub provider-agnostic.
"""

from __future__ import annotations

import json
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

from app.llm.client import LLMResponse, _strip_code_fences

T = TypeVar("T", bound=BaseModel)


class OpenAILLM:
    """Thin async wrapper over the OpenAI SDK (chat completions)."""

    def __init__(
        self,
        api_key: str,
        model_id: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> None:
        from openai import AsyncOpenAI

        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY missing; set it in the Settings screen, the environment, "
                "or use COACH_KG_LLM_PROVIDER=fake to run offline."
            )
        self._client = AsyncOpenAI(api_key=api_key)
        self.model_id = model_id
        self._temperature = temperature
        self._max_tokens = max_tokens

    async def complete(self, prompt: str, *, system: Optional[str] = None) -> LLMResponse:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        response = await self._client.chat.completions.create(
            model=self.model_id,
            messages=messages,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
        )
        choice = response.choices[0]
        text = choice.message.content or ""
        usage = getattr(response, "usage", None)
        return LLMResponse(
            text=text,
            model_id=self.model_id,
            tokens_prompt=getattr(usage, "prompt_tokens", 0) or 0,
            tokens_completion=getattr(usage, "completion_tokens", 0) or 0,
        )

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
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": wrapped})
        try:
            response = await self._client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                response_format={"type": "json_object"},
            )
        except Exception:  # noqa: BLE001 - some models reject response_format; retry plain
            response = await self._client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                temperature=self._temperature,
                max_tokens=self._max_tokens,
            )
        text = response.choices[0].message.content or ""
        cleaned = _strip_code_fences(text)
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM did not return valid JSON: {e}\nResponse:\n{text}") from e
        return schema.model_validate(data)


__all__ = ["OpenAILLM"]
