# Tradeoffs and Implementation Notes

What was implemented, what was deliberately cut, and what I'd build next.

## Implemented

- **Knowledge graph** with a versioned, documented ontology (node + edge catalogue exposed at `GET /graph/schema`).
- **Two graph backends behind one Protocol**: Neo4j for production, in-memory for tests. The same code path runs both.
- **GraphRAG** combining vector search (over context signals and exercise descriptions) with graph traversal (safety neighbourhood + member-centred N-hop expansion), assembled into a token-budgeted context window.
- **LangGraph hub** — a `StateGraph` with typed state (`HubState`) and explicit conditional edges. The coach, workout-generator, workout-logger and explainer sub-agents are each their **own compiled `StateGraph`**, composed into the hub as nodes (`_make_subagent_graph` in `app/agents/hub.py`); the router selects among them via conditional edges, and a shared `final` node runs the safety review. See `../1-multi-agent/IMPLEMENTATION.md`.
- **Safety enforced at three layers** — retrieval labels, generation prompt exclusion list, post-generation validator with bounded retry budget.
- **Versioned `SafetyPolicy`** with configurable conservatism levels (lenient / standard / strict / max). Every recommendation records the policy version used.
- **Versioned prompt template catalog** — each template has an id, version, and hash recorded in the trace.
- **Lineage on every fact** — node + edge metadata carries `source`, `source_id`, `created_at`, `confidence`. The Why drawer reads this directly.
- **In-process trace store** with stage timings, prompt versions, model id, retrieval context, validation outcome — feeds the Cost & Performance Dashboard.
- **Synthetic member generator** with knee-pain, shoulder-restriction, and bodyweight-only personas, plus a free generator that can mint members with arbitrary constraints.
- **Chat-signal extractor** — turns "my knee felt off after lunges" into a `ContextSignal` + `MENTIONED_IN` Joint relation with a confidence score.
- **Validator with correction** — catches unknown exercise IDs and contraindicated movements; either substitutes (single-exercise swap) or signals regeneration (whole-workout failure).
- **Fully offline test path** using `InMemoryGraphClient` + `FakeLLM` with scripted responses. `pytest` runs green with no API keys, no Docker, and no model downloads.
- **REST API** covering ingest / retrieve / recommend / explain / log / graph / settings / traces.
- **Docker compose** for the full stack (Neo4j 5 + API).

## Cut

- **Real vector index.** Default embeddings are a deterministic hash-based vector — semantic enough for the demo, free, no model download. `sentence-transformers` is wired in as an optional install (`pip install '.[embeddings]'`) for real semantic recall. A pgvector / Neo4j-vector-index integration is the next step.
- **Streaming.** The LangGraph hub supports streaming events; the API exposes only the buffered response. Server-sent events are a small follow-up.
- **Multi-turn memory.** State is per-request. A session store with windowed summarisation is sketched in `app/agents/state.py` but the persistence layer is left to the frontend session screen.
- **Frontend.** Per the brief, the frontend is being built separately against this API; the screens spec lives in `../screens.md`.
- **SNOMED grounding.** Joint and injury names use a clean hand-rolled vocabulary. The schema is intentionally small enough that swapping in SNOMED concept IDs later is a property addition, not a schema rewrite.
- **Auth.** Out of scope for the synthetic-data demo. The synthetic-data banner cross-cutting rule from screens.md is the privacy contract.

## What I'd build next

1. **Real vector index** (Neo4j 5 vector index or pgvector) with proper recall/precision evaluation against a fixed retrieval test set.
2. **Streaming SSE** on `/recommend` so the frontend's staged-progress loader binds to real events.
3. **Session store** for the Conversation History screen — Postgres-backed, with windowed memory summarisation.
4. **Evaluation harness CLI** that runs the scenario library and diffs against a baseline (currently scripted in tests; could be its own command).
5. **Per-tenant safety policies** — coaches and clinics will want different defaults; the policy is already versioned, just needs a scope dimension.

## Non-obvious design choices

**Why three safety enforcement points instead of one?** Pure retrieval-time filtering breaks down when the LLM hallucinates an exercise not in the retrieved set. Pure validator-only filtering is wasteful — the model spent tokens on a recommendation that will be rejected. Layering catches the common case at retrieval, narrows the model's option space at generation, and keeps the validator as the hard correctness floor.

**Why in-memory graph adapter for tests instead of testcontainers Neo4j?** Speed and CI simplicity. The full suite runs in under 2 seconds. Behavioural parity is enforced by a shared abstract test class (`tests/_graph_contract.py`) that both backends must pass.

**Why `FakeLLM` instead of a recorded-VCR fixture?** Determinism. The scripted responses live next to the tests that use them — failures point straight at the contract, not at a re-record mystery. Recorded fixtures are useful for prompt regression testing and would be added in the evaluation harness layer.

**Why LangGraph despite the assessment leaving the framework open?** It satisfies the multi-agent assessment's hard requirement (`StateGraph` with typed state) at no extra cost, and the explicit edge declarations show the orchestration topology to evaluators without them having to read every function.
