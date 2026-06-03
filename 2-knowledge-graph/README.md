# Knowledge Graph Coaching Platform

Backend implementation of the [knowledge graph coaching assessment](./KNOWLEDGE_GRAPH_ASSESSMENT.md). A GraphRAG-powered coaching assistant that ingests synthetic member context into a knowledge graph, retrieves the safety-relevant slice, and generates **injury-aware, explainable** workout recommendations.

> **Status:** backend + tests complete; frontend is being built separately against this API.

> **Synthetic data only.** Do not enter real member information. The ingestion layer rejects obviously real-looking inputs.

---

## Quickstart

```bash
# 1. Spin up Neo4j + API
docker compose up -d --build

# 2. Tail the API and watch seeding
docker compose logs -f api

# 3. Inspect the seeded graph
open http://localhost:7474  # Neo4j browser (user: neo4j, pass: coach-kg-dev)

# 4. Hit the API
curl http://localhost:8000/health
curl http://localhost:8000/members
curl -X POST http://localhost:8000/recommend \
  -H 'content-type: application/json' \
  -d '{"member_id": "demo-member-1", "request": "Build a 30 min lower-body session for this week."}'
```

By default the LLM provider is `fake` — deterministic scripted responses so the demo runs offline. Set `COACH_KG_LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=...` to use Claude.

### Local dev without Docker

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
COACH_KG_GRAPH_BACKEND=memory uvicorn app.main:app --reload
pytest
```

`COACH_KG_GRAPH_BACKEND=memory` runs the entire system against an in-process graph adapter — no Neo4j required.

---

## Architecture

```
                ┌─────────────────────────────────────────────┐
                │  FastAPI surface (app/api/)                 │
                │  /ingest /retrieve /recommend /explain      │
                │  /members /exercises /graph /traces /settings│
                └────────────────────┬────────────────────────┘
                                     │
                ┌────────────────────▼────────────────────────┐
                │  LangGraph hub (app/agents/hub.py)          │
                │  StateGraph: router → coach / generator /   │
                │  logger / explainer → safety reviewer       │
                └──┬────────────┬────────────┬────────────────┘
                   │            │            │
        ┌──────────▼──┐  ┌──────▼──────┐  ┌─▼──────────────┐
        │ Retrieval   │  │ Safety      │  │ Tools          │
        │ GraphRAG    │  │ Policy +    │  │ search_exer.,  │
        │ graph + vec │  │ filter +    │  │ build_workout, │
        │             │  │ validator   │  │ extract_log    │
        └──────┬──────┘  └──────┬──────┘  └─┬──────────────┘
               │                │            │
        ┌──────▼────────────────▼────────────▼──────────────┐
        │  Graph layer (app/graph/)                          │
        │  Protocol → Neo4jClient  |  InMemoryClient (tests) │
        └────────────────────────────────────────────────────┘
```

### Module map

| Module | Responsibility |
|---|---|
| `app/config.py` | Pydantic-settings; all knobs from env or `.env` |
| `app/schemas/` | Pydantic models for members, exercises, injuries, workouts, signals, recommendations, retrieval, trace |
| `app/graph/` | Documented ontology (`schema.py`), `GraphClient` Protocol, Neo4j + in-memory adapters |
| `app/llm/` | LLM client Protocol; `AnthropicLLM` + `FakeLLM` |
| `app/retrieval/` | Embeddings, vector store, hybrid GraphRAG (graph traversal + vector search) |
| `app/safety/` | Versioned `SafetyPolicy`, exercise filter, output validator |
| `app/agents/` | LangGraph `StateGraph` hub, router, sub-agents, tools, versioned prompt catalog |
| `app/ingestion/` | Exercise loader, synthetic member generator, chat-signal extractor, bulk seed |
| `app/observability/` | In-process trace store with lineage and stage timings |
| `app/api/` | FastAPI routes |

### The graph (documented ontology)

Full machine-readable schema is exposed at `GET /graph/schema`. Quick summary:

**Nodes:** `Member`, `Goal`, `Preference`, `Equipment`, `Injury`, `Joint`, `Exercise`, `MuscleGroup`, `MovementPattern`, `Workout`, `WorkoutLog`, `ContextSignal`.

**Edges:** `HAS_GOAL`, `PREFERS`, `HAS_EQUIPMENT`, `HAS_INJURY`, `AFFECTS_JOINT`, `LOADS_JOINT`, `TRAINS_MUSCLE`, `USES_EQUIPMENT`, `HAS_MOVEMENT_PATTERN`, `COMPLETED_WORKOUT`, `MENTIONED_IN`, `CONTRAINDICATES`, `HAS_BILATERAL_PAIR`.

Every node and edge carries lineage: `source` (which form/signal created it), `source_id`, `created_at`, `confidence`. The Why Explanation drawer reads this metadata directly.

### GraphRAG retrieval

`app/retrieval/graph_rag.py` combines:

1. **Vector search** over `ContextSignal` and `Exercise` description embeddings — pulls semantically relevant nodes.
2. **Graph expansion** from the seed nodes outward N hops, prioritizing `Member → HAS_INJURY → Joint` and `Member → HAS_EQUIPMENT` paths.
3. **Safety neighborhood** — explicitly fetches the `joint ← LOADS_JOINT ← Exercise` slice so the safety filter has the right data.
4. **Token budget assembly** — packs the highest-priority context into the configured `max_context_tokens` window.

### Safety

Safety is enforced at three points (configurable via `SafetyPolicy`):

1. **Retrieval** — contraindicated exercises are surfaced with a `caution` or `excluded` label.
2. **Generation** — the workout-generator prompt receives an explicit exclusion list.
3. **Validation** — `app/safety/validator.py` re-checks the generated workout against the live graph; if it slips through, the system corrects in place or asks for regeneration (`COACH_KG_VALIDATOR_MAX_RETRIES`).

`SafetyPolicy` is versioned; every recommendation records the policy version used.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/settings` | Active model, retrieval, safety, validator config |
| `GET` | `/members` | List members |
| `POST` | `/members` | Create synthetic member |
| `GET` | `/members/{id}` | Member detail with graph summary |
| `GET` | `/members/{id}/graph` | Neighborhood subgraph (nodes + edges) |
| `GET` | `/exercises` | List/filter exercises (with member-aware safety labels) |
| `GET` | `/exercises/{id}` | Exercise detail |
| `POST` | `/ingest/profile` | Ingest a member profile fact set |
| `POST` | `/ingest/injury` | Log an injury or condition |
| `POST` | `/ingest/signal` | Ingest a chat/transcript signal (extracted into nodes) |
| `POST` | `/retrieve` | Run GraphRAG retrieval for a query |
| `POST` | `/recommend` | Full pipeline: route → retrieve → generate → validate |
| `POST` | `/explain` | Why was an exercise included or skipped? |
| `POST` | `/log` | Workout-log extraction from natural language |
| `GET` | `/graph/schema` | Documented ontology (node + edge catalogue) |
| `GET` | `/traces` | List recent request traces |
| `GET` | `/traces/{id}` | Full trace with stage timings, prompts, retrieval, validation |

Request / response schemas live in `app/schemas/` and are visible in the auto-generated OpenAPI docs at `/docs`.

---

## Testing

```bash
pytest                 # unit + in-memory integration (no Neo4j needed)
pytest -m integration  # requires a running Neo4j (see docker compose)
pytest --cov=app       # coverage
```

The test suite explicitly covers the critical paths called out in the assessment:

1. **Injury filtering** (`tests/test_safety_filter.py`) — a member with a knee injury requesting a lower-body session never receives an exercise loading the knee.
2. **GraphRAG retrieval** (`tests/test_retrieval.py`) — combined graph + vector retrieval returns the expected member context and excludes contraindicated exercises.
3. **Validator correction** (`tests/test_validator.py`) — when the LLM emits an unknown exercise ID or a contraindicated movement, the validator catches it and the hub regenerates or substitutes.
4. **Logger fuzzy match** (`tests/test_logger.py`) — "bench press" maps to a dataset variant with confidence; missing weight stays null, never invented.
5. **Router fallback** (`tests/test_router.py`) — ambiguous input ("bench press") triggers clarification instead of silent routing.
6. **Hub end-to-end** (`tests/test_hub_e2e.py`) — full StateGraph run with fake LLM produces a valid, safety-checked recommendation with a complete trace.
7. **API smoke** (`tests/test_api.py`) — all routes return the expected schema.

Tests run against the `InMemoryGraphClient` and `FakeLLM` — fully offline, deterministic, and fast. Integration tests against real Neo4j are marked `@pytest.mark.integration` and skipped unless `RUN_INTEGRATION=1`.

---

## How I would evaluate this system in production

**Retrieval quality.** Track the fraction of recommendations where the retrieved context actually contained the cited graph facts (citation hit rate). Sample 50 conversations weekly for manual relevance grading. A drop in citation hit rate is usually a sign that an embedding-model or chunking change regressed grounding.

**Safety.** The single hardest-tracked metric. Track:
- *Hard violation rate* — recommended exercises that load a contraindicated joint, divided by total recommendations. Target zero; any non-zero is a pager event.
- *Soft violation rate* — exercises with empty `joints_loaded` recommended despite an active injury (the unknown-data case).
- *Validator correction rate* — how often the validator catches a bad recommendation. High is bad (model is unreliable); zero with no corrections in the audit log is also bad (validator is asleep).

**Explainability.** Every recommendation must produce a graph path. Track the fraction where `/explain` returns a non-empty path. Falling below ~95% means the system is generating prose-only rationalizations.

**Latency.** p50 / p95 / p99 per stage (routing, retrieval, generation, validation) with explicit budgets. Generation dominates; if it exceeds ~3s p95, switch to a faster model for the routing/coach paths and reserve the larger model for generation. The Cost & Performance Dashboard surfaces this.

**Coach acceptance.** The lagging quality signal. Track approve / edit / reject ratio per coach, per safety level, and per template version. A spike in `reject(reason=unsafe)` after a deploy is a regression even if all other metrics look fine.

**Drift.** Re-run the evaluation harness against a fixed scenario library on every prompt-template, model, or retrieval change. A diff in safety exclusions or recommendation overlap above a threshold blocks the change. The `/recommend` endpoint accepts a `pinned_settings` override so the harness can hold everything constant.

**Failure modes I'd monitor.**
- Vector index empty or stale → silent fallback to graph-only, surfaced as a banner.
- Neo4j unreachable → read-only mode using the last cached graph snapshot per member.
- LLM rate-limit / 429 → queue with visible state; never silently drop a request.
- New injury logged mid-session → the in-flight conversation's memory must be invalidated for sessions referring to the affected joint.

---

## Tradeoffs

Documented in [TRADEOFFS.md](./TRADEOFFS.md). Short version: I prioritised graph-as-load-bearing retrieval, safety enforced at three layers (retrieval, generation, validation), and an LLM-free test path so the assessment can be evaluated without API keys. I cut a real vector-index backend (using a hash-based deterministic embedder by default) and inline-rendered the demo frontend in screens.md rather than shipping a React app.
