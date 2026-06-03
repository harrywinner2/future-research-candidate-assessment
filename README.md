# Future · Coach Intelligence

**A coach-facing AI assistant where every injury-aware recommendation is explained by a knowledge graph.**
One product that satisfies both AI-engineering take-homes in this repo — a **Knowledge-Graph coaching
platform** (GraphRAG, injury-aware, explainable) and a **multi-agent system** (LangGraph hub with
LLM-routed sub-agents) — sharing one backend, one design system, and one deployed app.

🎥 **Demo walkthrough (5 min):** https://youtu.be/aMN48IvN5gs
🔗 **Live demo:** https://future-coach-production.up.railway.app
📦 **Submission report (decisions, architecture, screen matrix, demo script):** [`REPORT.md`](./REPORT.md)
📄 **Backend deep-dive + "How I'd evaluate in production":** [`2-knowledge-graph/README.md`](./2-knowledge-graph/README.md)

> **Synthetic data only.** A persistent banner and ingestion guards enforce it; do not enter real member data.

> **About the demo video:** the on-screen walkthrough was scripted and directed by me (the human author).
> The voiceover narration is AI-generated (OpenAI text-to-speech) purely for audio quality and consistency —
> every word, scene, and claim in it is mine. The reproducible pipeline that records the live app and
> assembles the narration lives in [`presentation/`](./presentation) (the rendered video file is gitignored).

---

## What it does

A coach can ask things like *"Build this member a lower-body session for this week,"* *"Why did you skip
barbell squats for her?"*, or *"What should I watch for?"* — and the system:

- ingests member context (profile, injuries, chat signals) into a **knowledge graph**,
- retrieves the safety-relevant slice via **GraphRAG** (graph traversal + vector search),
- generates an **injury-aware** workout (an exercise loading an injured joint never appears),
- **explains** each decision by pointing at graph relationships (`Member → HAS_INJURY → knee →
  LOADS_JOINT ← Exercise`), and
- recovers gracefully when retrieval is thin, equipment is missing, or the model returns something invalid.

The multi-agent track exposes the same hub as a router that classifies each request with **LLM structured
output** and dispatches to coach / workout-generator / workout-logger sub-agents.

## Architecture

```
web/ (Vite + React, 31 screens)  ──build──►  FastAPI serves SPA + REST API
                                                  │
   LangGraph hub: router → retrieve → dispatch → final (safety review)
   GraphRAG (vector + graph traversal, token-budgeted) · 3-layer safety
   LLM: openai | anthropic | fake (runtime-switchable in the Settings screen)
   GraphClient Protocol → Neo4j (docker compose) | in-memory (tests / live demo)
```

## Run it

**Full stack, one command (real Neo4j database):**
```bash
cd 2-knowledge-graph
cp .env.example .env          # optional: OPENAI_API_KEY + COACH_KG_LLM_PROVIDER=openai
docker compose up -d --build  # Neo4j + app, seeded on boot
open http://localhost:8000
```

**Frontend dev (hot reload) against the API:**
```bash
cd 2-knowledge-graph && uvicorn app.main:app --reload      # :8000 (memory + fake LLM by default)
cd web && npm install && npm run dev                       # :5173
```

**Tests (fully offline):** backend `cd 2-knowledge-graph && pytest` · frontend `cd 2-knowledge-graph/web && npm test`

## Repo layout

| Path | What |
|---|---|
| `2-knowledge-graph/app/` | FastAPI + LangGraph hub + GraphRAG + safety + ingestion (the backend) |
| `2-knowledge-graph/web/` | Vite + React frontend (all 31 screens), wired to the API |
| `2-knowledge-graph/tests/` | Backend tests (injury filter, retrieval, validator, router, logger, hub e2e, API) |
| `1-multi-agent/` , `2-knowledge-graph/*ASSESSMENT.md` | The original take-home specs |
| `screens.md` | The authoritative UI specification |
| `REPORT.md` | Full build report + presentation-video script |

Built with FastAPI, LangGraph/LangChain, Pydantic, Neo4j, React/Vite, and OpenAI. Deployed on Railway.
