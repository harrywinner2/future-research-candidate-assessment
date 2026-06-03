"""Schema setup helpers.

The Neo4j adapter applies uniqueness constraints on initialize. This module
exposes a higher-level :func:`ensure_schema` for the seed script and for tests
that bring up the graph from scratch.
"""

from __future__ import annotations

from app.graph.client import GraphClient


async def ensure_schema(client: GraphClient) -> None:
    """No-op for in-memory; Neo4j adapter applies constraints during ``initialize``."""
    await client.initialize()
