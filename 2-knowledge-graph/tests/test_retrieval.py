"""Critical path: GraphRAG retrieval combines graph + vector and applies safety labels."""

from __future__ import annotations

import pytest

from app.retrieval.graph_rag import GraphRAG
from app.schemas.common import SafetyStatus
from app.schemas.retrieval import RetrievalRequest


@pytest.mark.asyncio
async def test_retrieval_returns_member_context(rag: GraphRAG, member_id: str) -> None:
    result = await rag.retrieve(RetrievalRequest(member_id=member_id, query="lower body session"))
    assert result.context.facts, "Expected at least one fact in the retrieval context."
    assert "knee" in result.context.active_injuries or any(
        "knee" in i.lower() for i in result.context.active_injuries
    )


@pytest.mark.asyncio
async def test_retrieval_marks_unsafe_excluded_by_default(rag: GraphRAG, member_id: str) -> None:
    result = await rag.retrieve(RetrievalRequest(member_id=member_id, query="lunge squat"))
    # In the default request, excluded exercises are filtered out of facts but recorded in the exclusion list.
    assert any(result.context.exclusion_list), "Expected at least one excluded exercise."
    assert all(
        f.safety_status != SafetyStatus.EXCLUDED for f in result.context.facts
    ), "include_unsafe=False should drop excluded facts from the assembled context."


@pytest.mark.asyncio
async def test_retrieval_include_unsafe(rag: GraphRAG, member_id: str) -> None:
    result = await rag.retrieve(
        RetrievalRequest(member_id=member_id, query="lunge", include_unsafe=True)
    )
    assert result.excluded_count > 0
    assert any(f.safety_status == SafetyStatus.EXCLUDED for f in result.context.facts)


@pytest.mark.asyncio
async def test_retrieval_caps_context(rag: GraphRAG, member_id: str) -> None:
    result = await rag.retrieve(
        RetrievalRequest(member_id=member_id, query="anything", top_k=3, graph_depth=1)
    )
    # Token estimate should be well under the default budget (4000).
    assert result.context.token_estimate <= 4000
