"""LangGraph hub that composes every sub-agent.

The hub is intentionally thin — each node calls into one of the sub-agent
modules. Routing edges fan out from the router decision; every path
terminates at the safety reviewer so the same final-correctness gate runs
regardless of route.

If ``langgraph`` is not installed (e.g. for very minimal test environments)
the hub falls back to a hand-rolled async dispatch with the same edge
semantics, defined in :func:`_fallback_run`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional

from app.agents import coach as coach_agent
from app.agents import explainer as explainer_agent
from app.agents import generator as generator_agent
from app.agents import logger as logger_agent
from app.agents import router as router_agent
from app.agents import safety_reviewer
from app.agents.state import HubState, Route
from app.graph.client import GraphClient
from app.llm.client import LLMClient
from app.retrieval.graph_rag import GraphRAG
from app.safety.policy import SafetyPolicy
from app.schemas.retrieval import RetrievalContext, RetrievalRequest
from app.schemas.trace import StageType
from app.observability.trace import with_stage


@dataclass
class HubServices:
    llm: LLMClient
    graph: GraphClient
    rag: GraphRAG
    policy: SafetyPolicy


async def _retrieve(state: HubState, services: HubServices) -> HubState:
    if not state.member_id:
        return state.model_copy(
            update={
                "retrieval": RetrievalContext(
                    facts=[], member_summary="(no member selected)", token_estimate=0
                )
            }
        )
    async with with_stage(
        "retrieval",
        StageType.RETRIEVE,
        inputs={"member_id": state.member_id, "query": state.request},
    ) as stage:
        result = await services.rag.retrieve(
            RetrievalRequest(member_id=state.member_id, query=state.request)
        )
        stage.outputs = {
            "vector_hits": result.vector_hits,
            "graph_expansions": result.graph_expansions,
            "excluded": result.excluded_count,
            "fact_count": len(result.context.facts),
        }
    return state.model_copy(update={"retrieval": result.context})


async def _route_dispatch(state: HubState, services: HubServices) -> HubState:
    if not state.decision:
        return state
    if state.decision.route == Route.CLARIFY:
        return state.model_copy(
            update={
                "clarification_question": (
                    "I'm not sure what you'd like me to do — could you say a bit more? "
                    "For example: 'build me a 30-min lower-body session', 'log my last set', "
                    "or 'why did you skip squats?'."
                )
            }
        )
    ctx = state.retrieval or RetrievalContext(facts=[], member_summary="", token_estimate=0)
    route = state.decision.route
    if route == Route.COACH:
        return await coach_agent.answer(state, services.llm, ctx)
    if route == Route.WORKOUT_GENERATE:
        return await generator_agent.generate(
            state, llm=services.llm, graph=services.graph, policy=services.policy, context=ctx
        )
    if route == Route.WORKOUT_LOG:
        return await logger_agent.log_workout(state, llm=services.llm, graph=services.graph)
    if route == Route.EXPLAIN:
        target = state.scratch.get("explain_exercise_id") or _first_excluded(ctx)
        if not target:
            return state.model_copy(
                update={"explanation": "No specific exercise referenced; ask about one by id or name."}
            )
        return await explainer_agent.explain(
            state,
            llm=services.llm,
            graph=services.graph,
            policy=services.policy,
            exercise_id=target,
            action="skipped",
        )
    return state


async def _final(state: HubState, services: HubServices) -> HubState:
    if state.recommendation:
        return await safety_reviewer.review(state, graph=services.graph, policy=services.policy)
    return state


def _first_excluded(ctx: RetrievalContext) -> Optional[str]:
    return ctx.exclusion_list[0] if ctx.exclusion_list else None


CLARIFY_TEXT = (
    "I'm not sure what you'd like me to do — could you say a bit more? "
    "For example: 'build me a 30-min lower-body session', 'log my last set', "
    "or 'why did you skip squats?'."
)


def _ctx_of(state: HubState) -> RetrievalContext:
    return state.retrieval or RetrievalContext(facts=[], member_summary="", token_estimate=0)


def _make_subagent_graph(name: str, runner: Callable[[HubState], Any]) -> Any:
    """Compile a single sub-agent coroutine ``(state) -> state`` into its own
    one-node ``StateGraph``. These compiled graphs are composed into the hub as
    nodes — so each sub-agent is a separate graph, not an inlined function.
    """
    from langgraph.graph import END, StateGraph

    g = StateGraph(HubState)
    g.add_node(name, runner)
    g.set_entry_point(name)
    g.add_edge(name, END)
    return g.compile()


def build_hub(services: HubServices) -> Any:
    """Build the hub ``StateGraph`` if LangGraph is available, else return ``None``.

    Topology: ``route → retrieve → {coach | generate | log | explain | clarify}``,
    where each of coach/generate/log/explain is a **separately-compiled sub-agent
    graph composed in as a node**; all feed the shared ``final`` safety review
    before ``END``. Both this path and :func:`_fallback_run` produce the same
    final ``HubState``; :func:`run_hub` picks the right one.
    """
    try:
        from langgraph.graph import END, StateGraph
    except ImportError:  # pragma: no cover - exercised only when langgraph missing
        return None

    async def coach_run(state: HubState) -> HubState:
        return await coach_agent.answer(state, services.llm, _ctx_of(state))

    async def generator_run(state: HubState) -> HubState:
        return await generator_agent.generate(
            state, llm=services.llm, graph=services.graph, policy=services.policy, context=_ctx_of(state)
        )

    async def logger_run(state: HubState) -> HubState:
        return await logger_agent.log_workout(state, llm=services.llm, graph=services.graph)

    async def explainer_run(state: HubState) -> HubState:
        target = state.scratch.get("explain_exercise_id") or _first_excluded(_ctx_of(state))
        if not target:
            return state.model_copy(
                update={"explanation": "No specific exercise referenced; ask about one by id or name."}
            )
        return await explainer_agent.explain(
            state,
            llm=services.llm,
            graph=services.graph,
            policy=services.policy,
            exercise_id=target,
            action="skipped",
        )

    # Each sub-agent is its own compiled StateGraph, composed into the hub below.
    coach_graph = _make_subagent_graph("coach_agent", coach_run)
    generate_graph = _make_subagent_graph("workout_generate", generator_run)
    log_graph = _make_subagent_graph("workout_log", logger_run)
    explain_graph = _make_subagent_graph("explainer_agent", explainer_run)

    async def route_node(state: HubState) -> HubState:
        return await router_agent.route(state, services.llm)

    async def retrieve_node(state: HubState) -> HubState:
        return await _retrieve(state, services)

    async def clarify_node(state: HubState) -> HubState:
        return state.model_copy(update={"clarification_question": CLARIFY_TEXT})

    async def final_node(state: HubState) -> HubState:
        return await _final(state, services)

    def select_route(state: HubState) -> str:
        if not state.decision:
            return "clarify"
        return {
            Route.COACH: "coach",
            Route.WORKOUT_GENERATE: "generate",
            Route.WORKOUT_LOG: "log",
            Route.EXPLAIN: "explain",
            Route.CLARIFY: "clarify",
        }.get(state.decision.route, "clarify")

    graph = StateGraph(HubState)
    graph.add_node("route", route_node)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("coach", coach_graph)          # composed sub-agent graph
    graph.add_node("generate", generate_graph)    # composed sub-agent graph
    graph.add_node("log", log_graph)              # composed sub-agent graph
    graph.add_node("explain", explain_graph)      # composed sub-agent graph
    graph.add_node("clarify", clarify_node)
    graph.add_node("final", final_node)

    graph.set_entry_point("route")
    graph.add_edge("route", "retrieve")
    graph.add_conditional_edges(
        "retrieve",
        select_route,
        {"coach": "coach", "generate": "generate", "log": "log", "explain": "explain", "clarify": "clarify"},
    )
    for node in ("coach", "generate", "log", "explain"):
        graph.add_edge(node, "final")
    graph.add_edge("clarify", END)
    graph.add_edge("final", END)
    return graph.compile()


async def run_hub(services: HubServices, state: HubState) -> HubState:
    """Run the hub end-to-end.

    Uses LangGraph if compiled; otherwise falls back to the equivalent
    handwritten async pipeline.
    """
    compiled = build_hub(services)
    if compiled is None:
        return await _fallback_run(services, state)

    # LangGraph >=0.2 returns an async iterator or coroutine depending on version.
    result = await compiled.ainvoke(state)
    if isinstance(result, HubState):
        return result
    return HubState.model_validate(result)


async def _fallback_run(services: HubServices, state: HubState) -> HubState:
    state = await router_agent.route(state, services.llm)
    state = await _retrieve(state, services)
    state = await _route_dispatch(state, services)
    state = await _final(state, services)
    return state
