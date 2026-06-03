"""Members + member graph routes."""

from __future__ import annotations

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_graph_client
from app.graph.client import GraphClient
from app.graph.queries import all_members, member_active_injuries, member_equipment
from app.graph.schema import EdgeType, NodeType
from app.ingestion.members import create_member, ingest_member
from app.ingestion.members import SYNTHETIC_PERSONAS, SyntheticPersona
from app.schemas.member import Member

router = APIRouter(prefix="/members")


@router.get("")
async def list_members(graph: GraphClient = Depends(get_graph_client)) -> List[dict[str, Any]]:
    nodes = await all_members(graph)
    out: List[dict[str, Any]] = []
    for n in nodes:
        injuries = await member_active_injuries(graph, n.key)
        equipment = await member_equipment(graph, n.key)
        out.append(
            {
                "id": n.key,
                "name": n.properties.get("name", n.key),
                "persona": n.properties.get("persona"),
                "active_injuries": [i.properties.get("label") for i in injuries],
                "equipment": equipment,
            }
        )
    return out


@router.post("", status_code=201)
async def create_member_route(
    member: Member,
    graph: GraphClient = Depends(get_graph_client),
) -> dict[str, str]:
    await ingest_member(graph, member)
    return {"id": member.id, "status": "created"}


@router.post("/synthetic/{persona_name}", status_code=201)
async def spawn_synthetic_persona(
    persona_name: str,
    graph: GraphClient = Depends(get_graph_client),
) -> dict[str, str]:
    persona: SyntheticPersona | None = next(
        (p for p in SYNTHETIC_PERSONAS if p.name.lower() == persona_name.lower()), None
    )
    if not persona:
        raise HTTPException(404, f"No synthetic persona named {persona_name!r}.")
    member = create_member(persona)
    await ingest_member(graph, member)
    return {"id": member.id, "status": "created"}


@router.get("/{member_id}")
async def member_detail(
    member_id: str, graph: GraphClient = Depends(get_graph_client)
) -> dict[str, Any]:
    node = await graph.get_node(NodeType.MEMBER, member_id)
    if not node:
        raise HTTPException(404, f"Member {member_id} not found.")
    injuries = await member_active_injuries(graph, member_id)
    equipment = await member_equipment(graph, member_id)
    return {
        "id": node.key,
        "name": node.properties.get("name", node.key),
        "persona": node.properties.get("persona"),
        "skill_level": node.properties.get("skill_level"),
        "training_days_per_week": node.properties.get("training_days_per_week"),
        "active_injuries": [
            {"id": i.key, "label": i.properties.get("label"), "severity": i.properties.get("severity")}
            for i in injuries
        ],
        "equipment": equipment,
    }


@router.get("/{member_id}/graph")
async def member_subgraph(
    member_id: str,
    depth: int = 2,
    graph: GraphClient = Depends(get_graph_client),
) -> dict[str, Any]:
    nodes, edges = await graph.neighborhood(NodeType.MEMBER, member_id, depth=depth)
    return {
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
    }
