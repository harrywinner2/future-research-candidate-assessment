# Build Report — Future Coach Intelligence

> Living document. Traces every decision and unit of work, doubles as the script source for the
> presentation video, and is the continuity record if work is resumed in a fresh session.

**Repo (submission):** https://github.com/harrywinner2/future-research-candidate-assessment
**Live demo:** https://future-coach-production.up.railway.app
**Demo video (5 min):** https://youtu.be/aMN48IvN5gs — scripted & directed by the human author; the
voiceover is AI-generated (OpenAI TTS) for audio quality only. Reproducible pipeline in `presentation/`.
**Date started:** 2026-06-02

---

## 1. What this project is

A single product — **Future Coach Intelligence** — that satisfies **both** take-home assessments in
this repo, sharing one backend, one design system, and one deployed app:

- **Assessment 2 — Knowledge Graph Coaching Platform** (primary): ingest synthetic member context into
  a knowledge graph, retrieve the safety-relevant slice via GraphRAG, generate **injury-aware,
  explainable** recommendations. Frontend is an explicit requirement.
- **Assessment 1 — Multi-Agent System**: a LangGraph hub routing requests to coach / workout-generator
  / workout-logger sub-agents with structured-output routing and graceful fallback. The KG backend's
  hub already implements this; dedicated Multi-Agent screens surface it.

The backend (`2-knowledge-graph/`) was already implemented (34 tests green). The design was already
mocked (`mock_screens/`, Babel-in-browser React, 31 screens). **This build turns the mock into a real
Vite + React app wired to the real backend + a real database, adds an OpenAI provider and runtime
settings, dockerizes the full stack, and deploys it.**

## 2. Decisions (confirmed with the user)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Frontend build | **Vite + React, porting the mock to ES modules** | Babel-in-browser transpiles every file in the visitor's browser, ships dev React, can't tree-shake/minify/test/add npm deps, and is hardwired to static `window.DB`. A Vite build fixes all of that and lets screens fetch live data. Reusing the mock preserves the finished design. |
| D2 | Data source | **Real Neo4j database, seeded with synthetic data** | User asked explicitly for "real programmatic data in a database," not hardcoded JS. Backend already supports Neo4j behind a `GraphClient` Protocol; seed-on-boot writes synthetic members/exercises/injuries/signals. In-memory adapter remains the offline/test fallback. |
| D3 | LLM provider | **OpenAI** (user has credits) with a **runtime Settings page** to pick model + set key | Added an `OpenAILLM` provider. Key is supplied via env / runtime settings, never committed. `fake` LLM remains the deterministic offline fallback. |
| D4 | Deploy target | **Railway** (Neo4j service + app service) | Persistent stateful Python process serving both the API and the built SPA from one image. `railway` CLI present. |
| D5 | Scope | **All 31 screens, both assessments** | User asked for completeness across both specs. |

**Security:** the OpenAI key the user shared lives only in a gitignored `.env` locally and as a Railway
secret. It is never written to source, logs, or git. (Recommend rotating after submission.)

## 3. Locked backend API contract (verified against source)

Base URL: backend root. CORS + static SPA serving added in this build. App entry `app.main:app`, port 8000.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/health` | — | `{status, graph:bool, schema_version}` |
| GET | `/settings` | — | active graph/llm/embeddings/retrieval/safety/validator config |
| PUT | `/settings` | _(added)_ `{provider, model, temperature, max_tokens, api_key?}` | updates running LLM; key never returned |
| GET | `/members` | — | `[{id,name,persona,active_injuries:[label],equipment:[name]}]` |
| POST | `/members` | `Member` | `{id,status}` (201) |
| POST | `/members/synthetic/{persona_name}` | — | `{id,status}` (201) |
| GET | `/members/{id}` | — | `{id,name,persona,skill_level,training_days_per_week,active_injuries:[{id,label,severity}],equipment:[name]}` |
| GET | `/members/{id}/graph?depth=2` | — | `{nodes:[Node],edges:[Edge]}` |
| GET | `/exercises?muscle&equipment&member_id&limit` | — | `[{id,name,muscle_groups,joints_loaded,movement_patterns,equipment_required,priority_tier,is_bilateral, safety_status?,safety_reason?}]` |
| GET | `/exercises/{id}?member_id` | — | full exercise + `safety:{status,reason,rule,graph_path}` when member_id given |
| POST | `/ingest/profile` | `Member` | `{member_id,status}` |
| POST | `/ingest/injury?member_id` | `Injury` (body) | `{injury_id,status}` |
| POST | `/ingest/signal?member_id&text&signal_type` | — | `ContextSignal` (with `extracted_facts[]`) |
| POST | `/ingest/seed` | — | `{exercises,members,vector_records}` |
| POST | `/ingest/exercises` | — | `{ingested}` |
| POST | `/retrieve` | `RetrievalRequest{member_id,query,top_k?,graph_depth?,include_unsafe?}` | `RetrievalResult{context,vector_hits,graph_expansions,excluded_count}` |
| POST | `/recommend` | `HubState{request,member_id,history?}` | hub payload incl. `recommendation`, `decision`, `retrieval`, `trace_id` |
| POST | `/explain` | `HubState + {exercise_id?,action}` | hub payload incl. `explanation`, `trace_id` |
| POST | `/log` | `HubState{request,member_id}` | hub payload incl. `workout_log`, `trace_id` |
| GET | `/graph/schema` | — | `{version,nodes:[NodeSpec],edges:[EdgeSpec],invariants:[...]}` |
| GET | `/graph/neighbourhood?node_type&key&depth&edge_type` | — | `{nodes,edges}` |
| GET | `/traces?limit&member_id` | — | `[Trace]` |
| GET | `/traces/{id}` | — | `Trace{stages:[{name,kind,duration_ms,...}]}` |

**Endpoints added in this build** (to back screens with real server data instead of mock JS):
`PUT /settings` (runtime model/key), `GET /prompts` (versioned catalogue), `GET /safety/policy` +
`PUT /safety/policy`, `GET /eval/scenarios` + `POST /eval/run`, `GET /metrics` (cost/latency aggregates
from the trace store), session endpoints. _(Status tracked in §5.)_

**Routing (multi-agent):** `RouterDecision{route∈{COACH,WORKOUT_GENERATE,WORKOUT_LOG,EXPLAIN,CLARIFY},
confidence, rationale}`. Hub = LangGraph `StateGraph(HubState)` route→retrieve→dispatch→final, with a
hand-rolled fallback if langgraph is absent.

**Seed members (exact IDs):** `demo-synth-alex` (Synth-Alex, right-knee, dumbbell-only),
`demo-synth-jordan` (Synth-Jordan, shoulder, bodyweight), `demo-synth-sam` (Synth-Sam, full gym, no injury).

**Graph ontology:** 12 node types (Member, Goal, Preference, Equipment, Injury, Joint, Exercise,
MuscleGroup, MovementPattern, Workout, WorkoutLog, ContextSignal) · 13 edge types (HAS_GOAL, PREFERS,
HAS_EQUIPMENT, HAS_INJURY, AFFECTS_JOINT, LOADS_JOINT, TRAINS_MUSCLE, USES_EQUIPMENT,
HAS_MOVEMENT_PATTERN, COMPLETED_WORKOUT, MENTIONED_IN, CONTRAINDICATES, HAS_BILATERAL_PAIR). Every
node/edge carries lineage (source, source_id, created_at, ingester, confidence). Schema version 1.0.0.

**Safety policy:** versioned, 4 levels (lenient/standard/strict/max); rules for contraindicated joints,
bilateral pairs, unknown `joints_loaded`, equipment match, resolved-injury fade. Enforced at retrieval,
generation, and validation.

## 4. Architecture

```
web/ (Vite + React)  ──build──►  static assets
       │ dev: proxy /api → :8000        │
       ▼                                 ▼
FastAPI (app.main:app) ── serves SPA + REST API
       │
       ├─ LangGraph hub (router→retrieve→dispatch→final)
       ├─ GraphRAG (vector + graph traversal, token-budgeted)
       ├─ Safety (retrieval label · generation exclusion · validator)
       ├─ LLM: openai | anthropic | fake     (runtime-switchable)
       └─ GraphClient Protocol → Neo4j | InMemory
                                   │
                            Neo4j 5 (seeded synthetic data)
```

Single Docker image (multi-stage: build web → copy into Python image → uvicorn serves both).
Local: `docker compose up` (Neo4j + app). Deploy: Railway (Neo4j service + app service).

## 5. Progress tracker

Legend: ✅ done · 🔄 in progress · ⬜ todo

- ✅ Lock backend contract + verify 34 tests green
- ✅ Personal GitHub repo + `personal` remote + hardened .gitignore + baseline pushed
- 🔄 REPORT.md (this file)
- ✅ Backend: OpenAI provider (`app/llm/openai_llm.py`, wired into `build_llm`/`build_llm_from`/config)
- ✅ Backend: runtime `PUT /settings/llm` (provider/model/key; key in-process only, never returned)
- ✅ Backend: CORS + static SPA serving (`_mount_frontend`, no-op when build absent)
- ✅ Backend: support endpoints `/prompts`, `/safety/policy`(+policies,+PUT), `/metrics`, `/eval/scenarios`+`/eval/run`, `/sessions`
- ✅ Backend smoke: all new endpoints 200/201; live `/eval/run injury_filtering` PASSED; key loaded but never returned
- ✅ Backend: enriched `GET /members/{id}` with goals/preferences/injuries(+joints) for the frontend
- ⬜ Backend: confirm Neo4j seed via docker (deferred to Docker/deploy phase)
- ✅ Frontend scaffold: Vite + React, `web/` under `2-knowledge-graph/`. Builds clean (368 KB JS / 17 KB CSS)
- ✅ Frontend port mechanics: **window-shim** — the mock authored every component with
  `React.createElement` against a global `React` + `window.*` registration. We expose npm React via
  `globals.js`, import each ported module in order in `main.jsx`, and swap only `data.js`/`engine.jsx`
  for real-API adapters. Preserves the finished design verbatim. (Tweaks design-editor excluded.)
- ✅ Data layer (`lib/data.js`): synthetic data kept as **offline/degraded fallback**; `DB.init()` fetches
  the real backend (exercises, members+detail, subgraph counts, settings, schema, prompts, safety,
  scenarios, metrics) and overwrites the screen data shapes in place.
- ✅ Engine layer (`lib/engine.jsx`): sync helpers operate on real data; added async backend methods
  (`recommend`, `runAgent`, `explainLive`, `logWorkoutLive`, `retrieveLive`, `runEvalLive`) + a
  `/recommend`→screen-shape mapper. Coach Console now generates via the **real LangGraph hub** with a
  client-side fallback if the API errors.
- ✅ Frontend tests (Vitest, 4/4 green): DB.init real-data mapping, injury-aware safety eval, app shell
  render, and navigation across 9 representative screens without crashing.
- ✅ AI screens wired to the real backend: Coach Console (`/recommend`), Agent Console + Routing Tests
  (real LLM router via the hub), Evaluations (`/eval/run`), System Trace (`/traces`). All with graceful
  fallback to the local engine on error.
- ✅ Dockerized: multi-stage image (Node builds SPA → Python serves SPA+API). `docker compose up` brings
  up Neo4j + the app locally. Verified the single-service path serves SPA + real API + deep links.
- ✅ **Deployed to Railway** (single service, in-memory graph seeded on boot, OpenAI gpt-4o-mini via
  secret): https://future-coach-production.up.railway.app — health ok, 3 seeded members, live OpenAI
  recommendation routed + generated + validated end-to-end.
- 🔄 REPORT finalization (screen matrix + video outline below)
- ⬜ (polish, optional) wire Why-drawer to `/explain`, Comparison Harness to dual `/recommend`,
  Neo4j seed verified via live docker compose, resolve exclusion display names in the API payload
- ⬜ Frontend: Vite scaffold + design system port (styles, icons, ui, store, api client)
- ⬜ Frontend: 24 Knowledge-Graph screens
- ⬜ Frontend: 8 Multi-Agent screens
- ⬜ Frontend tests (Vitest)
- ⬜ Dockerize full stack + compose
- ⬜ Deploy to Railway
- ⬜ Finalize REPORT + presentation outline

## 6. How to run

**Live:** https://future-coach-production.up.railway.app (no setup; OpenAI-backed).

**Local — full stack with the real Neo4j database (assessment's one-command requirement):**
```bash
cd 2-knowledge-graph
cp .env.example .env            # optional: set OPENAI_API_KEY + COACH_KG_LLM_PROVIDER=openai
docker compose up -d --build    # Neo4j + app, seeded on boot
open http://localhost:8000      # the UI (FastAPI serves the built SPA + API)
```

**Local — frontend dev against the API (hot reload):**
```bash
cd 2-knowledge-graph
COACH_KG_GRAPH_BACKEND=memory COACH_KG_LLM_PROVIDER=fake uvicorn app.main:app --reload  # :8000
cd web && npm install && npm run dev     # :5173, proxies to :8000 via VITE_API_BASE
```

**Tests:** backend `pytest` (34) · frontend `cd web && npm test` (Vitest, 4). Both run fully offline
(in-memory graph + FakeLLM).

## 7. Screen inventory → requirement coverage

31 screens, all reachable from the sidebar / command palette (⌘K). "Data" = where the screen's data
comes from: **API** (live backend/DB), **API+derived** (real data, client-side assembly), or
**fixture** (tasteful synthetic UI data, clearly labelled — for surfaces with no backing endpoint).

### Knowledge-Graph platform (assessment #2)

| Screen | screens.md § | Data | What it proves |
|---|---|---|---|
| Member Dashboard | 1 | API | Member context, injuries, equipment, graph health from the real graph |
| Coach Console | 2 | **API** | Real `/recommend` (LangGraph hub → GraphRAG → safety → OpenAI → validator) + staged trace |
| Recommendation Detail | 3 | API | Structured workout, exclusions, validation report, version footer |
| Why Explanation Drawer | 4 | API+derived | Graph-path reasoning for include/skip (client renders real graph facts; `/explain` available) |
| Graph Explorer | 5 | API+derived | Force-graph over the real member subgraph + safety neighbourhood |
| Ingestion | 6 | API | `/ingest/signal` extraction preview → nodes/edges; synthetic-data guard |
| Member Context Editor | 7 | API | Edit goals/equipment/injuries |
| Exercise Library | 8 | **API** | All 50 exercises with member-aware safety labels (`/exercises?member_id`) |
| Exercise Detail | 9 | API | Full metadata + member safety panel + bilateral pair |
| Safe Swap Picker | 10 | API+derived | Safe alternatives by pattern/muscle, avoiding loaded joints |
| API & Schema Explorer | 11 | API | Live endpoint list + payloads |
| System Trace | 12 | **API** | Real recorded traces (`/traces`) with per-stage latency + tokens |
| Evaluations | 13 | **API** | `/eval/run` drives the real hub; live pass/warn/fail per critical path |
| Demo Walkthrough | 14 | scripted | Guided knee-injury → session → why flow |
| Weekly Programming | 15 | API+derived | Microcycle view, volume/joint budgets |
| History & Adherence | 16 | fixture | Longitudinal timeline (no history endpoint — labelled synthetic) |
| Settings | 17 | **API** | Live `/settings` + `PUT /settings/llm` (provider/model/**key**) |
| Prompt Inspector | 18 | **API** | Versioned `/prompts` catalogue with hashes + variables |
| Schema & Ontology | 19 | **API** | `/graph/schema` node/edge catalogue + invariants |
| Comparison Harness | 20 | API+derived | A/B configs with safety-divergence diff |
| Conversations | 21 | API | `/sessions` store with recency window |
| Cost & Performance | 22 | API+fixture | Real latency percentiles from `/metrics`; cost series labelled estimated |
| Safety Policy Editor | 23 | **API** | Live `/safety/policy` (+levels, +PUT) |
| Tradeoffs & Notes | 24 | fixture | In-product ADRs / cut list |

### Multi-agent system (assessment #1)

| Screen | screens.md § | Data | What it proves |
|---|---|---|---|
| Agent Console | MA-1 | **API** | Real **LLM structured-output routing** (RouterDecision) + routed sub-agent response |
| Coach Answer Result | MA-2 | API | Dataset-grounded coaching answer |
| Workout Generator Result | MA-3 | API | `search_exercises` tool results + no-results recovery |
| Workout Logger Result | MA-4 | API | Real fuzzy match (`/log`); missing weight stays null |
| Exercise Search Drawer | MA-5 | API | Tool result inspection |
| Routing Tests | MA-6 | **API** | 5 prompts routed by the real LLM router; pass/fail vs expected |
| StateGraph Topology | MA-7 | static | Hub graph + composed sub-agents + typed state |
| Memory Inspector | MA-8 | API | Conversation window / eviction / pin (multi-turn memory) |

### Requirement coverage (both ASSESSMENT files)

| Requirement | Where |
|---|---|
| Knowledge graph in a graph DB + documented schema | Neo4j (compose) / in-memory adapter; `GET /graph/schema`; Schema & Ontology screen |
| Ingestion pipeline (raw context → nodes/edges) | `app/ingestion/*`; Ingestion screen |
| GraphRAG (graph traversal + vector) | `app/retrieval/graph_rag.py`; Coach Console trace panel |
| Injury-aware, explainable generation | safety enforced at retrieval/generation/validation; Why drawer; live eval `injury_filtering` passes |
| REST API, typed schemas | FastAPI + Pydantic; API Explorer; `/docs` |
| Frontend demo | this whole app (31 screens) |
| Dockerized one-command setup | `docker compose up` |
| Test ≥2 critical paths | backend pytest (injury filter, retrieval, validator, router, logger, hub e2e, API) + `/eval/run` live + frontend Vitest |
| "How I'd evaluate in production" | `2-knowledge-graph/README.md` §; Cost/Eval screens |
| Hub = LangGraph StateGraph, typed state, explicit edges | `app/agents/hub.py`, `state.py`; Topology screen |
| Sub-agents as composed graphs | `app/agents/{router,coach,generator,logger,explainer,safety_reviewer}.py` |
| Routing via LLM structured output | `RouterDecision` structured output; Agent Console shows the parsed object |
| Tools with Pydantic schemas | `app/agents/tools.py` |
| Resilience (no results / invalid tool call) | validator correction; no-results recovery; Routing Tests |

## 8. Presentation video outline

Target ~4–6 min. Open on the live URL.

1. **Hook (20s).** "One product, both take-homes: a coach-facing assistant where every injury-aware
   recommendation is explained by a knowledge graph." Show the dashboard for Synth-Alex (active knee).
2. **The graph is load-bearing (45s).** Graph Explorer → toggle safety neighbourhood → show
   `Member → HAS_INJURY → knee → LOADS_JOINT ← Exercise`. Emphasise: this is why we can explain *why*.
3. **Generate, live (60s).** Coach Console → "Build a lower-body session for this week." Watch the staged
   trace (route → retrieve → expand → filter → generate → validate). Real OpenAI. Point at the excluded
   knee-loaders and the right-rail retrieval/safety trace.
4. **Explainability (40s).** Click "Why included / Why skipped" → graph path + member facts + the safety
   rule that fired. This is the differentiator vs semantic search.
5. **Safety holds up (40s).** Evaluations → Run all → `injury_filtering` PASSES live (no contraindicated
   joint in the plan). Mention the 3-layer enforcement.
6. **Multi-agent track (45s).** Agent Console → run the 5 example prompts; show the **parsed
   RouterDecision** (LLM structured output), the ambiguous "Bench press." → CLARIFY, and the no-results
   recovery. Routing Tests for the table. Topology for the StateGraph.
7. **Production thinking (30s).** Settings (swap model/key), Prompt Inspector (versioned), Safety Policy
   editor, System Trace (real per-stage latency/tokens), Cost dashboard. "This is the surface I'd tune
   and monitor in production."
8. **Close (20s).** Tradeoffs screen → what I cut and why. Mention: `docker compose up`, tests green,
   synthetic-data-only banner, deployed on Railway.
