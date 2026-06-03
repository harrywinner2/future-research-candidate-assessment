"""Graph introspection — ontology, invariants, neighbourhood."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_graph_client
from app.graph.client import GraphClient
from app.graph.schema import (
    SCHEMA_VERSION,
    EdgeType,
    NodeType,
    edge_catalogue,
    invariants,
    node_catalogue,
)

router = APIRouter(prefix="/graph")


@router.get("/schema")
async def graph_schema() -> dict[str, Any]:
    return {
        "version": SCHEMA_VERSION,
        "nodes": [n.model_dump() for n in node_catalogue()],
        "edges": [e.model_dump() for e in edge_catalogue()],
        "invariants": [i.model_dump() for i in invariants()],
    }


@router.get("/neighbourhood")
async def neighbourhood(
    node_type: NodeType,
    key: str,
    depth: int = Query(2, ge=0, le=5),
    edge_type: Optional[EdgeType] = None,
    graph: GraphClient = Depends(get_graph_client),
) -> dict[str, Any]:
    nodes, edges = await graph.neighborhood(
        node_type, key, depth=depth, edge_types=[edge_type] if edge_type else None
    )
    return {
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
    }
