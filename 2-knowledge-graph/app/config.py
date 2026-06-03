"""Application configuration.

Every tunable knob the system has lives here. Values come from environment
variables prefixed with ``COACH_KG_`` (see ``.env.example``). The Settings
screen described in ``screens.md`` is a UI projection of this object.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

GraphBackend = Literal["memory", "neo4j"]
LLMProvider = Literal["fake", "anthropic", "openai"]
EmbeddingsProvider = Literal["hash", "sentence-transformers"]
SafetyLevel = Literal["lenient", "standard", "strict", "max"]


class Settings(BaseSettings):
    """All runtime configuration. Pydantic validates on load."""

    model_config = SettingsConfigDict(
        env_prefix="COACH_KG_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Graph ----------------------------------------------------------
    graph_backend: GraphBackend = "memory"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "coach-kg-dev"
    neo4j_database: str = "neo4j"

    # --- LLM ------------------------------------------------------------
    llm_provider: LLMProvider = "fake"
    llm_model: str = "claude-haiku-4-5-20251001"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 2048
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")

    # --- Embeddings -----------------------------------------------------
    embeddings_provider: EmbeddingsProvider = "hash"
    embeddings_model: str = "all-MiniLM-L6-v2"
    embeddings_dimension: int = 384

    # --- Retrieval ------------------------------------------------------
    retrieval_top_k: int = 8
    retrieval_graph_depth: int = 2
    retrieval_max_context_tokens: int = 4000

    # --- Safety ---------------------------------------------------------
    safety_level: SafetyLevel = "standard"

    # --- Validator ------------------------------------------------------
    validator_strict: bool = True
    validator_max_retries: int = 2

    # --- Boot -----------------------------------------------------------
    seed_on_boot: bool = True
    exercises_path: Path = Path("exercises.json")

    # --- Observability --------------------------------------------------
    log_level: str = "INFO"
    trace_retention: int = 500


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor; safe to call from anywhere."""
    return Settings()


def reset_settings_cache() -> None:
    """Clear the settings cache. Test fixtures use this after monkeypatching env."""
    get_settings.cache_clear()
