"""Neo4j backend implementing ``GraphClient``.

Kept deliberately simple: parametrised Cypher, no APOC-required calls in the
hot path. Schema setup (constraints / indexes) lives in
:mod:`app.graph.migrations`.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.graph.client import Edge, Node
from app.graph.schema import EdgeType, NodeType


class Neo4jGraphClient:
    """Async Neo4j adapter. Lazily imports the driver so test environments
    can run without ``neo4j`` installed."""

    def __init__(self, uri: str, user: str, password: str, database: str = "neo4j") -> None:
        self._uri = uri
        self._user = user
        self._password = password
        self._database = database
        self._driver: Any = None

    async def initialize(self) -> None:
        from neo4j import AsyncGraphDatabase

        self._driver = AsyncGraphDatabase.driver(self._uri, auth=(self._user, self._password))
        # Quick verify + constraints
        async with self._driver.session(database=self._database) as session:
            await session.run("RETURN 1")
            await _apply_constraints(session)

    async def close(self) -> None:
        if self._driver is not None:
            await self._driver.close()
            self._driver = None

    async def healthcheck(self) -> bool:
        try:
            async with self._driver.session(database=self._database) as session:
                result = await session.run("RETURN 1 AS ok")
                record = await result.single()
                return bool(record and record["ok"] == 1)
        except Exception:
            return False

    # -- Nodes ----------------------------------------------------------
    async def upsert_node(self, node: Node) -> Node:
        cypher = (
            f"MERGE (n:`{node.type.value}` {{key: $key}}) "
            "SET n += $properties "
            "RETURN n"
        )
        async with self._driver.session(database=self._database) as session:
            await session.run(cypher, key=node.key, properties=node.properties)
        return node

    async def get_node(self, node_type: NodeType, key: str) -> Optional[Node]:
        cypher = f"MATCH (n:`{node_type.value}` {{key: $key}}) RETURN n LIMIT 1"
        async with self._driver.session(database=self._database) as session:
            result = await session.run(cypher, key=key)
            record = await result.single()
            if not record:
                return None
            data = dict(record["n"])
            return Node(type=node_type, key=data.pop("key"), properties=data)

    async def find_nodes(
        self, node_type: NodeType, where: Optional[Dict[str, Any]] = None, limit: int = 100
    ) -> List[Node]:
        where_clause = ""
        if where:
            where_clause = " WHERE " + " AND ".join(f"n.`{k}` = ${k}" for k in where)
        cypher = f"MATCH (n:`{node_type.value}`){where_clause} RETURN n LIMIT $limit"
        params: Dict[str, Any] = {"limit": limit, **(where or {})}
        async with self._driver.session(database=self._database) as session:
            result = await session.run(cypher, **params)
            out: List[Node] = []
            async for record in result:
                data = dict(record["n"])
                out.append(Node(type=node_type, key=data.pop("key"), properties=data))
            return out

    async def delete_node(self, node_type: NodeType, key: str) -> bool:
        cypher = (
            f"MATCH (n:`{node_type.value}` {{key: $key}}) "
            "DETACH DELETE n "
            "RETURN count(n) AS deleted"
        )
        async with self._driver.session(database=self._database) as session:
            result = await session.run(cypher, key=key)
            record = await result.single()
            return bool(record and record["deleted"])

    # -- Edges ----------------------------------------------------------
    async def upsert_edge(self, edge: Edge) -> Edge:
        cypher = (
            f"MATCH (a:`{edge.source_type.value}` {{key: $sk}}) "
            f"MATCH (b:`{edge.target_type.value}` {{key: $tk}}) "
            f"MERGE (a)-[r:`{edge.type.value}`]->(b) "
            "SET r += $properties "
            "RETURN r"
        )
        async with self._driver.session(database=self._database) as session:
            await session.run(
                cypher, sk=edge.source_key, tk=edge.target_key, properties=edge.properties
            )
        return edge

    async def get_edges(
        self,
        source_type: Optional[NodeType] = None,
        source_key: Optional[str] = None,
        edge_type: Optional[EdgeType] = None,
        target_type: Optional[NodeType] = None,
        target_key: Optional[str] = None,
    ) -> List[Edge]:
        src_label = f":`{source_type.value}`" if source_type else ""
        tgt_label = f":`{target_type.value}`" if target_type else ""
        rel_label = f":`{edge_type.value}`" if edge_type else ""
        cypher = f"MATCH (a{src_label})-[r{rel_label}]->(b{tgt_label}) "
        conditions: List[str] = []
        params: Dict[str, Any] = {}
        if source_key:
            conditions.append("a.key = $sk")
            params["sk"] = source_key
        if target_key:
            conditions.append("b.key = $tk")
            params["tk"] = target_key
        if conditions:
            cypher += "WHERE " + " AND ".join(conditions) + " "
        cypher += "RETURN type(r) AS t, labels(a) AS al, a.key AS ak, labels(b) AS bl, b.key AS bk, properties(r) AS rp LIMIT 1000"
        async with self._driver.session(database=self._database) as session:
            result = await session.run(cypher, **params)
            edges: List[Edge] = []
            async for record in result:
                et = EdgeType(record["t"])
                st = _first_known_label(record["al"], NodeType)
                tt = _first_known_label(record["bl"], NodeType)
                if st is None or tt is None:
                    continue
                edges.append(
                    Edge(
                        type=et,
                        source_type=st,
                        source_key=record["ak"],
                        target_type=tt,
                        target_key=record["bk"],
                        properties=dict(record["rp"]),
                    )
                )
            return edges

    async def delete_edges(
        self,
        source_type: Optional[NodeType] = None,
        source_key: Optional[str] = None,
        edge_type: Optional[EdgeType] = None,
        target_type: Optional[NodeType] = None,
        target_key: Optional[str] = None,
    ) -> int:
        src_label = f":`{source_type.value}`" if source_type else ""
        tgt_label = f":`{target_type.value}`" if target_type else ""
        rel_label = f":`{edge_type.value}`" if edge_type else ""
        cypher = f"MATCH (a{src_label})-[r{rel_label}]->(b{tgt_label}) "
        conditions: List[str] = []
        params: Dict[str, Any] = {}
        if source_key:
            conditions.append("a.key = $sk")
            params["sk"] = source_key
        if target_key:
            conditions.append("b.key = $tk")
            params["tk"] = target_key
        if conditions:
            cypher += "WHERE " + " AND ".join(conditions) + " "
        cypher += "WITH r, count(r) AS c DELETE r RETURN sum(c) AS deleted"
        async with self._driver.session(database=self._database) as session:
            result = await session.run(cypher, **params)
            record = await result.single()
            return int(record["deleted"]) if record and record["deleted"] is not None else 0

    async def neighborhood(
        self,
        node_type: NodeType,
        key: str,
        depth: int = 2,
        edge_types: Optional[List[EdgeType]] = None,
    ) -> Tuple[List[Node], List[Edge]]:
        depth = max(0, depth)
        rel_filter = ""
        if edge_types:
            rel_filter = ":" + "|".join(e.value for e in edge_types)
        cypher = (
            f"MATCH (m:`{node_type.value}` {{key: $key}}) "
            f"OPTIONAL MATCH path = (m)-[{rel_filter}*0..{depth}]-(n) "
            "WITH collect(DISTINCT n) AS ns, collect(path) AS ps "
            "RETURN ns AS nodes, ps AS paths"
        )
        async with self._driver.session(database=self._database) as session:
            result = await session.run(cypher, key=key)
            record = await result.single()
            nodes: List[Node] = []
            edges: List[Edge] = []
            if not record:
                return ([], [])
            for n in record["nodes"] or []:
                if n is None:
                    continue
                nt = _first_known_label(list(n.labels), NodeType)
                if nt is None:
                    continue
                data = dict(n)
                nodes.append(Node(type=nt, key=data.pop("key"), properties=data))
            for path in record["paths"] or []:
                if path is None:
                    continue
                for rel in path.relationships:
                    et = EdgeType(rel.type)
                    sn = rel.start_node
                    tn = rel.end_node
                    st = _first_known_label(list(sn.labels), NodeType)
                    tt = _first_known_label(list(tn.labels), NodeType)
                    if st is None or tt is None:
                        continue
                    edges.append(
                        Edge(
                            type=et,
                            source_type=st,
                            source_key=sn.get("key"),
                            target_type=tt,
                            target_key=tn.get("key"),
                            properties=dict(rel),
                        )
                    )
            return (nodes, _dedupe_edges(edges))

    async def reset(self) -> None:
        async with self._driver.session(database=self._database) as session:
            await session.run("MATCH (n) DETACH DELETE n")


def _first_known_label(labels: List[str], enum: type[NodeType]) -> Optional[NodeType]:
    known = {e.value for e in enum}
    for lbl in labels:
        if lbl in known:
            return NodeType(lbl)
    return None


def _dedupe_edges(edges: List[Edge]) -> List[Edge]:
    seen: set = set()
    out: List[Edge] = []
    for e in edges:
        sig = (e.type.value, e.source_type.value, e.source_key, e.target_type.value, e.target_key)
        if sig in seen:
            continue
        seen.add(sig)
        out.append(e)
    return out


async def _apply_constraints(session: Any) -> None:
    """Idempotent: unique key per labelled node type."""
    for nt in NodeType:
        await session.run(
            f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:`{nt.value}`) REQUIRE n.key IS UNIQUE"
        )
