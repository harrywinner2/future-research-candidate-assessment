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

  window.ENGINE = { buildWorkout, buildWhy, buildWhySkipped, swapCandidates, buildTrace, parseLog, searchExercises, classify, safeExercises };
})();
