"""GraphRAG — hybrid retrieval combining vector search and graph traversal.

Pipeline:

1. **Seed vector hits.** Embed the query, find the top-k matching
   ``ContextSignal`` and ``Exercise`` records.
2. **Expand the safety neighbourhood.** From the target member, walk
   ``HAS_INJURY -> AFFECTS_JOINT`` and ``HAS_EQUIPMENT`` so the filter step has
   everything it needs.
3. **Expand from vector seeds.** N-hop traversal from each hit, edge-type
   filtered to safety-relevant edges.
4. **Assemble** into a token-budgeted ``RetrievalContext`` with safety labels
   already attached (the generator prompt consumes the exclusion list).

Token estimation is rough — the goal is to avoid blowing the model's context
window, not to be perfectly accurate.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple

from app.graph.client import GraphClient, Node
from app.graph.queries import (
    exercise_equipment,
    exercise_joints,
    member_active_injuries,
    member_contraindicated_joints,
    member_equipment,
)
from app.graph.schema import EdgeType, NodeType
from app.retrieval.embeddings import Embedder
from app.retrieval.vector_store import VectorStore
from app.schemas.common import SafetyStatus
from app.schemas.retrieval import (
    RetrievalContext,
    RetrievalRequest,
    RetrievalResult,
    RetrievedFact,
)


SAFETY_EDGE_TYPES = [
    EdgeType.HAS_INJURY,
    EdgeType.AFFECTS_JOINT,
    EdgeType.LOADS_JOINT,
    EdgeType.HAS_EQUIPMENT,
    EdgeType.USES_EQUIPMENT,
    EdgeType.HAS_MOVEMENT_PATTERN,
    EdgeType.TRAINS_MUSCLE,
    EdgeType.MENTIONED_IN,
    EdgeType.HAS_BILATERAL_PAIR,
]


@dataclass
class GraphRAG:
    graph: GraphClient
    vectors: VectorStore
    embedder: Embedder

    async def retrieve(self, request: RetrievalRequest) -> RetrievalResult:
        top_k = request.top_k or 8
        depth = request.graph_depth or 2

        # 1. Seed vector hits
        query_vec = self.embedder.embed(request.query)
        vector_hits = await self.vectors.search(query_vec, k=top_k)

        # 2. Member-centred safety expansion
        contraindicated_joints = await member_contraindicated_joints(self.graph, request.member_id)
        equipment_available = set(await member_equipment(self.graph, request.member_id))
        active_injuries = await member_active_injuries(self.graph, request.member_id)

        # 3. Vector-seed graph expansion
        nodes_by_key: Dict[str, Node] = {}
        graph_expansions = 0
        for record, _score in vector_hits:
            node_type_str = record.metadata.get("node_type")
            node_key = record.metadata.get("node_key") or record.id
            if not node_type_str:
                continue
            try:
                nt = NodeType(node_type_str)
            except ValueError:
                continue
            ns, _es = await self.graph.neighborhood(
                nt, node_key, depth=depth, edge_types=SAFETY_EDGE_TYPES
            )
            graph_expansions += 1
            for n in ns:
                nodes_by_key[f"{n.type.value}:{n.key}"] = n

        # Make sure the member's own subgraph is in the context.
        member_nodes, _ = await self.graph.neighborhood(
            NodeType.MEMBER, request.member_id, depth=depth, edge_types=SAFETY_EDGE_TYPES
        )
        for n in member_nodes:
            nodes_by_key[f"{n.type.value}:{n.key}"] = n

        # 4. Score + assemble
        all_facts = await self._score_and_label(
            request,
            vector_hits,
            list(nodes_by_key.values()),
            contraindicated_joints,
            equipment_available,
        )
        # Exclusion list is computed from the pre-filter list so it survives the
        # safety filter that removes EXCLUDED facts from the assembled window.
        exclusion_list = sorted(self._exclusion_ids(all_facts))
        excluded_count = sum(1 for f in all_facts if f.safety_status == SafetyStatus.EXCLUDED)
        facts = (
            all_facts
            if request.include_unsafe
            else [f for f in all_facts if f.safety_status != SafetyStatus.EXCLUDED]
        )
        budget = _budget_facts(facts, max_tokens=4000)

        context = RetrievalContext(
            facts=budget.facts,
            member_summary=await self._member_summary(request.member_id),
            exclusion_list=exclusion_list,
            available_equipment=sorted(equipment_available),
            active_injuries=[i.properties.get("label", i.key) for i in active_injuries],
            token_estimate=budget.tokens,
        )
        return RetrievalResult(
            context=context,
            vector_hits=len(vector_hits),
            graph_expansions=graph_expansions,
            excluded_count=excluded_count,
        )

    async def _score_and_label(
        self,
        request: RetrievalRequest,
        vector_hits: List[Tuple],
        nodes: List[Node],
        contraindicated_joints: Set[str],
        equipment_available: Set[str],
    ) -> List[RetrievedFact]:
        out: List[RetrievedFact] = []
        vector_scores = {record.id: score for record, score in vector_hits}
        for node in nodes:
            score = vector_scores.get(node.key, 0.0)
            source = "hybrid" if score > 0 else "graph"
            label = node.properties.get("label") or node.properties.get("name") or node.key
            payload = dict(node.properties)
            safety = SafetyStatus.UNKNOWN
            if node.type == NodeType.EXERCISE:
                joints = set(await exercise_joints(self.graph, node.key))
                required_equip = set(await exercise_equipment(self.graph, node.key))
                if joints & contraindicated_joints:
                    safety = SafetyStatus.EXCLUDED
                elif required_equip and not required_equip.issubset(equipment_available):
                    safety = SafetyStatus.EXCLUDED
                elif not joints:
                    safety = SafetyStatus.UNKNOWN  # missing joint data
                else:
                    safety = SafetyStatus.SAFE
                payload["joints_loaded"] = sorted(joints)
                payload["equipment_required"] = sorted(required_equip)
            out.append(
                RetrievedFact(
                    node_type=node.type.value,
                    node_id=node.key,
                    label=str(label),
                    score=max(0.0, min(1.0, float(score) if score else 0.4)),
                    source=source,
                    safety_status=safety,
                    payload=payload,
                )
            )
        # Sort: safe exercises first, then graph context, then unknown / excluded.
        priority = {
            SafetyStatus.SAFE: 0,
            SafetyStatus.CAUTION: 1,
            SafetyStatus.UNKNOWN: 2,
            SafetyStatus.EXCLUDED: 3,
        }
        out.sort(key=lambda f: (priority.get(f.safety_status, 4), -f.score))
        return out

    def _exclusion_ids(self, facts: List[RetrievedFact]) -> Set[str]:
        return {
            f.node_id
            for f in facts
            if f.node_type == NodeType.EXERCISE.value and f.safety_status == SafetyStatus.EXCLUDED
        }

    async def _member_summary(self, member_id: str) -> str:
        member = await self.graph.get_node(NodeType.MEMBER, member_id)
        if not member:
            return "(unknown member)"
        bits = [member.properties.get("name", member_id)]
        persona = member.properties.get("persona")
        if persona:
            bits.append(persona)
        return " — ".join(bits)


@dataclass
class _Budget:
    facts: List[RetrievedFact]
    tokens: int


def _budget_facts(facts: List[RetrievedFact], max_tokens: int) -> _Budget:
    """Greedy packer that estimates tokens as len(label)/4 + payload size/8."""
    kept: List[RetrievedFact] = []
    total = 0
    for fact in facts:
        cost = max(1, len(fact.label) // 4) + max(0, len(str(fact.payload)) // 8)
        if total + cost > max_tokens:
            break
        kept.append(fact)
        total += cost
    return _Budget(facts=kept, tokens=total)
