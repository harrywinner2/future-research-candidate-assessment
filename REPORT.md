# Build Report — Future Coach Intelligence

> Living document. Traces every decision and unit of work, doubles as the script source for the
> presentation video, and is the continuity record if work is resumed in a fresh session.

**Repo (submission):** https://github.com/harrywinner2/future-research-candidate-assessment
**Live demo:** _(filled in after Railway deploy)_
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
- ⬜ Frontend: Vite scaffold + design system port (styles, icons, ui, store, api client)
- ⬜ Frontend: 24 Knowledge-Graph screens
- ⬜ Frontend: 8 Multi-Agent screens
- ⬜ Frontend tests (Vitest)
- ⬜ Dockerize full stack + compose
- ⬜ Deploy to Railway
- ⬜ Finalize REPORT + presentation outline

## 6. Screen inventory → requirement coverage

_(Filled in as screens are built. Each maps to a spec section in `screens.md` and a requirement in the
two ASSESSMENT files.)_

## 7. Presentation video outline

_(Filled in once the demo is live.)_
