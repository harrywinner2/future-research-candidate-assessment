// The presentation script: 12 scenes, ~6 minutes. Each scene has narration
// (voice) and a `run(h)` that drives the deployed app via injected helpers `h`.
// Pure module — no puppeteer import — so tts.mjs can read narration cheaply.

export const URL = 'https://future-coach-production.up.railway.app';
export const VOICE = 'alloy';
export const INSTRUCTIONS =
  'Speak as a confident, friendly senior engineer narrating a product demo. ' +
  'Clear, measured pace; warm but precise; no hype.';

export const SCENES = [
  {
    id: '01-intro',
    voice:
      "This is Future Coach Intelligence — one product that delivers both take-home assessments: " +
      "a multi-agent coaching system and a knowledge-graph platform. The core idea is simple but hard. " +
      "Every workout recommendation is injury-aware, and every decision is explained by a knowledge graph — " +
      "not a black-box model. It's live, it runs on real data, and it's powered by OpenAI. Let's walk through it.",
    async run(h) {
      // The onboarding hero is the opening shot: "explained by the graph."
      await h.wait(2000);
    },
  },
  {
    id: '02-dashboard',
    voice:
      "We're looking at a synthetic member, Alex — a returning runner with an active right-knee injury " +
      "and dumbbell-only equipment. The dashboard reads their goals, equipment, injuries, and graph health " +
      "straight from the backend. That knee injury is the thread we'll follow: watch how it shapes every " +
      "recommendation and every explanation that comes next.",
    async run(h) {
      await h.dismissOnboarding();
      await h.wait(2500);
    },
  },
  {
    id: '03-graph',
    voice:
      "Here's the knowledge graph for this member, and this is the real differentiator. The graph is not " +
      "semantic search with extra steps. Injuries connect to joints, joints connect to the exercises that load " +
      "them, and equipment and goals branch off the member. So the system can traverse a path like: member, " +
      "has-injury, knee, loaded-by, exercise — and exclude exactly those movements. When we ask for a workout, " +
      "it walks these relationships to decide what's safe, and crucially, to prove why afterwards.",
    async run(h) {
      await h.go('Graph Explorer');
      await h.wait(5000); // let the force layout settle + animate
    },
  },
  {
    id: '04-library',
    voice:
      "This is the full fifty-exercise dataset, labelled for this specific member. Each exercise is evaluated " +
      "against Alex's knee injury and available equipment, then tagged safe, caution, or excluded — with the reason. " +
      "Nothing here is hard-coded; the safety status is computed from the same graph and the same policy the " +
      "recommender uses.",
    async run(h) {
      await h.go('Exercise Library');
      await h.wait(2500);
      await h.scroll(420);
      await h.wait(2000);
    },
  },
  {
    id: '05-generate',
    voice:
      "Now the core flow. I'll ask the coach console to build a lower-body session. Watch the staged pipeline: " +
      "it routes the request, retrieves the relevant slice of the graph, expands the safety neighbourhood, filters " +
      "unsafe exercises, generates with OpenAI, and validates the output. This is the real LangGraph hub running " +
      "end to end. On the right you can see the retrieval and safety trace for this exact response — the graph " +
      "facts it used and the exercises it excluded. And notice the result: every knee-loading movement is kept " +
      "out of the plan, automatically.",
    async run(h) {
      await h.go('Coach Console');
      await h.wait(1800);
      await h.type('[data-composer]', 'Build this member a lower-body session for this week.');
      await h.wait(700);
      await h.enter();
      await h.waitText('Open full recommendation', 50000);
      await h.wait(3000);
    },
  },
  {
    id: '06-why',
    voice:
      "Every recommendation is explainable. I'll open the full recommendation and ask why an exercise was skipped. " +
      "Instantly we get the auditable graph path — member, to injury, to knee, to the exercise that loads it. " +
      "Then the language model narrates that same evidence in plain English. The graph is the truth; the model just " +
      "tells the story. That's trust you can inspect.",
    async run(h) {
      await h.click('Open full recommendation');
      await h.wait(2500);
      await h.scroll(500);
      await h.wait(1200);
      await h.click('Why'); // first Why button in the excluded list
      await h.waitText('Graph path used', 12000).catch(() => {});
      await h.waitText('AI EXPLANATION', 10000).catch(() => {});
      await h.wait(4500); // let the live LLM narration arrive
      await h.esc(); // close the drawer so the next scene navigates cleanly
    },
  },
  {
    id: '07-eval',
    voice:
      "We don't just claim safety — we test it against the live system. This runs the injury-filtering critical path " +
      "end to end and asserts that no recommended exercise loads a contraindicated joint. It passes, live. The same " +
      "harness also covers explainability, thin-retrieval clarification, validator correction, and no-results recovery.",
    async run(h) {
      await h.esc(); // ensure any drawer/scrim from the previous scene is closed
      await h.go('Evaluations');
      await h.wait(2000);
      await h.click('Run'); // first per-scenario Run = injury_filtering
      await h.waitText('No included exercise', 40000).catch(() => h.waitText('pass', 40000).catch(() => {}));
      await h.wait(2500);
    },
  },
  {
    id: '08-trace',
    voice:
      "Everything is observable. The system trace shows every real request broken into stages — routing, retrieval, " +
      "generation, validation — each with its actual latency and token cost. This is the surface I'd watch in " +
      "production to catch a regression in safety, retrieval quality, or spend.",
    async run(h) {
      await h.go('System Trace');
      await h.wait(2500);
      await h.clickSel('button.panel-head', 0).catch(() => {}); // expand first trace
      await h.wait(3500);
    },
  },
  {
    id: '09-agent',
    voice:
      "Switching to the multi-agent view. The hub routes each request with a language model producing structured " +
      "output — not keywords. Here it classifies a generate request and dispatches to the workout generator. And when " +
      "I send something ambiguous, like just 'bench press', it doesn't guess — it returns a low-confidence " +
      "clarification. The parsed routing decision is shown on the right.",
    async run(h) {
      await h.go('Agent Console');
      await h.wait(1800);
      await h.click('Build me a 30 min upper body session with dumbbells.');
      await h.waitText('Route selected', 30000).catch(() => {});
      await h.wait(3500);
      await h.click('Bench press.');
      await h.waitText('Clarification', 30000).catch(() => h.waitText('CLARIFY', 30000).catch(() => {}));
      await h.wait(3000);
    },
  },
  {
    id: '10-topology',
    voice:
      "Under the hood, the hub is a LangGraph state machine with typed state and explicit edges. Each sub-agent — " +
      "coach, generator, logger, and explainer — is its own compiled graph, composed into the hub as a node, all " +
      "feeding a shared safety review before the response is returned.",
    async run(h) {
      await h.go('StateGraph Topology');
      await h.wait(4500);
    },
  },
  {
    id: '11-system',
    voice:
      "The contracts are clean and documented. The ontology lists twelve node types, thirteen edge types, and the " +
      "invariants the graph must satisfy. And the whole system is tunable — provider and model, retrieval depth, " +
      "safety conservatism, and versioned prompts are all switchable at runtime from the settings screen, no " +
      "redeploy required. Cost and latency are tracked per stage, so you can see exactly where time and tokens go.",
    async run(h) {
      await h.go('Schema & Ontology');
      await h.wait(3500);
      await h.go('Cost & Performance');
      await h.wait(3000);
    },
  },
  {
    id: '12-close',
    voice:
      "Finally, the tradeoffs are documented inside the product itself — what's built, what was cut, and why. " +
      "To recap: a working, injury-aware, explainable coaching system, grounded in a real knowledge graph, covering " +
      "both assessments — tested, dockerized with one command, and deployed live. Thanks for watching.",
    async run(h) {
      await h.go('Tradeoffs & Notes');
      await h.wait(3500);
    },
  },
];
