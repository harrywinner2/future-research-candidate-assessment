# Screens and Interaction Plan

This assessment repository describes two possible products in the same fitness coaching domain:

1. A 2-3 hour multi-agent assistant that routes user requests to a coach, workout generator, or workout logger.
2. A 1-2 day knowledge graph coaching platform that ingests synthetic member context, retrieves relevant graph context with GraphRAG, and generates injury-aware, explainable recommendations.

The screen plan below covers both. If only one assessment is assigned, use the relevant section. If choosing based on product depth, the knowledge graph platform should be the primary UI because its frontend is an explicit requirement and it gives more room to show reasoning, safety, retrieval, and explainability.

## Product Understanding

The product is a coach-facing AI assistant for fitness programming. Its core job is not just to answer fitness questions. It must show that the system can:

- Understand a coach or member's natural language request.
- Use the provided exercise dataset rather than inventing exercises.
- Generate structured workouts from exercise metadata.
- Log workouts from conversational text.
- Respect injuries and constraints by reasoning over `joints_loaded`, `movement_patterns`, equipment, and member history.
- Explain recommendations through traceable system behavior: router decisions for the multi-agent track, graph relationships for the knowledge graph track.
- Recover gracefully when input is ambiguous, retrieval is thin, no matching exercises exist, or an LLM/tool call returns invalid data.

The shared dataset has 50 exercises. Important UI-facing fields are:

- `name`
- `muscle_groups`
- `joints_loaded`
- `movement_patterns`
- `equipment_required`
- `supports_weight`
- `is_reps`
- `is_duration`
- `is_bilateral`
- `side`
- `bilateral_pair_id`
- `priority_tier`

The dataset includes weighted and bodyweight movements, duration and rep movements, bilateral paired exercises, mobility/regeneration movements, cardio movements, and joint-loaded movements across shoulder, elbow, wrist, hip, knee, ankle, cervical spine, thoracic spine, and lumbar spine. These fields should appear in filtering, safety explanations, workout cards, log parsing, and graph traces.

## Recommended Information Architecture

For the richer knowledge graph assessment, build a dashboard with these main areas:

- Coach Console: the main chat and recommendation workspace.
- Members: synthetic member profiles and their goals, injuries, equipment, preferences, history, and context signals.
- Graph Explorer: visual and tabular graph view showing nodes, edges, and retrieved neighborhoods.
- Exercise Library: searchable dataset browser with safety metadata.
- Ingestion: raw synthetic context input and ingestion results.
- Evaluations: critical path tests and production evaluation thinking.
- System Trace: request, retrieval, LLM/tool calls, validation, and safety review.

For the multi-agent assessment, build a smaller version:

- Agent Console: chat with visible router decision.
- Workout Builder Result: generated structured workout.
- Workout Log Result: parsed structured logs.
- Exercise Search Drawer: tool results from `search_exercises`.
- Demo Transcript: preloaded example flows and critical tests.

## Knowledge Graph Platform Screens

### 1. Member Dashboard

Purpose: Give the coach an immediate read on the selected synthetic member before asking the AI for recommendations.

Primary content:

- Member selector at the top left.
- Member summary header with name, age range or persona label, goal, available equipment, training frequency, and current risk flags.
- Safety strip showing active injuries or conditions, affected joints, severity, date noted, and current restriction rules.
- Recent activity panel showing last workouts, adherence, missed sessions, logged complaints, and coach notes.
- Recommendation shortcuts: lower-body session, upper-body session, recovery session, weekly plan (opens Weekly Programming View), what to watch for, explain last recommendation.
- Graph health indicators: nodes ingested, relationships created, last ingestion time, vector index status.
- Provenance summary: count of facts per source type (profile form, ingested chat signal, logged complaint, derived from rule), linkable to the audit trail.

Controls and interactions:

- Member selector opens a searchable dropdown. Selecting a member refreshes the entire dashboard and resets the active conversation context.
- `New synthetic member` button opens the member creation screen.
- `Edit context` button opens the member context editor.
- `Ingest new signal` button opens the ingestion screen with the current member preselected.
- Shortcut buttons send a templated prompt to the Coach Console. Example: clicking `Lower-body session` sends "Build this member a lower-body session for this week."
- Injury chips are clickable. Clicking a chip opens a side panel with graph facts: condition, affected joint, contraindicated movement patterns, matching excluded exercises, and source signal.
- Recent workout rows are clickable. Clicking one opens the workout detail and shows which exercises may influence current recommendations.

States:

- Empty member state: show a prompt to create or seed synthetic members.
- Thin graph state: show that the member exists but lacks enough context, with a CTA to ingest profile/history/signals.
- Risk state: if the member has injury constraints, show a persistent warning strip so the coach sees safety context before generating anything.

### 2. Coach Console

Purpose: Main chat/recommendation workspace for coach questions, workout generation, and explainability.

Layout:

- Left column: member context summary and prompt examples.
- Center: chat transcript.
- Right column: retrieval and safety trace for the selected assistant response.
- Bottom: message composer.

Message composer:

- Text input with placeholder examples:
  - "Build this member a lower-body session for this week."
  - "Why did you skip barbell squats for her?"
  - "What should I watch for with this member?"
- `Send` button.
- Optional `Generate workout` split button with presets: lower body, upper body, recovery, full body.
- Optional `Attach context` button for a raw note, chat snippet, or injury update.
- `Clear chat` button.

Interactions:

- Pressing Enter sends the message. Shift+Enter inserts a newline.
- While generating, show streaming or staged progress:
  1. Understanding request.
  2. Retrieving semantic context.
  3. Expanding graph neighborhood.
  4. Filtering unsafe exercises.
  5. Generating recommendation.
  6. Validating output.
- The response card must include the assistant answer and structured sections, not only prose.
- For workout generation, show warmup, main work, cooldown, sets/reps/duration/rest, and notes.
- Each exercise in a generated workout should show chips for muscles, joints loaded, equipment, movement pattern, and whether it supports weight/reps/duration.
- Each exercise row has `Why included`, `Swap`, and `View exercise` buttons.
- `Why included` opens an explanation drawer tied to graph facts and retrieval snippets.
- `Swap` opens an exercise picker filtered to safe alternatives with the same movement pattern or muscle target.
- `View exercise` opens the Exercise Detail screen.
- If a requested workout cannot be safely built, the assistant should say why and offer safe alternatives, not hallucinate unavailable exercises.

Right-side trace panel:

- Retrieval summary: vector matches, graph expansions, and final context tokens.
- Safety exclusions: list of excluded exercises with reason, such as "loads knee" or "requires unavailable equipment."
- Validation result: pass/fail, corrected fields, unknown exercise IDs caught.
- Graph path examples, such as `Member -> HAS_INJURY -> Knee -> CONTRAINDICATES_JOINT -> knee -> LOADED_BY -> Exercise`.

Failure behavior:

- Thin retrieval: response asks for more context or falls back to general safe guidance and labels missing facts.
- Invalid recommendation: response shows "Corrected by safety validator" with the rejected exercise and replacement.
- Ambiguous ask: assistant asks a clarifying question instead of guessing.

### 3. Recommendation Result Detail

Purpose: Let the coach inspect one generated workout or coaching recommendation in detail.

Primary content:

- Title, generated date/time, member, request prompt, and safety status.
- Structured workout table.
- Included exercises.
- Excluded exercises.
- Explanation timeline.
- Source context used.
- Validation report.
- Version footer: model, prompt template version, retrieval policy version, safety policy version, schema version (see Versioning Visibility cross-cutting rule).

Controls:

- `Approve` marks the recommendation as accepted and emits a feedback event for evaluation metrics.
- `Reject` captures a reason code (unsafe, off-target, equipment wrong, other) and stores it for the acceptance-rate metric.
- `Edit` allows manual changes to sets, reps, rest, and notes; edits are tracked so the harness can distinguish accepted-as-is from accepted-with-edits.
- `Regenerate` reruns generation with the same request and current member context.
- `Regenerate safer` increases safety conservatism and prioritizes lower joint load or regen movements.
- `Compare configurations` opens the Evaluation Comparison Harness preloaded with this request, so the coach can A/B against a different model or retrieval setting.
- `Export transcript` downloads or displays a demo transcript for submission.
- `Copy JSON` copies the structured recommendation.

Workout table behavior:

- Inline edit sets, reps, rest, load target, duration, and coaching notes.
- If an edited exercise conflicts with member constraints, show an immediate warning.
- If replacing a bilateral exercise, the UI should suggest adding the paired side using `bilateral_pair_id`.
- If an exercise does not support weight, disable load fields.
- If an exercise is duration-only, prioritize duration fields and make reps optional or hidden.

### 4. Why Explanation Drawer

Purpose: Make explainability concrete and traceable.

Opened from:

- `Why included` on an exercise.
- `Why skipped` on an excluded exercise.
- "Why did you skip..." coach questions.
- Graph trace links.

Content:

- Plain English explanation.
- Graph path used for reasoning.
- Exercise metadata involved.
- Member facts involved.
- Retrieved notes or chat snippets involved.
- Safety rule or validator that applied.

Example structure:

- Decision: skipped `Kettlebell Goblet Cyclist Squat`.
- Reason: loads `knee`; member has active knee pain signal.
- Graph path: `Member -> HAS_INJURY -> Knee Pain -> AFFECTS_JOINT -> knee -> LOADED_BY <- Exercise`.
- Replacement logic: selected lower-body alternatives with lower knee load or recovery emphasis.
- Confidence: high if graph evidence and dataset metadata agree.

Controls:

- `Open in graph` highlights the related nodes in Graph Explorer.
- `Show source signal` opens the raw ingested note or injury record.
- `Find alternatives` opens the safe swap picker.
- `Copy explanation` copies a concise explanation for the demo transcript.

### 5. Graph Explorer

Purpose: Demonstrate that the graph is doing real work, not merely semantic search.

Layout:

- Left filter rail.
- Center graph canvas.
- Right inspector panel.
- Bottom query/result console.

Graph nodes:

- Member.
- Goal.
- Preference.
- Equipment.
- Injury or condition.
- Joint.
- Exercise.
- Muscle group.
- Movement pattern.
- Workout.
- Workout log.
- Context signal.

Graph edges:

- `HAS_GOAL`
- `PREFERS`
- `HAS_EQUIPMENT`
- `HAS_INJURY`
- `AFFECTS_JOINT`
- `LOADS_JOINT`
- `TRAINS_MUSCLE`
- `USES_EQUIPMENT`
- `HAS_MOVEMENT_PATTERN`
- `COMPLETED_WORKOUT`
- `MENTIONED_IN`
- `CONTRAINDICATES`
- `HAS_BILATERAL_PAIR`

Controls:

- Search box for nodes by name.
- Member dropdown.
- Toggle node types.
- Toggle edge types.
- `Show safety neighborhood` button expands injury -> joint -> exercise paths.
- `Show recommendation context` highlights the subgraph retrieved for the latest response.
- `Run query` executes a saved graph query.
- `Reset view` returns to member-centered graph.

Interactions:

- Clicking a node opens the inspector with properties and connected edges.
- Clicking an edge shows relationship type and source.
- Hovering over an exercise node shows muscle, joints, equipment, and movement patterns.
- Unsafe exercise nodes should visually differ when a member injury filter is active.
- Retrieved context nodes should be highlighted separately from merely connected nodes.

Important states:

- Empty graph: prompt to ingest seed data.
- Dense graph: clustering and filters prevent the graph from becoming unreadable.
- Query error: show the Cypher/query issue and keep the current graph visible.

### 6. Ingestion Screen

Purpose: Show how raw synthetic data becomes graph nodes and relationships.

Tabs:

- Profile.
- Injury or condition.
- Workout history.
- Chat/context signal.
- Bulk seed.

Profile form:

- Member name.
- Goals.
- Preferences.
- Available equipment.
- Training days.
- Skill level.
- Notes.

Injury form:

- Condition label.
- Affected joint or body area.
- Severity.
- Status: active, improving, resolved.
- Contraindicated movement patterns.
- Source note.

Workout history form:

- Date.
- Exercises performed.
- Sets/reps/weight/duration.
- Adherence: completed, partial, missed.
- Notes.

Chat/context signal form:

- Raw text area for synthetic notes, such as "My knee felt irritated after lunges last week."
- Signal type selector: chat, transcript, coach note, biometric summary.
- `Extract structure` button.
- `Ingest into graph` button.

Interactions:

- `Extract structure` previews proposed nodes and edges before saving.
- The preview should include confidence per extracted fact.
- The coach can accept, edit, or remove proposed facts.
- `Ingest into graph` writes accepted facts and refreshes the Graph Explorer.
- If extraction is uncertain, require confirmation instead of silently creating relationships.

Validation:

- Do not allow real personal data wording in examples. Use synthetic member labels.
- Require affected joint for active injury if it will constrain exercise selection.
- Warn if an injury has no mapped joint because safety filtering may be weak.

### 7. Member Context Editor

Purpose: Let the coach maintain synthetic member facts without using raw ingestion every time.

Sections:

- Profile facts.
- Goals.
- Preferences.
- Equipment.
- Injuries/conditions.
- History.
- Context signals.

Controls:

- Add, edit, delete facts.
- Toggle injury active/resolved.
- Add equipment.
- Remove unavailable equipment.
- Add preference, such as "prefers dumbbells" or "avoid high-impact cardio."
- `Save changes`.
- `Rebuild graph` if changes require re-ingestion.

Behavior:

- Changes should immediately update safety filters and recommendation context.
- Deleting an injury should remove or deactivate its contraindication edges.
- Resolving an injury should retain history but stop hard-excluding exercises unless the implementation chooses a conservative policy.

### 8. Exercise Library

Purpose: Make the provided `exercises.json` dataset visible and searchable.

Primary content:

- Search input.
- Filter chips for muscle groups, joints loaded, movement patterns, equipment, bilateral status, supports weight, reps, duration.
- Sort by name, priority tier, equipment count, or safety for selected member.
- Exercise table or card grid.

Exercise row fields:

- Name.
- Muscle groups.
- Joints loaded.
- Equipment.
- Movement patterns.
- Supports weight.
- Reps/duration support.
- Bilateral side and pair status.

Controls:

- `View` opens Exercise Detail.
- `Use in workout` adds the exercise to a draft workout if safe.
- `Find safe alternatives` finds exercises with similar goals but fewer conflicts.
- `Show graph node` opens the graph focused on that exercise.

Member-aware safety:

- When a member is selected, show each exercise as safe, caution, or excluded.
- Excluded rows should state the reason, such as joint conflict or unavailable equipment.
- If an exercise has no `joints_loaded`, label it as "joint data missing" rather than assuming safe.

### 9. Exercise Detail

Purpose: Inspect one exercise and its role in recommendations.

Content:

- Exercise name and ID.
- Muscles trained.
- Joints loaded.
- Movement patterns.
- Required equipment.
- Programming support: reps, duration, weight.
- Estimated rep duration.
- Bilateral side and pair.
- Related exercises by muscle, movement pattern, or equipment.
- Member-specific safety panel.

Controls:

- `Add to draft workout`.
- `Find pair` for bilateral exercises.
- `Find alternatives`.
- `Open graph node`.
- `Copy exercise ID`.

Behavior:

- Disable `Add to draft workout` or require confirmation if the selected member has a contraindication.
- If bilateral pair exists but is absent from the dataset or not found by ID, show a data warning.

### 10. Safe Swap Picker

Purpose: Replace unsafe or unsuitable exercises without breaking the recommendation.

Opened from:

- Workout exercise row `Swap`.
- Safety validator correction.
- Exercise detail `Find alternatives`.

Filters:

- Same muscle group.
- Same movement pattern.
- Available equipment only.
- Avoid loaded joints from member injuries.
- Prefer lower priority tier if future data contains varied tiers.
- Include mobility/regen alternatives.

Controls:

- Search alternatives.
- Compare selected exercise vs candidate.
- `Replace`.
- `Cancel`.

Behavior:

- Show why each candidate is considered safer.
- Preserve workout structure when possible: if replacing a main lift with a duration-only movement, require set/rep/duration recalculation.
- For bilateral exercises, offer to replace both sides.

### 11. API and Schema Explorer

Purpose: Demonstrate clean system boundaries and typed contracts.

Content:

- Endpoint list:
  - `POST /ingest`
  - `POST /retrieve`
  - `POST /recommend`
  - `POST /explain`
  - `GET /members`
  - `GET /members/:id/graph`
  - `GET /exercises`
- Request schema.
- Response schema.
- Example payloads.
- Last request/response body.

Controls:

- Endpoint selector.
- `Send sample request`.
- `Copy curl`.
- `Copy JSON`.

Behavior:

- Sample requests should use synthetic data.
- Failed requests show validation errors clearly.
- Successful recommendation responses should include structured output, reasoning references, and validation status.

### 12. System Trace and Observability Screen

Purpose: Make LLM calls, retrieval, graph queries, and validation inspectable.

Content:

- Timeline of each request.
- Router or workflow stage.
- Graph queries executed.
- Vector search terms and top matches.
- Prompt/context size.
- LLM/tool call result.
- Validator result.
- Latency per stage with latency budget overlay (e.g. "retrieval 1.2s of 2.0s budget").
- Token and cost per stage, linkable to the Cost and Performance Dashboard.
- Version footer per stage: model, prompt template version, retrieval policy version, safety policy version, schema version.

Controls:

- Filter by member.
- Filter by request type.
- Expand/collapse stage details.
- `Copy trace`.
- `Export demo transcript`.

Behavior:

- Show failed stages and recovery behavior.
- For invalid exercise IDs, show the failed ID, validation error, and correction.
- For retrieval misses, show fallback behavior.

### 13. Evaluation Screen

Purpose: Satisfy the requirement to test critical paths and explain production evaluation.

Sections:

- Critical path tests.
- Scenario runner.
- Metrics.
- Failure modes.
- Production evaluation plan.

Recommended test scenarios:

- Injury filtering: a member with knee injury requests lower body; exercises loading knee are excluded or replaced.
- Explainability: "Why did you skip X?" returns graph-traceable reasoning.
- Thin retrieval: member has incomplete context; assistant asks for clarification or uses a constrained fallback.
- Invalid recommendation: validator catches unknown exercise ID or contraindicated exercise.
- Exercise search: unavailable equipment returns no results and recovers gracefully.

Controls:

- `Run all tests`.
- `Run scenario`.
- `View expected behavior`.
- `View actual trace`.
- `Copy README evaluation section`.

Metrics to display:

- Safety violation rate.
- Unknown exercise ID rate.
- Retrieval hit rate.
- Explanation coverage.
- Response latency.
- Token/context size.
- Clarification rate.
- Coach acceptance rate, if modeled.

### 14. Demo Walkthrough Screen

Purpose: Provide a simple runnable demo or transcript for submission.

Content:

- Step-by-step scripted demo.
- Buttons to run each step.
- Transcript output.
- Links to relevant screens.

Suggested knowledge graph demo flow:

1. Seed synthetic member with knee issue, dumbbell access, goal to improve lower-body strength.
2. Ingest a chat signal mentioning knee irritation after lunges.
3. Show graph path from member to knee to contraindicated exercises.
4. Ask for a lower-body session.
5. Show generated workout with unsafe knee-loading movements excluded or caveated.
6. Ask why an exercise was skipped.
7. Show graph-traceable explanation.
8. Show validation and test result.

Controls:

- `Run seed`.
- `Open graph`.
- `Generate workout`.
- `Ask why`.
- `Run safety test`.
- `Export transcript`.

### 15. Weekly Programming View

Purpose: The Member Dashboard shortcut `Weekly plan` implies a multi-day programming surface, but the existing screens only cover single-session recommendations. A coach almost never thinks one workout at a time — they think in microcycles.

Layout:

- Week strip across the top with day cells (Mon-Sun) showing planned session type, status (planned, completed, missed, modified), and load tag.
- Center calendar showing planned sessions with a compact summary per session (focus, duration, equipment, key exercises).
- Right rail summarizing weekly volume per movement pattern, per muscle group, and per loaded joint relative to safety budget.
- Bottom row: regen/rest days, deload markers, and adherence trend for the past 4 weeks.

Primary content per day cell:

- Session focus (lower, upper, full, conditioning, mobility, rest).
- Estimated duration.
- Equipment used.
- Safety status badge (safe, caution, blocked).

Controls:

- `Generate week` button that builds a full microcycle from member context with one prompt.
- `Drag to reorder` sessions across days.
- `Swap session` opens a templated picker (lower/upper/recovery/full).
- `Lock day` prevents regeneration of a session the coach already approved.
- `Cascade safer` reruns the week with elevated safety conservatism if a new injury was logged mid-week.
- `Compare to last week` highlights deltas in volume, intensity, or excluded movements.

Behavior:

- Volume budget per loaded joint should derive from member injury severity. If a joint is in caution status, the weekly count of exercises loading it should not exceed a declared budget — overrun triggers a visible warning.
- Movement-pattern balance: if `upper push - horizontal` appears 6 times but no pulling pattern appears, surface an imbalance warning.
- A regenerated week should never silently overwrite a locked session.
- If member injury status changes during the week, the affected future sessions should be flagged for review, not auto-rewritten.

### 16. Workout History and Adherence Timeline

Purpose: The current dashboard mentions a `Recent activity panel`, but longitudinal reasoning is both a stretch goal and the strongest argument that the graph is doing real work. This screen makes session-over-time signals visible and queryable.

Layout:

- Top: 12-week heatmap of completed/partial/missed sessions colored by adherence.
- Center: per-session timeline with chronological cards.
- Right: aggregate panel for volume per muscle group, RPE trend, complaint frequency by joint, and progression on key lifts (load x reps over time where applicable).
- Filters: date range, focus area, equipment used, completion status, has-complaint flag.

Each session card:

- Date and focus.
- Adherence and modifications taken.
- Logged complaints (e.g. "knee tweaked on lunges").
- Recommendation source: AI generated, coach edited, manual entry.
- Link to the originating Coach Console conversation if one exists.

Controls:

- `Replay context` opens a snapshot of the graph as it stood when the session was generated, so the coach can see why the AI made that call given what it knew then.
- `Promote to signal` converts a complaint or note into a context signal that updates the graph (e.g. "knee felt off" -> creates or strengthens a knee-irritation signal).
- `Compare to plan` shows planned vs actually performed.

Behavior:

- A complaint logged on a session should be visible as a fading signal in the graph over time (e.g. weight decays after N sessions without recurrence) — make that fade visible.
- If a member missed three sessions in a row, the next recommendation should bias toward lower volume and the UI should explain that bias.

### 17. Settings and Configuration

Purpose: The assessments both ask candidates to reason about evaluation in production. That reasoning is much sharper if the surface that can be tuned is visible. This screen exposes the knobs.

Sections:

- Provider and model: LLM provider, model id, temperature, max tokens.
- Embedding model: provider, model id, dimension, cache enabled.
- Retrieval: vector top-k, graph neighborhood depth, max context tokens, dedup strategy, recency boost.
- Safety: see Safety Policy Editor (separate screen) — link here.
- Validator: strict vs lenient mode, retry budget on invalid tool calls.
- Memory: conversation memory window, summarization strategy, max stored turns per session.
- Logging: log level, redact PII, sample rate for traces.

Controls:

- Per-section `Save`, `Reset to default`, `Export as .env or JSON`.
- `Try in sandbox` runs a fixed test prompt against the current settings without persisting changes.
- `Show diff` displays which settings differ from the recommended defaults.

Behavior:

- Settings changes that affect graph schema (e.g. embedding model swap) must require a rebuild confirmation, since stored embeddings would otherwise become incomparable.
- Sensitive values (API keys) are write-only and never displayed back.

### 18. Prompt and Template Inspector

Purpose: Explainability requires seeing what was actually sent to the model. The current System Trace screen shows context size but not the prompt body. This screen makes prompts and templates first-class.

Content:

- Template catalog grouped by purpose: router, coach, workout generator, workout logger, explainer, validator, safety reviewer.
- Template version, last edited, hash.
- Variables and required fields per template.
- Rendered preview with sample inputs.
- Output schema (Pydantic / structured output definition) for templates that produce structured output.

Controls:

- `Edit template` for in-app authoring.
- `Diff vs production` shows what differs from the deployed prompt.
- `Test render` fills variables with a chosen sample request and shows the final prompt body.
- `Run against sample` executes the template with the current model and shows latency, tokens, and parsed output.
- `Version history` lists prior versions with rollback.

Behavior:

- A template edit creates a new version rather than mutating the active one.
- Any rendered prompt visible in System Trace should link back to the exact template version used.
- Variables flagged as `member_pii_safe` should be redacted in trace exports.

### 19. Schema and Ontology Reference

Purpose: The knowledge graph assessment explicitly requires "a documented schema — node types, edge types, and what they mean." The Graph Explorer shows the live graph but does not document it. This screen is the canonical reference and pairs well with the optional SNOMED grounding stretch goal.

Content:

- Node type catalog: name, properties with types and constraints, identifier strategy, example instance.
- Edge type catalog: name, source -> target, cardinality, properties, semantic description, example.
- Ontology mappings: which node/edge types map to which external ontology concepts (SNOMED CT codes, FMA, or a documented internal ontology).
- Constraints and invariants: e.g. "an active Injury must have at least one AFFECTS_JOINT edge."
- Indexes: vector index dimensions and which node types are indexed.

Controls:

- `View as ERD` opens a static node/edge diagram.
- `Open in graph` jumps to Graph Explorer filtered to instances of the selected type.
- `Copy schema` exports the schema as Cypher, JSON, or Markdown.
- `Check invariants` runs validation queries over the live graph and reports violations.

Behavior:

- This screen is read-only. Schema changes happen via migrations in code, not the UI.
- Invariant violations should be linkable, so a coach (or evaluator) can jump from a failed invariant straight to the offending nodes.

### 20. Evaluation Comparison Harness

Purpose: The Evaluation screen lists tests but does not provide the side-by-side comparison surface that makes "how I would evaluate in production" tangible. This screen runs the same request under different configurations and shows the diff.

Layout:

- Top: request input and member selector.
- Left: configuration A (current).
- Right: configuration B (variant).
- Bottom: aggregate diff metrics.

Configurable axes per side:

- Model.
- Temperature.
- Prompt template version.
- Retrieval: vector-only, graph-only, hybrid.
- Safety conservatism level.
- Validator strictness.

Output per side:

- Response.
- Retrieved context (count and IDs).
- Safety exclusions.
- Latency, tokens, cost.
- Validation result.

Diff metrics:

- Recommendation overlap (Jaccard on exercise IDs).
- Safety divergence (exercises included by one side but excluded by the other).
- Latency delta.
- Token delta.
- Cost delta.

Controls:

- `Swap A and B`.
- `Save as scenario` to add to the Evaluation screen's scenario library.
- `Run on all members` batches the comparison across the synthetic member set and shows aggregated metrics.
- `Promote variant` makes configuration B the new default (with confirmation).

Behavior:

- A side that produces a safety-violating recommendation should be visibly marked, regardless of latency or cost gains.
- Comparison runs should be cached so a coach can revisit results without re-spending tokens.

### 21. Conversation History and Sessions

Purpose: Multi-turn memory is a stretch goal that has UI implications the existing spec does not address. Without a sessions surface, every Coach Console open is a cold start and the value of memory cannot be demonstrated.

Content:

- Session list per member with title, start time, last message, message count, recommendations produced, and outcome (approved, edited, discarded, none).
- Search across session transcripts.
- Pinned sessions for ones the coach wants to revisit.

Per-session detail:

- Full transcript.
- Recommendations and their final disposition.
- Member context snapshot at session start.
- Settings snapshot (model, prompt versions).

Controls:

- `Resume` continues a session as the active Coach Console conversation, restoring memory.
- `Fork` starts a new session seeded with the resumed transcript but a fresh memory window.
- `Export` downloads the transcript as Markdown or JSON.
- `Delete` removes the session (synthetic data only; confirm).

Behavior:

- Resuming a session that referenced facts which have since changed (e.g. injury resolved) should show a "context drift" banner explaining what changed since the original conversation.
- Sessions are scoped per member — switching members should not surface another member's history.

### 22. Cost, Token, and Performance Dashboard

Purpose: Production evaluation requires cost and latency awareness. The System Trace shows per-request data but no aggregate view. This screen aggregates it.

Content:

- Total spend by day, model, route, and member.
- p50 / p95 / p99 latency per stage (routing, retrieval, generation, validation).
- Token usage breakdown: prompt vs completion, by template version.
- Cache hit rate for embeddings and prompt cache.
- Error rate per stage with drill-down to System Trace.

Controls:

- Date range picker.
- Filter by model, template version, route, member.
- `Drill in` opens System Trace filtered to the matching requests.
- `Set budget alert` defines a daily or per-request cost ceiling that surfaces a notification when crossed.

Behavior:

- Cost figures should reflect actual provider pricing where known, and should be clearly labeled "estimated" otherwise.
- Charts must not block when the underlying telemetry store is empty — show an explanatory empty state.

### 23. Safety Policy Editor

Purpose: The Coach Console offers `Regenerate safer` and exclusions are mentioned throughout, but the policy that decides what counts as unsafe is implicit. This screen makes the policy editable and inspectable.

Content:

- Active conservatism level: lenient, standard, strict, max.
- Per-joint rules: for each joint, the rule applied when a member has an injury affecting it (exclude, caution-only, allow-with-reduced-load).
- Per-movement-pattern rules: e.g. "no plyometric jumps when knee injury active."
- Equipment rules: hard-exclude unavailable equipment vs prefer-available.
- Bilateral rule: when one side is contraindicated, behavior for the paired side.
- Missing-data rule: when an exercise has empty `joints_loaded`, default classification (safe, caution, exclude).
- Fade rule: how long after a complaint logs as resolved before the related restriction lifts.

Controls:

- `Edit rule`, `Add rule`, `Disable rule`.
- `Simulate on member` reruns the latest recommendation for a chosen member under the proposed policy and shows the resulting include/exclude diff.
- `Promote to default` saves the policy as the active conservatism level.

Behavior:

- Policy changes affecting an active member's current recommendations must show a non-dismissable notification offering to regenerate affected sessions.
- The policy itself is versioned and visible in System Trace next to each safety decision.

### 24. Tradeoffs and Implementation Notes

Purpose: Both READMEs ask candidates to "tell us what you cut, what you'd do with more time, and why." A dedicated in-app surface makes those decisions reviewable alongside the demo, not buried in a README.

Content:

- Implemented vs cut: list of features the candidate completed, partially completed, and intentionally cut, each with a one-line rationale.
- Known limitations: list of known issues with reproduction notes and impact assessment.
- Next iterations: ordered list of what the candidate would build next, with effort estimate and expected value.
- Architecture decision records: short entries for non-obvious design choices (e.g. why Neo4j over Postgres+pgvector, why prompt caching off by default, why this retrieval strategy).

Controls:

- `Open referenced screen` deep-links the example to the relevant UI surface.
- `Open referenced code` deep-links to the relevant file/line in the public repo.
- `Copy README section` exports the screen contents as a Markdown block suitable for the submission README.

Behavior:

- This screen is documentation surfaced in the product. It should not appear in evaluator-facing demos by default; gate it behind a `?notes=1` query or a settings toggle.

## Multi-Agent Assessment Screens

The multi-agent assessment can be much smaller. The UI should focus on proving routing, sub-agent composition, tool use, structured logging, and graceful fallback.

### 1. Agent Console

Purpose: A single chat interface that routes requests to the correct sub-agent.

Layout:

- Chat transcript in the center.
- Router decision panel on the right.
- Example prompts on the left.
- Composer at the bottom.

Example prompt buttons:

- `Coach question`: "What muscles does a deadlift work?"
- `Generate workout`: "Build me a 30 min upper body session with dumbbells."
- `Log workout`: "I just did 3x10 bench press at 185 lbs."
- `Ambiguous`: "Bench press."
- `No results`: "Build me a workout using a rowing machine and sled."

Composer controls:

- Text input.
- `Send`.
- `Clear`.
- `Replay demo`.

Router decision panel:

- Route selected: `COACH`, `WORKOUT_GENERATE`, `WORKOUT_LOG`, or fallback/clarification.
- Confidence score.
- Reasoning summary.
- StateGraph path taken.
- Whether clarification was required.

Behavior:

- On send, show router classification before or alongside the assistant response.
- Low-confidence input should trigger a clarification message instead of silently choosing a route.
- The UI should show that routing used structured output by rendering the parsed routing object.

### 2. Coach Answer Result

Purpose: Display general exercise/coaching answers grounded in the exercise dataset where relevant.

Content:

- Answer text.
- Matching exercises or dataset facts used.
- Caveats if the dataset lacks the requested exercise.

Controls:

- `View matched exercises`.
- `Ask follow-up`.
- `Copy response`.

Behavior:

- If the user asks about an exercise not in the dataset, say what is known from general knowledge only if allowed by implementation, or clearly label the limitation.
- Do not present fabricated dataset fields.

### 3. Workout Generator Result

Purpose: Show the output of the workout generator sub-agent and its tool calls.

Content:

- Original request.
- Search filters inferred from request: muscle group, duration, equipment, movement pattern.
- `search_exercises` results.
- Structured workout with warmup/main/cooldown.
- Sets, reps, duration, rest, notes.

Controls:

- `Regenerate`.
- `Edit constraints`.
- `Swap exercise`.
- `Copy JSON`.
- `Copy transcript`.

Behavior:

- If `search_exercises` returns no results, show recovery behavior:
  - Ask to change equipment.
  - Offer bodyweight or available-equipment alternatives.
  - Explain that the dataset has no matching equipment.
- If a tool call references an invalid exercise ID, show validation and correction.

### 4. Workout Logger Result

Purpose: Show extraction from natural language into structured workout log entries.

Content:

- Raw user text.
- Parsed exercise name.
- Fuzzy-matched dataset exercise.
- Match confidence.
- Sets.
- Reps.
- Weight.
- Units.
- Missing fields.
- Final JSON log.

Controls:

- `Confirm log`.
- `Edit log`.
- `Reject match`.
- `Choose different exercise`.
- `Copy JSON`.

Behavior:

- If "bench press" maps to multiple bench press variants, show candidates and ask the user to choose.
- If weight is missing, leave it null instead of inventing it.
- If the exercise supports no weight, disable weight and explain why.
- Confirmed logs appear in a simple workout history list.

### 5. Exercise Search Drawer

Purpose: Expose the `search_exercises` tool results.

Content:

- Query fields: muscle groups, equipment, movement patterns.
- Matching exercises.
- No-result explanation.

Controls:

- Filter chips.
- `Use selected`.
- `Clear filters`.

Behavior:

- The drawer opens automatically after workout generation if the user expands tool details.
- No-result state should be explicit and should not crash the flow.

### 6. Multi-Agent Demo and Tests Screen

Purpose: Satisfy runnable demo/transcript and critical path test requirements.

Content:

- Scripted demo prompts.
- Expected route.
- Actual route.
- Confidence.
- Agent response.
- Test pass/fail.

Recommended tests:

- Workout generation with valid equipment and muscle constraints.
- Workout logging with fuzzy exercise matching.
- Ambiguous routing fallback.
- No search results recovery.

Controls:

- `Run demo`.
- `Run tests`.
- `Copy transcript`.

### 7. StateGraph Topology Visualizer

Purpose: The multi-agent assessment requires that "Hub is a LangGraph `StateGraph` with typed state and explicit edges" and that "Sub-agents are separate graphs composed into the hub." A dedicated topology view makes that composition inspectable, not just claimed.

Content:

- Node-and-edge diagram of the hub graph and each sub-graph.
- For each node: name, function/agent reference, expected input keys, expected output keys.
- For each edge: source node, target node, condition expression, last evaluation result.
- Typed state inspector: current values of state fields, plus their declared types.

Controls:

- Hover a node to highlight its inbound and outbound edges.
- Click a node to open the prompt or function definition in the Prompt Inspector style (multi-agent equivalent: show the function body or template).
- `Trace last request` highlights the path actually taken by the most recent message.
- `Diff with previous request` compares the path taken across two requests.

Behavior:

- A node that produced an error should be visually marked and clicking it should jump to the System Trace entry.
- If state typing fails (Pydantic validation error mid-graph), the failing field and value must be shown.

### 8. Conversation Memory Inspector

Purpose: Multi-turn memory is a stretch goal that needs a visible surface to be demonstrable. Without this, an evaluator cannot tell whether memory is doing anything.

Content:

- Current window: the last N turns being passed to the next call.
- Summarized memory: any summarized prior turns and the summary itself.
- Per-turn metadata: route taken, sub-agent used, tool calls, retained vs evicted.
- Memory size budget and current usage.

Controls:

- `Evict turn` removes a specific turn from memory.
- `Reset memory` clears the window without clearing the visible transcript.
- `Pin turn` prevents a turn from being summarized or evicted.
- `Export memory state` downloads the current memory as JSON.

Behavior:

- Eviction or summarization should be visible in the transcript as a small marker, so the coach knows which turns are no longer in context verbatim.
- If a follow-up question depends on an evicted fact, the agent's degraded answer should be visible alongside the eviction marker.

## Cross-Cutting UI Rules

### Safety and Trust

- Always show whether a response is grounded in dataset records, graph relationships, or general model reasoning.
- Never hide safety exclusions. If an exercise is skipped, the coach should be able to inspect why.
- Unknown exercise IDs, unavailable equipment, missing graph context, and ambiguous intent should be visible states.
- Generated workouts should use structured cards/tables, not only narrative text.

### Buttons and Labels

Use direct action labels:

- `Send`
- `Generate workout`
- `Ask why`
- `Ingest context`
- `Extract structure`
- `Run retrieval`
- `Show graph`
- `Find alternatives`
- `Swap`
- `Approve`
- `Regenerate`
- `Copy JSON`
- `Export transcript`
- `Run tests`

Avoid vague labels like `Submit` when the action can be specific.

### Loading Behavior

For AI actions, use staged progress instead of a generic spinner:

- Classifying request.
- Searching exercises.
- Retrieving graph context.
- Expanding safety relationships.
- Generating response.
- Validating output.

Each stage should be reflected in the trace screen.

### Error Behavior

Errors should be recoverable and instructive:

- Ambiguous prompt: ask a clarifying question.
- No exercise matches: explain which filters caused zero results and offer to relax filters.
- Invalid tool call: show validation error and retry or ask for correction.
- Contraindicated exercise: remove or replace it and show why.
- Empty graph context: ask for profile, injury, equipment, or history data.
- Slow model call: keep the staged progress visible and allow cancellation.

### Mobile Consideration

This is likely a desktop coach-facing demo, but the UI should still work on tablet widths:

- Collapse the right trace panel into a drawer.
- Keep the chat composer sticky.
- Stack member context above chat.
- Make graph explorer usable with list/table fallback if the canvas is too small.

### Synthetic Data and Privacy Banner

The knowledge graph assessment requires synthetic data only. Make that contract impossible to forget:

- Display a persistent thin banner near the top of every screen: "Synthetic data — do not enter real member information."
- Ingestion forms should reject obviously real-looking inputs (e.g. patterns matching SSNs, emails of common providers, phone numbers) with a clear explanation rather than silently accepting them.
- Any export action (transcript, JSON, curl) should include a header comment reasserting that the data is synthetic.

### Versioning Visibility

Every assistant message, every recommendation card, and every System Trace entry should carry a small version footer with:

- Model id and provider.
- Prompt template id and version.
- Retrieval policy version.
- Safety policy version.
- Graph schema version.

Versions should be clickable and deep-link to the corresponding inspector (Prompt Inspector, Safety Policy Editor, Schema Reference).

### First-Run Onboarding

When the app is opened against an empty database, the dashboard should not be a blank canvas. Show:

- A `Get started` panel with three actions: `Seed demo members`, `Walk me through a scenario`, `Open empty and ingest manually`.
- A short tour highlighting where to find: the Coach Console, the Graph Explorer, the Evaluation Comparison Harness, and the Tradeoffs notes.
- For the multi-agent assessment, the equivalent is a `Run demo` action that fires a fixed sequence of routed prompts and opens the StateGraph visualizer.

The onboarding should be dismissable and re-openable from the help menu.

### Accessibility and Keyboard Shortcuts

The UI is a coach-facing tool that will be operated during sessions:

- All actionable controls must be keyboard reachable in a logical tab order.
- Provide visible focus rings; do not rely solely on hover for state changes.
- Color must not be the sole carrier of meaning — safety states (safe/caution/excluded) need a textual badge in addition to color.
- Recommended shortcuts: `?` open shortcut help, `/` focus chat composer, `g m` go to members, `g c` go to coach console, `g g` go to graph explorer, `cmd+enter` send message, `cmd+k` open command palette.
- A command palette (`cmd+k`) should index members, screens, exercises, saved scenarios, and recent traces.

### Notification and Toast System

Important state changes should be surfaced through a single notification channel rather than ad hoc inline messages:

- Toasts for transient confirmations (saved, copied, ingested).
- Banners for persistent conditions (model misconfigured, graph DB unreachable, safety policy change pending review).
- A notification center icon aggregates the last N notifications with timestamps and links to the source action.

Severity levels (info, warning, error, safety-critical) should be visually distinct, and safety-critical notifications must require explicit dismissal.

### Disconnected and Degraded States

The system depends on an LLM provider, a graph DB, and a vector index. Each can fail independently:

- Graph DB unreachable: read-only mode with cached last-known graph; ingestion and safety filtering disabled with a visible banner.
- LLM provider unreachable or rate-limited: queue requests with visible state; allow the coach to inspect cached responses and use Exercise Library and Graph Explorer.
- Vector index missing or stale: retrieval falls back to graph-only with a warning surfaced in Coach Console and System Trace.
- Settings misconfigured (e.g. invalid API key): all generation actions disabled with a one-click link to Settings.

Every degraded state should be inspectable from the notification center and reflected in the version footer.

### Data Lineage and Audit Trail

Every fact in the graph and every recommendation should carry lineage:

- Each node and edge stores: source (ingestion form, extracted from chat signal, derived from rule), source signal id, timestamp, ingester (user or extraction model + version), confidence.
- The Why Explanation Drawer should expose lineage for every cited fact.
- A global audit log screen (or a tab in System Trace) lists ingestion events, edits, deletions, and policy changes in chronological order with actor and reason.
- Deleted facts are soft-deleted with retained lineage; the audit log shows the deletion event.

This makes "where did this claim come from?" a one-click answer at every point in the product.

## Minimal Build Recommendation

If time is tight for the knowledge graph assessment, build these screens first:

1. Member Dashboard.
2. Coach Console.
3. Recommendation Result Detail with why explanations.
4. Graph Explorer.
5. Ingestion Screen.
6. Exercise Library.
7. Schema and Ontology Reference (cheap to produce and directly satisfies the documented-schema requirement).
8. Evaluation/Demo screen.

This set covers the explicit requirements: frontend demo, ingestion, GraphRAG retrieval, generation, explainability, safety, schema documentation, API visibility, and tests.

Add next, in priority order, as time allows:

1. Settings and Configuration plus Prompt and Template Inspector — together they make the system tunable and reproducible, which is what production-evaluation thinking actually rests on.
2. Evaluation Comparison Harness — turns "I would compare X vs Y" from words in a README into a runnable demo.
3. Workout History and Adherence Timeline — best demonstration that the graph carries longitudinal value over a flat retrieval system.
4. Safety Policy Editor — turns safety from a hardcoded behavior into an explicit, inspectable contract.
5. Tradeoffs and Implementation Notes — addresses the README requirement inside the product.

If time is tight for the multi-agent assessment, build these screens first:

1. Agent Console.
2. Workout Generator Result.
3. Workout Logger Result.
4. StateGraph Topology Visualizer (very cheap, directly evidences the typed-state and composed-graphs requirements).
5. Demo and Tests screen.

This set covers routing, sub-agent behavior, tool use, structured logging, resilience, graph topology evidence, and demo transcript.

## Open Questions and Design Tradeoffs

The assessments explicitly reward clear tradeoff reasoning. The questions below are decisions a candidate should resolve and document, ideally on the Tradeoffs and Implementation Notes screen. The UI should make the chosen answer visible rather than implicit.

Retrieval strategy:

- Vector-only, graph-only, or hybrid? If hybrid, what is the merge strategy (rank fusion, re-rank, retrieval-then-traversal)?
- How is `top-k` chosen and how does graph neighborhood depth interact with it?
- How is the assembled context budgeted against the model's context window?

Safety conservatism:

- Default to exclude-on-conflict or caution-only? Different stakeholders (coach vs liability lens) will prefer different defaults.
- How does resolved-but-recent injury affect filtering? Hard exclude, soft warn, or decay over time?
- What happens to exercises with empty `joints_loaded` — safe by default, caution, or excluded?
- Is the safety check applied at retrieval, at generation, at validation, or all three?

Schema:

- Are joints modeled as nodes or as properties on exercises? The current spec implies nodes — what is the tradeoff in query expressiveness vs storage?
- Is the dataset's `bilateral_pair_id` resolved into a `HAS_BILATERAL_PAIR` edge at ingest, or computed on the fly?
- Are movement patterns first-class nodes (allowing pattern-level queries like "balance push vs pull") or stored as exercise properties?

Memory and sessions:

- How is conversation memory bounded — fixed window, token budget, recency + summarization?
- Are memory turns scoped per member, per coach, or per session?
- How is "context drift" handled when a member's underlying graph changes mid-session?

Validation:

- Single-pass validation on the generated output, or interleaved validation during generation?
- On invalid recommendation, retry with feedback, regenerate from scratch, or correct in place?
- How many retries are acceptable before surfacing failure to the coach?

Evaluation:

- Which metrics are leading vs lagging indicators? Safety violation rate is leading; coach acceptance rate is lagging.
- How would the evaluation harness distinguish a retrieval regression from a generation regression?
- What is the synthetic-member generation strategy used for evaluation, and does it cover edge cases (multiple concurrent injuries, conflicting equipment, sparse history)?

Multi-agent specific:

- How is routing confidence calibrated? Is the threshold for clarification chosen empirically, or arbitrary?
- When the workout generator returns no results, does the hub re-route to the coach with the failure as context, or does the generator handle recovery itself?
- Are sub-agents stateless per request, or do they share state through the typed hub state?

These are deliberately not answered here. The point is that the UI should make the candidate's answer visible — in the Settings screen, the Safety Policy Editor, the Schema Reference, the Prompt Inspector, and the Tradeoffs screen — rather than hiding it in code.
