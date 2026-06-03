/* FUTURE — mock generation engine: workouts, swaps, traces, explanations. */
(function () {
  const DB = window.DB;

  function safeExercises(member) {
    return DB.exercises.filter(e => DB.evalExerciseForMember(e, member).state === 'safe');
  }
  function pick(list, n, filterFn) {
    const pool = filterFn ? list.filter(filterFn) : list;
    const out = []; const used = new Set();
    for (const e of pool) { if (out.length >= n) break; if (!used.has(e.id)) { out.push(e); used.add(e.id); } }
    return out;
  }

  // Build a structured workout for a member + focus
  function buildWorkout(member, opts = {}) {
    const focus = opts.focus || 'lower';
    const safe = safeExercises(member);
    const caution = DB.exercises.filter(e => DB.evalExerciseForMember(e, member).state === 'caution');
    const excluded = DB.exercises.filter(e => {
      const ev = DB.evalExerciseForMember(e, member); return ev.state === 'excluded';
    });
    const focusMuscles = {
      lower: ['quads', 'glutes', 'hamstrings', 'calves'], upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'lats'],
      full: ['quads', 'glutes', 'chest', 'back', 'core'], recovery: ['core', 'back', 'hip flexors'], conditioning: ['full body'],
    }[focus] || ['quads', 'glutes'];
    const inFocus = e => e.muscle_groups.some(m => focusMuscles.includes(m));
    const isMob = e => e.movement_patterns.includes('mobility') || e.priority_tier === 3 && e.is_duration;

    const warmup = pick(safe, 2, e => e.movement_patterns.includes('mobility') || e.name.includes('Cat') || e.name.includes('Stretch') || e.name.includes('Glute Bridge') || e.name.includes('Band'));
    const main = pick(safe.filter(inFocus).sort((a, b) => a.priority_tier - b.priority_tier), focus === 'recovery' ? 2 : 4);
    const cooldown = pick(safe, 2, e => e.movement_patterns.includes('mobility') || e.name.includes('Foam') || e.name.includes('90/90'));

    const mkRow = (e, kind) => {
      const dur = e.is_duration; const wt = e.supports_weight;
      return {
        id: e.id, ex: e, kind,
        sets: kind === 'main' ? (focus === 'recovery' ? 2 : 3) : (dur ? 1 : 2),
        reps: e.is_reps ? (kind === 'main' ? '8–10' : '12') : null,
        duration: dur ? (kind === 'warmup' ? '45s' : '60s') : null,
        rest: kind === 'main' ? '90s' : '45s',
        load: wt ? (kind === 'main' ? 'RPE 7' : 'light') : null,
        note: '',
        why: buildWhy(e, member),
      };
    };
    const rows = { warmup: warmup.map(e => mkRow(e, 'warmup')), main: main.map(e => mkRow(e, 'main')), cooldown: cooldown.map(e => mkRow(e, 'cooldown')) };
    return {
      id: 'rec_' + Math.random().toString(36).slice(2, 8), member: member.id, focus,
      created: new Date().toISOString(), request: opts.request || `Build a ${focus}-body session.`,
      rows, excluded: excluded.slice(0, 5).map(e => ({ ex: e, reason: DB.evalExerciseForMember(e, member).reasons[0] })),
      caution: caution.slice(0, 3), safetyStatus: member.injuries?.some(i => i.status === 'active') ? 'guarded' : 'clear',
      trace: buildTrace(member, opts), validation: buildValidation(member),
    };
  }

  function buildWhy(ex, member) {
    const inj = (member.injuries || []).find(i => i.status === 'active');
    return {
      plain: `${ex.name} trains ${ex.muscle_groups.slice(0, 2).join(' & ')} via a ${ex.movement_patterns[0]} pattern and does not load any of ${member.name.split(' ')[0]}'s flagged joints.`,
      path: `Member → HAS_GOAL → ${member.goals[0]} ; Exercise → TRAINS_MUSCLE → ${ex.muscle_groups[0]} ; Exercise ∌ LOADS_JOINT → ${inj ? inj.joint : '—'}`,
      facts: [`equipment available: ${ex.equipment_required.join(', ')}`, `priority tier ${ex.priority_tier}`],
      confidence: 'high',
    };
  }
  function buildWhySkipped(ex, member) {
    const ev = DB.evalExerciseForMember(ex, member);
    const inj = (member.injuries || []).find(i => ex.joints_loaded.includes(i.joint) && i.status !== 'resolved');
    return {
      decision: `skipped ${ex.name}`,
      plain: ev.reasons[0] || 'Excluded by safety policy.',
      path: inj ? `Member → HAS_INJURY → ${inj.label} → AFFECTS_JOINT → ${inj.joint} → LOADED_BY ← ${ex.name}` : `Exercise requires unavailable equipment`,
      facts: ev.reasons,
      replacement: swapCandidates(ex, member)[0],
      confidence: inj ? 'high' : 'medium',
    };
  }

  function swapCandidates(ex, member) {
    const safe = safeExercises(member);
    return safe.filter(c => c.id !== ex.id && (
      c.movement_patterns.some(p => ex.movement_patterns.includes(p)) ||
      c.muscle_groups.some(m => ex.muscle_groups.includes(m))
    )).slice(0, 6).map(c => ({
      ex: c,
      reason: c.movement_patterns.some(p => ex.movement_patterns.includes(p)) ? `Same pattern (${ex.movement_patterns[0]}), no loaded-joint conflict` : `Trains ${c.muscle_groups.find(m => ex.muscle_groups.includes(m))}, lower joint load`,
    }));
  }

  function buildTrace(member, opts) {
    const g = DB.buildGraph(member);
    const excl = DB.exercises.filter(e => DB.evalExerciseForMember(e, member).state === 'excluded').slice(0, 4);
    return {
      retrieval: { vectorMatches: 12, graphExpansions: g.edges.length, contextTokens: 4180 + Math.floor(Math.random() * 600) },
      exclusions: excl.map(e => ({ name: e.name, reason: DB.evalExerciseForMember(e, member).reasons[0] })),
      graphPaths: (member.injuries || []).filter(i => i.status !== 'resolved').map(i =>
        `Member → HAS_INJURY → ${i.label} → AFFECTS_JOINT → ${i.joint} → CONTRAINDICATES → Exercise`),
      stages: [
        { stage: 'Routing', latency: 0.18, tokens: 120 },
        { stage: 'Retrieval', latency: 1.2, tokens: 0 },
        { stage: 'Graph expansion', latency: 0.6, tokens: 0 },
        { stage: 'Safety filter', latency: 0.3, tokens: 0 },
        { stage: 'Generation', latency: 2.1, tokens: 1840 },
        { stage: 'Validation', latency: 0.3, tokens: 210 },
      ],
    };
  }
  function buildValidation(member) {
    const corrected = member.id === 'mbr_alex' ? [{ rejected: 'Kettlebell Goblet Cyclist Squat', reason: 'loads knee', replacement: 'Glute Bridge' }] : [];
    return { pass: true, corrected, unknownIds: [], note: corrected.length ? 'Corrected by safety validator' : 'All exercises valid & safe' };
  }

  // Workout logger parsing (multi-agent)
  function parseLog(text) {
    const t = text.toLowerCase();
    const m = t.match(/(\d+)\s*x\s*(\d+)/);
    const wt = t.match(/(\d+)\s*(lbs?|kg|pounds?)/);
    let name = null;
    const candidates = DB.exercises.filter(e => t.includes(e.name.toLowerCase().split(' ').slice(-2).join(' ')) || e.name.toLowerCase().split(' ').some(w => w.length > 4 && t.includes(w)));
    const benchMatch = DB.exercises.filter(e => t.includes('bench') && e.name.toLowerCase().includes('bench'));
    const matches = benchMatch.length ? benchMatch : candidates;
    return {
      raw: text,
      sets: m ? +m[1] : null, reps: m ? +m[2] : null,
      weight: wt ? +wt[1] : null, unit: wt ? (wt[2].startsWith('k') ? 'kg' : 'lbs') : null,
      candidates: matches.slice(0, 3),
      matched: matches[0] || null,
      confidence: matches.length === 1 ? 0.94 : matches.length > 1 ? 0.62 : 0,
      missing: [!wt && matches[0]?.supports_weight ? 'weight' : null].filter(Boolean),
    };
  }

  // search_exercises tool
  function searchExercises({ muscles = [], equipment = [], patterns = [] }) {
    return DB.exercises.filter(e =>
      (!muscles.length || muscles.some(m => e.muscle_groups.includes(m))) &&
      (!equipment.length || equipment.every(q => e.equipment_required.includes(q))) &&
      (!patterns.length || patterns.some(p => e.movement_patterns.includes(p)))
    );
  }

  // router classification (multi-agent)
  function classify(text) {
    const t = text.toLowerCase();
    if (/^(bench press|squat|deadlift)\.?$/.test(t.trim())) return { route: 'CLARIFY', confidence: 0.41, reasoning: 'Single exercise name with no verb — intent ambiguous (log? generate? explain?).', clarify: true };
    if (/\b(did|completed|logged|just|finished)\b/.test(t) && /\d/.test(t)) return { route: 'WORKOUT_LOG', confidence: 0.91, reasoning: 'Past-tense performance with numeric sets/reps → logging.' };
    if (/\b(build|generate|create|design|give me|plan)\b.*\b(workout|session|routine)\b/.test(t) || /\b(workout|session)\b/.test(t) && /\b(build|min|minute)\b/.test(t)) return { route: 'WORKOUT_GENERATE', confidence: 0.88, reasoning: 'Imperative + workout noun → generation.' };
    if (/\b(what|why|how|which|muscles?|work|good for)\b/.test(t)) return { route: 'COACH', confidence: 0.83, reasoning: 'Informational question → coach answer grounded in dataset.' };
    return { route: 'CLARIFY', confidence: 0.5, reasoning: 'Low confidence; requesting clarification.', clarify: true };
  }

  // ============================================================
  //  REAL backend calls. These hit the FastAPI hub (LangGraph + GraphRAG +
  //  OpenAI + safety validator) and map the response into the shapes the
  //  screens already render. The synchronous helpers above stay as an offline
  //  fallback that operates on the same real exercise/member data in DB.
  // ============================================================
  const API = () => window.API;

  const PRETTY_STAGE = { route: 'Routing', retrieve: 'Retrieval', generate: 'Generation', validate: 'Validation', explain: 'Explain', log: 'Log', safety_review: 'Safety review', ingest: 'Ingest' };
  function prettyStage(s) { return PRETTY_STAGE[s] || (s ? s[0].toUpperCase() + s.slice(1) : 'Stage'); }
  function inferFocus(text) {
    const t = (text || '').toLowerCase();
    if (/upper/.test(t)) return 'upper'; if (/recover|mobility/.test(t)) return 'recovery';
    if (/full/.test(t)) return 'full'; if (/condition/.test(t)) return 'conditioning'; return 'lower';
  }

  function rowFromGE(ge, kind) {
    const ex = window.DB.exById[ge.exercise.id] || {
      id: ge.exercise.id, name: ge.exercise.name, muscle_groups: [], joints_loaded: [],
      movement_patterns: [], equipment_required: [], supports_weight: true, is_reps: true, is_duration: false, priority_tier: 3,
    };
    return {
      id: ex.id, ex, kind,
      sets: ge.sets != null ? ge.sets : (kind === 'main' ? 3 : 2),
      reps: ge.reps != null ? String(ge.reps) : (ex.is_reps && !ex.is_duration ? (kind === 'main' ? '8–10' : '12') : null),
      duration: ge.duration_seconds != null ? Math.round(ge.duration_seconds) + 's' : (ex.is_duration ? '60s' : null),
      rest: ge.rest_seconds != null ? Math.round(ge.rest_seconds) + 's' : (kind === 'main' ? '90s' : '45s'),
      load: ge.load_target || (ex.supports_weight ? (kind === 'main' ? 'RPE 7' : 'light') : null),
      note: ge.notes || '',
      why: { plain: ge.why_included || `${ex.name} trains ${(ex.muscle_groups || []).slice(0, 2).join(' & ')}.`, path: ge.graph_path || '', facts: [], confidence: 'high' },
      safety_status: ge.safety_status,
    };
  }

  function mapRecommendation(payload, member, focus, traceDetail) {
    const rec = payload.recommendation || {};
    const sections = rec.sections || [];
    const rows = { warmup: [], main: [], cooldown: [] };
    sections.forEach(sec => {
      const key = /warm/i.test(sec.name) ? 'warmup' : /cool|mobility|recover/i.test(sec.name) ? 'cooldown' : 'main';
      (sec.exercises || []).forEach(ge => rows[key].push(rowFromGE(ge, key)));
    });
    if (!rows.main.length && !rows.warmup.length && !rows.cooldown.length) {
      sections.forEach(sec => (sec.exercises || []).forEach(ge => rows.main.push(rowFromGE(ge, 'main'))));
    }
    const excluded = (rec.excluded || []).map(x => ({
      ex: window.DB.exById[x.exercise.id] || { id: x.exercise.id, name: x.exercise.name },
      reason: x.reason, graph_path: x.graph_path,
    }));
    const validation = rec.validation || { passed: true };
    const corrected = (validation.corrections_applied || []).map(c => ({ rejected: c, reason: 'safety policy', replacement: '' }));
    const graphPaths = [
      ...excluded.map(x => x.graph_path).filter(Boolean),
      ...rows.main.map(r => r.why.path).filter(Boolean),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
    const stages = (traceDetail && traceDetail.stages || []).map(s => ({
      stage: prettyStage(s.kind || s.name), latency: (s.duration_ms || 0) / 1000, tokens: (s.tokens_prompt || 0) + (s.tokens_completion || 0),
    }));
    const ctx = payload.retrieval || {};
    const facts = ctx.facts || [];
    return {
      id: rec.id || ('rec_' + Math.random().toString(36).slice(2, 8)),
      member: member.id, focus: focus || inferFocus(rec.summary || rec.request || ''),
      created: rec.generated_at || new Date().toISOString(),
      request: rec.request || payload.request, summary: rec.summary,
      rows, excluded, caution: [],
      safetyStatus: (member.injuries || []).some(i => i.status === 'active' || i.status === 'improving') ? 'guarded' : 'clear',
      trace: {
        retrieval: {
          vectorMatches: facts.filter(f => f.source === 'vector' || f.source === 'hybrid').length,
          graphExpansions: facts.filter(f => f.source === 'graph' || f.source === 'hybrid').length,
          contextTokens: ctx.token_estimate || 0,
        },
        exclusions: excluded.map(x => ({ name: x.ex.name, reason: x.reason })),
        graphPaths,
        stages: stages.length ? stages : [
          { stage: 'Routing', latency: 0, tokens: 0 }, { stage: 'Retrieval', latency: 0, tokens: 0 },
          { stage: 'Generation', latency: 0, tokens: 0 }, { stage: 'Validation', latency: 0, tokens: 0 },
        ],
      },
      validation: {
        pass: validation.passed !== false, corrected,
        unknownIds: validation.unknown_exercise_ids || [],
        note: corrected.length ? 'Corrected by safety validator' : (validation.passed !== false ? 'All exercises valid & safe' : 'Validation flagged issues'),
      },
      decision: payload.decision, trace_id: payload.trace_id,
    };
  }

  async function fetchTrace(id) { try { return id ? await API().getTrace(id) : null; } catch (e) { return null; } }

  // Full backend recommendation (LangGraph hub end-to-end).
  async function recommend(member, opts = {}) {
    const text = opts.request || `Build a ${opts.focus || 'lower'}-body session for this week.`;
    const payload = await API().recommend({ request: text, member_id: member.id });
    const traceDetail = await fetchTrace(payload.trace_id);
    return mapRecommendation(payload, member, opts.focus, traceDetail);
  }

  // Run any request through the hub and return the raw routed payload + decision.
  async function runAgent(text, member) {
    const payload = await API().recommend({ request: text, member_id: member && member.id });
    return payload;
  }

  async function explainLive(member, exerciseId, action = 'skipped', request = null) {
    return API().explain({
      request: request || `Why did you ${action} this exercise for this member?`,
      member_id: member.id, exercise_id: exerciseId, action,
    });
  }

  async function logWorkoutLive(text, member) {
    return API().log({ request: text, member_id: member && member.id });
  }

  async function retrieveLive(member, query) {
    return API().retrieve({ member_id: member.id, query });
  }

  async function runEvalLive(scenarioId) { return API().runEval(scenarioId); }

  window.ENGINE = {
    buildWorkout, buildWhy, buildWhySkipped, swapCandidates, buildTrace, parseLog, searchExercises, classify, safeExercises,
    // real backend
    recommend, runAgent, explainLive, logWorkoutLive, retrieveLive, runEvalLive, mapRecommendation,
  };
})();
