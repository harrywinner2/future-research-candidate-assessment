"""API smoke tests.

Uses ``httpx.AsyncClient`` against the in-process ASGI app. The app's lifespan
will seed automatically (``COACH_KG_SEED_ON_BOOT=true`` by default).
"""

from __future__ import annotations

import os
from typing import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture
async def client(monkeypatch) -> AsyncIterator[AsyncClient]:
    # Force the in-memory backend; ensure the fake LLM is used.
    monkeypatch.setenv("COACH_KG_GRAPH_BACKEND", "memory")
    monkeypatch.setenv("COACH_KG_LLM_PROVIDER", "fake")
    monkeypatch.setenv("COACH_KG_SEED_ON_BOOT", "true")

    from app.config import reset_settings_cache

    reset_settings_cache()
    from importlib import reload

    import app.main as main_module

    reload(main_module)
    app = main_module.app

    # httpx's ASGITransport does not invoke lifespan; drive it manually.
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest.mark.asyncio
async def test_health(client: AsyncClient) -> None:
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in ("ok", "degraded")
    assert body["schema_version"]


@pytest.mark.asyncio
async def test_settings(client: AsyncClient) -> None:
    r = await client.get("/settings")
    assert r.status_code == 200
    body = r.json()
    assert body["graph_backend"] == "memory"
    assert body["llm"]["provider"] == "fake"
    assert body["safety"]["level"]


@pytest.mark.asyncio
async def test_graph_schema_documented(client: AsyncClient) -> None:
    r = await client.get("/graph/schema")
    assert r.status_code == 200
    body = r.json()
    assert body["version"]
    node_types = {n["type"] for n in body["nodes"]}
    assert {"Member", "Exercise", "Injury", "Joint"}.issubset(node_types)


@pytest.mark.asyncio
async def test_list_members(client: AsyncClient) -> None:
    r = await client.get("/members")
    assert r.status_code == 200
    members = r.json()
    assert any("Synth-Alex" in m["name"] for m in members)


@pytest.mark.asyncio
async def test_recommend_e2e(client: AsyncClient) -> None:
    # Pick the first synthetic member
    r = await client.get("/members")
    member_id = r.json()[0]["id"]
    r = await client.post(
        "/recommend",
        json={
            "request": "Build a lower-body session with dumbbells for this week",
            "member_id": member_id,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["trace_id"]
    rec = body.get("recommendation")
    assert rec is not None
    # No section should reference unknown ids
    assert rec["validation"]["passed"] or rec["validation"]["corrections_applied"]
