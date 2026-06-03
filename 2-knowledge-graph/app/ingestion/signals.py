"""Chat-signal extraction.

Takes a free-text member message ("my knee felt off after lunges") and
proposes graph facts:

- A ``ContextSignal`` node holding the raw text.
- A ``MENTIONED_IN`` edge from any mentioned ``Joint`` node to the signal.
- A proposed ``Injury`` (low-confidence) if the text describes pain or
  discomfort.

The default extractor is a small LLM-backed extractor that uses
``LLMClient.structured_complete`` with ``ExtractedSignalPayload``. For tests we
configure the FakeLLM to return deterministic facts via heuristics.

Real-world hardening (severity calibration, multi-joint resolution, transcript
chunking) is out of scope for the demo; the abstraction is small enough that
swapping the extractor for a stronger model is mechanical.
"""

from __future__ import annotations

import uuid
from typing import List

from pydantic import BaseModel, Field

from app.graph.client import Edge, GraphClient, Node
from app.graph.schema import EdgeType, NodeType
from app.llm.client import LLMClient
from app.schemas.common import Lineage, utcnow
from app.schemas.injury import Injury, InjuryStatus, JointArea
from app.schemas.signal import ContextSignal, ExtractedFact, SignalType


_PRIVACY_RED_FLAGS = [
    r"@gmail",
    r"@yahoo",
    r"@outlook",
    r"\bssn\b",
    r"\bsocial security\b",
]


class ExtractedSignalPayload(BaseModel):
    facts: List[ExtractedFact] = Field(default_factory=list)


class SignalExtractor:
    """Wraps an :class:`LLMClient` plus heuristic privacy checks."""

    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

    async def extract(self, text: str) -> List[ExtractedFact]:
        privacy_violation = _privacy_check(text)
        if privacy_violation:
            return [
                ExtractedFact(
                    kind="PrivacyRejection",
                    payload={"matched": privacy_violation},
                    confidence=1.0,
                    rationale="Looked like real personal data — synthetic data only.",
                )
            ]
        prompt = (
            "Extract a list of structured facts from this synthetic member message. "
            "Only propose Injury facts when discomfort is clearly described.\n\n"
            f"Message: {text}"
        )
        try:
            payload = await self.llm.structured_complete(prompt, ExtractedSignalPayload)
        except ValueError:
            return []
        return payload.facts


async def ingest_signal(
    client: GraphClient,
    extractor: SignalExtractor,
    member_id: str,
    text: str,
    signal_type: SignalType = SignalType.CHAT,
) -> ContextSignal:
    signal_id = str(uuid.uuid4())
    lineage = Lineage(source="chat", ingester="signal_extractor", confidence=0.6).model_dump(mode="json")
    facts = await extractor.extract(text)

    signal = ContextSignal(
        id=signal_id,
        member_id=member_id,
        signal_type=signal_type,
        text=text,
        extracted_facts=facts,
    )

    await client.upsert_node(
        Node(
            type=NodeType.CONTEXT_SIGNAL,
            key=signal_id,
            properties={
                "text": text,
                "signal_type": signal_type.value,
                "captured_at": signal.captured_at,
                "member_id": member_id,
                **lineage,
            },
        )
    )

    # If the extractor proposed an Injury, ingest it with low confidence.
    from app.ingestion.members import ingest_injury

    for fact in facts:
        if fact.kind == "Injury":
            joints_raw = fact.payload.get("joints", [])
            joints: List[JointArea] = []
            for j in joints_raw:
                try:
                    joints.append(JointArea(j))
                except ValueError:
                    continue
            injury = Injury(
                id=str(uuid.uuid4()),
                label=fact.payload.get("label", "extracted injury"),
                joints=joints,
                severity=int(fact.payload.get("severity", 2)),
                status=InjuryStatus(fact.payload.get("status", "active")),
                source_signal_id=signal_id,
                lineage=Lineage(
                    source="chat-extraction", source_id=signal_id, ingester="signal_extractor", confidence=fact.confidence
                ),
            )
            await ingest_injury(client, member_id, injury)
            for joint in joints:
                await client.upsert_edge(
                    Edge(
                        type=EdgeType.MENTIONED_IN,
                        source_type=NodeType.JOINT,
                        source_key=joint.value,
                        target_type=NodeType.CONTEXT_SIGNAL,
                        target_key=signal_id,
                        properties={"confidence": fact.confidence},
                    )
                )

    return signal


def _privacy_check(text: str) -> str | None:
    import re

    for pattern in _PRIVACY_RED_FLAGS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(0)
    if re.search(r"\b\d{3}-\d{2}-\d{4}\b", text):
        return "ssn-pattern"
    return None
