# Multi-Agent System — Implementation Notes

> This take-home (#1) is implemented as part of **one unified product** that also covers the
> knowledge-graph take-home (#2). The multi-agent hub lives in `../2-knowledge-graph/app/` and is
> surfaced in the deployed UI under the **"Multi-Agent"** sidebar group.

- **Live demo:** https://future-coach-production.up.railway.app → sidebar **Multi-Agent → Agent Console**
- **Code:** `../2-knowledge-graph/app/agents/`
- **Tests:** `../2-knowledge-graph/tests/` (`pytest`)

## Where each requirement is satisfied

| Requirement (ASSESSMENT.md) | Where |
|---|---|
| Hub is a LangGraph `StateGraph` with typed state + explicit edges | `app/agents/hub.py` (`build_hub` → `StateGraph(HubState)`, entry `route → retrieve → dispatch → final → END`), typed state in `app/agents/state.py` (`HubState`, `RouterDecision`) |
| Routing uses **LLM structured output** (not regex/keywords) | `app/agents/router.py` → `llm.structured_complete(prompt, RouterDecision)`; the parsed `RouterDecision{route, confidence, rationale}` is rendered live in the Agent Console's router panel |
| Ambiguous input handled with a confidence score / fallback | `Route.CLARIFY` + a confidence field; router prompt prefers `CLARIFY` under 0.5; the hub emits a clarifying question instead of guessing |
| Sub-agents composed into the hub (not inlined) | Separate modules: `router.py`, `coach.py`, `generator.py`, `logger.py`, `explainer.py`, `safety_reviewer.py`, dispatched by the hub's `dispatch` node (see architecture note below) |
| Workout Generator: `search_exercises` + `build_workout` | `app/agents/tools.py` (`SearchExercisesInput` / `search_exercises`; `BuildWorkoutInput` is the structured-output contract the generator emits) |
| Workout Logger: parse + fuzzy match, JSON out | `app/agents/logger.py` + `fuzzy_match_exercise` (rapidfuzz); missing weight stays `null`, never invented |
| Tools have Pydantic input schemas with field descriptions | `app/agents/tools.py` (all input fields carry `Field(description=...)`) |
| Resilience: no search results / invalid tool call | no-results recovery in the generator + Agent Console; `app/safety/validator.py` catches unknown exercise ids / contraindicated movements and corrects or regenerates |
| Test ≥2 critical paths | `tests/test_router.py` (ambiguous → clarify), `tests/test_logger.py` (fuzzy match, null weight), `tests/test_hub_e2e.py` (full StateGraph run) — plus the live Routing Tests screen |
| Runnable demo | Agent Console + Routing Tests + Demo Walkthrough screens; `docker compose up` |

## Setup & demo

```bash
cd ../2-knowledge-graph
# offline (no key): deterministic FakeLLM, in-memory graph
COACH_KG_LLM_PROVIDER=fake uvicorn app.main:app --reload      # API on :8000
# or full UI: docker compose up -d --build  → http://localhost:8000
pytest                                                        # critical-path tests
```

In the UI, open **Multi-Agent → Agent Console** and try the example prompts (coach question, generate,
log, the ambiguous "Bench press.", and the no-results "rowing machine + sled"). The right panel shows
the **parsed `RouterDecision`** (route, confidence, rationale, StateGraph path) — evidence that routing
used structured output. **Routing Tests** runs all five through the real router and scores them.

## Architecture note (tradeoff, per "make a reasonable decision and document it")

The **hub** is the `StateGraph` (typed `HubState`, explicit conditional edges). Sub-agents are
**separate, independently-testable modules** invoked by the hub's `dispatch` node — they are not inlined
into the hub function (each has its own file, prompt template, and tests). I deliberately kept them as
composable async units rather than wrapping each in its own *compiled* `StateGraph`: at this scope a
per-sub-agent graph adds ceremony without changing behaviour or testability, and the hard requirement —
a typed `StateGraph` with explicit edges — is met at the hub level. Promoting each sub-agent to its own
compiled sub-graph is a clean, mechanical follow-up if a deployment wants per-sub-agent graph telemetry.

## How I would evaluate this multi-agent system in production

**Routing quality (the leading metric).** Track per-route precision/recall against a labelled prompt set,
and the **confidence calibration curve** (does 0.6 confidence mean ~60% correct?). A regression here
poisons everything downstream. Re-run the labelled set on every router-prompt or model change.

**Clarification rate.** The fraction of turns routed to `CLARIFY`. Too high = the router is timid or the
threshold is wrong; near-zero with misroutes = it's guessing. Watch it alongside misroute rate, not alone.

**Tool-call success.** For the generator/logger: rate of valid tool calls (well-formed args, known
exercise ids) vs. schema/id failures the validator had to catch. A rising correction rate means the model
is drifting; zero corrections *and* zero audited issues can mean the validator is asleep.

**No-results recovery.** Rate at which `search_exercises` returns empty and the system recovers
(asks to relax equipment / offers bodyweight) versus crashes or hallucinated exercises. Target: 100%
graceful.

**Logger fidelity.** Fuzzy-match accuracy (top-1 correct), and the rate at which missing fields are left
`null` rather than invented — a safety-of-data metric.

**Latency & cost per route.** p50/p95 per stage (route/retrieve/generate/validate) with budgets; routing
should be cheap and fast (use a small model for it and reserve the larger model for generation). Surfaced
on the Cost & System Trace screens.

**Failure modes to monitor.** LLM rate-limit/timeout (queue, never silently drop); structured-output
parse failures (retry-with-feedback budget); a model update silently changing routing distribution
(alert on route-mix drift); ambiguous-input regressions (the labelled "ambiguous" subset must keep
routing to `CLARIFY`).
