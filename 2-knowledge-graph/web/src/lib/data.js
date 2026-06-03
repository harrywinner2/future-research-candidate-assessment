/* ============================================================
   FUTURE — Mock data layer.  window.DB
   Synthetic only. 50 exercises, members, graph, traces, schema.
   ============================================================ */
(function () {
  // ---- Exercise dataset (50) -------------------------------------------------
  // compact tuple -> object. fields per screens.md spec.
  // [name, muscles, joints, patterns, equipment, weight, reps, dur, bilateral, side, pairKey, tier]
  const M = { ch:'chest', bk:'back', sh:'shoulders', bi:'biceps', tri:'triceps', qd:'quads', ham:'hamstrings',
    gl:'glutes', cf:'calves', cr:'core', fa:'forearms', ob:'obliques', tr:'traps', la:'lats', fb:'full body', hf:'hip flexors', ad:'adductors' };
  const J = { sho:'shoulder', elb:'elbow', wr:'wrist', hip:'hip', kn:'knee', an:'ankle', cerv:'cervical spine', thor:'thoracic spine', lum:'lumbar spine' };
  const P = { hsq:'squat', hhinge:'hip hinge', lunge:'lunge', vpush:'vertical push', hpush:'horizontal push',
    vpull:'vertical pull', hpull:'horizontal pull', carry:'carry', rot:'rotation', gait:'gait', plyo:'plyometric', iso:'isometric', mob:'mobility' };
  const E = { bb:'barbell', db:'dumbbell', kb:'kettlebell', bw:'bodyweight', cab:'cable', band:'resistance band',
    mat:'yoga mat', bench:'bench', pullbar:'pull-up bar', box:'plyo box', row:'rowing machine', bike:'assault bike', mach:'machine', tm:'treadmill', sled:'sled', foam:'foam roller' };

  const raw = [
    // weighted lower
    ['Barbell Back Squat',[M.qd,M.gl,M.ham,M.cr],[J.kn,J.hip,J.lum],[P.hsq],[E.bb],1,1,0,0,null,null,1],
    ['Goblet Squat',[M.qd,M.gl,M.cr],[J.kn,J.hip],[P.hsq],[E.db],1,1,0,0,null,null,1],
    ['Kettlebell Goblet Cyclist Squat',[M.qd,M.gl],[J.kn,J.hip],[P.hsq],[E.kb],1,1,0,0,null,null,2],
    ['Romanian Deadlift',[M.ham,M.gl,M.bk],[J.hip,J.lum,J.kn],[P.hhinge],[E.bb],1,1,0,0,null,null,1],
    ['Dumbbell Romanian Deadlift',[M.ham,M.gl],[J.hip,J.lum],[P.hhinge],[E.db],1,1,0,0,null,null,1],
    ['Kettlebell Swing',[M.gl,M.ham,M.bk,M.cr],[J.hip,J.lum],[P.hhinge],[E.kb],1,1,0,0,null,null,2],
    ['Hip Thrust',[M.gl,M.ham],[J.hip],[P.hhinge],[E.bb,E.bench],1,1,0,0,null,null,1],
    ['Glute Bridge',[M.gl,M.ham,M.cr],[J.hip],[P.hhinge],[E.bw,E.mat],0,1,0,0,null,null,2],
    ['Walking Lunge',[M.qd,M.gl,M.ham],[J.kn,J.hip,J.an],[P.lunge],[E.db],1,1,0,1,null,null,2],
    ['Reverse Lunge',[M.qd,M.gl],[J.kn,J.hip],[P.lunge],[E.db],1,1,0,1,null,null,2],
    ['Bulgarian Split Squat — Left',[M.qd,M.gl],[J.kn,J.hip],[P.lunge],[E.db,E.bench],1,1,0,1,'left','bss',2],
    ['Bulgarian Split Squat — Right',[M.qd,M.gl],[J.kn,J.hip],[P.lunge],[E.db,E.bench],1,1,0,1,'right','bss',2],
    ['Leg Press',[M.qd,M.gl,M.ham],[J.kn,J.hip],[P.hsq],[E.mach],1,1,0,0,null,null,2],
    ['Leg Extension',[M.qd],[J.kn],[P.hsq],[E.mach],1,1,0,0,null,null,3],
    ['Seated Leg Curl',[M.ham],[J.kn],[P.hhinge],[E.mach],1,1,0,0,null,null,3],
    ['Standing Calf Raise',[M.cf],[J.an],[P.iso],[E.db],1,1,0,0,null,null,3],
    ['Box Step-Up',[M.qd,M.gl],[J.kn,J.hip,J.an],[P.lunge],[E.db,E.box],1,1,0,1,null,null,2],
    // weighted upper push
    ['Barbell Bench Press',[M.ch,M.tri,M.sh],[J.sho,J.elb,J.wr],[P.hpush],[E.bb,E.bench],1,1,0,0,null,null,1],
    ['Dumbbell Bench Press',[M.ch,M.tri,M.sh],[J.sho,J.elb],[P.hpush],[E.db,E.bench],1,1,0,0,null,null,1],
    ['Incline Dumbbell Press',[M.ch,M.sh,M.tri],[J.sho,J.elb],[P.hpush],[E.db,E.bench],1,1,0,0,null,null,2],
    ['Overhead Press',[M.sh,M.tri,M.cr],[J.sho,J.elb,J.wr],[P.vpush],[E.bb],1,1,0,0,null,null,1],
    ['Dumbbell Shoulder Press',[M.sh,M.tri],[J.sho,J.elb],[P.vpush],[E.db],1,1,0,0,null,null,2],
    ['Push-Up',[M.ch,M.tri,M.sh,M.cr],[J.sho,J.elb,J.wr],[P.hpush],[E.bw],0,1,0,0,null,null,2],
    ['Cable Tricep Pushdown',[M.tri],[J.elb],[P.iso],[E.cab],1,1,0,0,null,null,3],
    ['Lateral Raise',[M.sh],[J.sho],[P.iso],[E.db],1,1,0,0,null,null,3],
    // weighted upper pull
    ['Pull-Up',[M.la,M.bk,M.bi],[J.sho,J.elb,J.wr],[P.vpull],[E.pullbar,E.bw],0,1,0,0,null,null,1],
    ['Lat Pulldown',[M.la,M.bk,M.bi],[J.sho,J.elb],[P.vpull],[E.cab,E.mach],1,1,0,0,null,null,2],
    ['Bent-Over Barbell Row',[M.bk,M.la,M.bi,M.tr],[J.sho,J.elb,J.lum],[P.hpull],[E.bb],1,1,0,0,null,null,1],
    ['Single-Arm Dumbbell Row — Left',[M.bk,M.la,M.bi],[J.sho,J.elb],[P.hpull],[E.db,E.bench],1,1,0,1,'left','sadr',2],
    ['Single-Arm Dumbbell Row — Right',[M.bk,M.la,M.bi],[J.sho,J.elb],[P.hpull],[E.db,E.bench],1,1,0,1,'right','sadr',2],
    ['Seated Cable Row',[M.bk,M.la,M.bi],[J.sho,J.elb],[P.hpull],[E.cab],1,1,0,0,null,null,2],
    ['Face Pull',[M.sh,M.tr,M.bk],[J.sho],[P.hpull],[E.cab,E.band],1,1,0,0,null,null,3],
    ['Dumbbell Bicep Curl',[M.bi,M.fa],[J.elb,J.wr],[P.iso],[E.db],1,1,0,0,null,null,3],
    ['Band Pull-Apart',[M.sh,M.tr,M.bk],[J.sho],[P.hpull],[E.band],0,1,0,0,null,null,3],
    // core / rotation
    ['Plank',[M.cr,M.sh],[J.sho],[P.iso],[E.bw,E.mat],0,0,1,0,null,null,2],
    ['Side Plank',[M.cr,M.ob],[J.sho],[P.iso],[E.bw,E.mat],0,0,1,1,null,null,2],
    ['Pallof Press',[M.cr,M.ob],[],[P.rot],[E.cab,E.band],1,1,0,0,null,null,3],
    ['Dead Bug',[M.cr],[],[P.iso],[E.bw,E.mat],0,1,0,0,null,null,3],
    ['Hanging Knee Raise',[M.cr,M.hf],[J.sho],[P.iso],[E.pullbar],0,1,0,0,null,null,3],
    ['Cable Woodchop',[M.cr,M.ob],[J.thor],[P.rot],[E.cab],1,1,0,1,null,null,3],
    // cardio / conditioning
    ['Rowing Machine',[M.fb,M.bk,M.qd],[J.kn,J.hip,J.sho],[P.gait],[E.row],0,0,1,0,null,null,2],
    ['Assault Bike',[M.fb,M.qd],[J.kn,J.hip],[P.gait],[E.bike],0,0,1,0,null,null,2],
    ['Treadmill Zone 2 Run',[M.qd,M.cf,M.ham],[J.kn,J.an,J.hip],[P.gait],[E.tm],0,0,1,0,null,null,2],
    ['Box Jump',[M.qd,M.gl,M.cf],[J.kn,J.an,J.hip],[P.plyo],[E.box],0,1,0,0,null,null,2],
    ['Jump Rope',[M.cf,M.qd],[J.an,J.kn],[P.plyo],[E.bw],0,0,1,0,null,null,3],
    // mobility / regen
    ['Cat-Cow',[M.bk,M.cr],[J.thor,J.lum],[P.mob],[E.mat],0,0,1,0,null,null,2],
    ['World’s Greatest Stretch',[M.hf,M.bk,M.sh],[J.hip,J.thor],[P.mob],[E.mat],0,0,1,1,null,null,2],
    ['Foam Roll Thoracic',[M.bk,M.tr],[J.thor],[P.mob],[E.foam,E.mat],0,0,1,0,null,null,3],
    ['90/90 Hip Switch',[M.hf,M.gl],[J.hip],[P.mob],[E.mat],0,0,1,0,null,null,3],
    ['Bird Dog',[M.cr,M.gl,M.bk],[],[P.iso],[E.bw,E.mat],0,1,0,1,null,null,3],
    ['Wall Slide',[M.sh,M.tr],[J.sho],[P.mob],[E.bw],0,1,0,0,null,null,3],
  ];
  const pairBuckets = {};
  const exercises = raw.map((r, i) => {
    const id = 'ex_' + String(i + 1).padStart(3, '0');
    const o = { id, name: r[0], muscle_groups: r[1], joints_loaded: r[2], movement_patterns: r[3],
      equipment_required: r[4], supports_weight: !!r[5], is_reps: !!r[6], is_duration: !!r[7],
      is_bilateral: !!r[8], side: r[9], _pairKey: r[10], priority_tier: r[11],
      bilateral_pair_id: null, est_rep_seconds: r[7] ? null : (r[5] ? 4 : 3) };
    if (r[10]) (pairBuckets[r[10]] = pairBuckets[r[10]] || []).push(o);
    return o;
  });
  Object.values(pairBuckets).forEach(arr => { if (arr.length === 2) { arr[0].bilateral_pair_id = arr[1].id; arr[1].bilateral_pair_id = arr[0].id; } });
  const exById = Object.fromEntries(exercises.map(e => [e.id, e]));
  const live = { exercises: null };  // populated by DB.init() with real API data
  const byName = n => (live.exercises || exercises).find(e => e.name === n);

  // ---- Members ---------------------------------------------------------------
  const members = [
    {
      id: 'mbr_alex', name: 'Alex Rivera', persona: 'Returning lifter · 30s', initials: 'AR', hue: 18,
      goal: 'Rebuild lower-body strength', frequency: '4 days/week', skill: 'Intermediate',
      equipment: ['dumbbell', 'kettlebell', 'bench', 'yoga mat', 'resistance band'],
      preferences: ['Prefers dumbbells', 'Trains at home', 'Avoid high-impact cardio'],
      goals: ['Rebuild lower-body strength', 'Return to running pain-free', 'Stay consistent 4x/week'],
      injuries: [
        { id: 'inj_alex_knee', label: 'Patellofemoral knee pain', joint: 'knee', severity: 'moderate', status: 'active', noted: '2026-05-22',
          patterns: ['squat', 'plyometric', 'lunge'], source: 'sig_alex_1', rule: 'caution-load' },
      ],
      flags: ['Active knee pain', 'No plyometrics'],
      graphHealth: { nodes: 38, edges: 61, lastIngest: '4 min ago', vector: 'healthy' },
      adherence: 0.82, demo: true,
    },
    {
      id: 'mbr_michelle', name: 'Michelle Tan', persona: 'Future Member · 5k goal', initials: 'MT', hue: 300,
      goal: 'Train for a 5k in two months', frequency: '4 days/week', skill: 'Beginner–Intermediate',
      equipment: ['gym access', 'yoga mat', 'dumbbell', 'treadmill'],
      preferences: ['Prefers AM workouts', 'Travels for work 1x/month', 'Enjoys yoga & HIIT'],
      goals: ['Build a consistent routine', 'Feel confident in the gym', 'Train for a 5k in two months'],
      injuries: [
        { id: 'inj_mich_lumbar', label: 'Lower back pain', joint: 'lumbar spine', severity: 'mild', status: 'active', noted: '2026-05-10',
          patterns: ['hip hinge'], source: 'sig_mich_1', rule: 'caution-load' },
        { id: 'inj_mich_knee', label: 'Knee injury (recovered)', joint: 'knee', severity: 'resolved', status: 'resolved', noted: '2025-11-02',
          patterns: [], source: 'sig_mich_2', rule: 'monitor' },
      ],
      flags: ['Lower-back caution', 'Recovered knee — monitor'],
      graphHealth: { nodes: 44, edges: 73, lastIngest: '2 hours ago', vector: 'healthy' },
      adherence: 0.91, demo: false,
    },
    {
      id: 'mbr_dana', name: 'Dana Okafor', persona: 'Hypertrophy focus · 40s', initials: 'DO', hue: 250,
      goal: 'Upper-body hypertrophy', frequency: '5 days/week', skill: 'Advanced',
      equipment: ['barbell', 'dumbbell', 'cable', 'bench', 'pull-up bar', 'resistance band'],
      preferences: ['Prefers barbell work', 'Push/pull/legs split'],
      goals: ['Upper-body hypertrophy', 'Improve overhead pressing'],
      injuries: [
        { id: 'inj_dana_shoulder', label: 'Shoulder impingement', joint: 'shoulder', severity: 'moderate', status: 'improving', noted: '2026-04-18',
          patterns: ['vertical push'], source: 'sig_dana_1', rule: 'caution-load' },
      ],
      flags: ['Shoulder caution — limit overhead'],
      graphHealth: { nodes: 51, edges: 88, lastIngest: '1 day ago', vector: 'healthy' },
      adherence: 0.76, demo: false,
    },
    {
      id: 'mbr_priya', name: 'Priya Nair', persona: 'New member · thin context', initials: 'PN', hue: 150,
      goal: 'General fitness', frequency: '—', skill: 'Unknown',
      equipment: ['bodyweight'],
      preferences: [],
      goals: ['Get started'],
      injuries: [],
      flags: [],
      thin: true,
      graphHealth: { nodes: 6, edges: 4, lastIngest: 'just now', vector: 'sparse' },
      adherence: null,
    },
  ];
  const memberById = Object.fromEntries(members.map(m => [m.id, m]));

  // ---- Safety eval -----------------------------------------------------------
  function evalExerciseForMember(ex, mbr) {
    if (!mbr) return { state: 'safe', reasons: [] };
    const reasons = [];
    let state = 'safe';
    const activeInj = (mbr.injuries || []).filter(i => i.status === 'active' || i.status === 'improving');
    // missing joint data
    if (ex.joints_loaded.length === 0 && ex.movement_patterns.includes('rotation')) {
      // ok, rotation w/o joint
    }
    for (const inj of activeInj) {
      if (ex.joints_loaded.includes(inj.joint)) {
        if (inj.severity === 'moderate' || inj.severity === 'severe') { state = 'excluded'; reasons.push(`Loads ${inj.joint} · ${inj.label} (${inj.severity})`); }
        else if (state !== 'excluded') { state = 'caution'; reasons.push(`Loads ${inj.joint} · ${inj.label} (mild)`); }
      }
      for (const pat of inj.patterns) {
        if (ex.movement_patterns.includes(pat)) {
          if (pat === 'plyometric') { state = 'excluded'; reasons.push(`${pat} contraindicated · ${inj.label}`); }
          else if (state !== 'excluded') { state = state === 'safe' ? 'caution' : state; reasons.push(`${pat} caution · ${inj.label}`); }
        }
      }
    }
    // equipment availability
    const equip = (mbr.equipment || []).map(e => e.toLowerCase());
    const hasGym = equip.some(e => e.includes('gym'));
    const missing = ex.equipment_required.filter(req => {
      if (req === 'bodyweight') return false;
      if (hasGym && ['barbell','cable','machine','bench','pull-up bar','plyo box','rowing machine','assault bike','treadmill','sled'].includes(req)) return false;
      return !equip.includes(req);
    });
    if (missing.length) { if (state !== 'excluded') state = 'excluded'; reasons.push(`Requires unavailable equipment: ${missing.join(', ')}`); }
    return { state, reasons };
  }

  // ---- Graph builder ---------------------------------------------------------
  // returns { nodes:[{id,type,label,...}], edges:[{id,source,target,type}] }
  function buildGraph(mbr) {
    const nodes = [], edges = [], seen = new Set();
    const add = (n) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); } };
    const link = (s, t, type, extra) => edges.push(Object.assign({ id: s + '|' + type + '|' + t, source: s, target: t, type }, extra || {}));
    if (!mbr) return { nodes, edges };
    add({ id: mbr.id, type: 'Member', label: mbr.name, core: true });
    // goals
    mbr.goals.forEach((g, i) => { const id = 'goal_' + mbr.id + '_' + i; add({ id, type: 'Goal', label: g }); link(mbr.id, id, 'HAS_GOAL'); });
    // prefs
    mbr.preferences.forEach((p, i) => { const id = 'pref_' + mbr.id + '_' + i; add({ id, type: 'Preference', label: p }); link(mbr.id, id, 'PREFERS'); });
    // equipment
    mbr.equipment.forEach((e, i) => { const id = 'equip_' + e.replace(/\W/g, ''); add({ id, type: 'Equipment', label: e }); link(mbr.id, id, 'HAS_EQUIPMENT'); });
    // injuries -> joints -> exercises (contraindication)
    mbr.injuries.forEach(inj => {
      add({ id: inj.id, type: 'Injury', label: inj.label, status: inj.status, severity: inj.severity });
      link(mbr.id, inj.id, 'HAS_INJURY');
      // context signal
      if (inj.source) { add({ id: inj.source, type: 'ContextSignal', label: signalText(inj.source) }); link(inj.source, inj.id, 'MENTIONED_IN'); }
      // An injury may have no mapped joint (e.g. a chat signal not yet localised);
      // skip joint/contraindication edges rather than crash.
      if (!inj.joint) return;
      const jid = 'joint_' + String(inj.joint).replace(/\W/g, '');
      add({ id: jid, type: 'Joint', label: inj.joint });
      link(inj.id, jid, 'AFFECTS_JOINT');
      if (inj.status === 'active' || inj.status === 'improving') {
        (live.exercises || exercises).filter(ex => ex.joints_loaded.includes(inj.joint)).slice(0, 7).forEach(ex => {
          add({ id: ex.id, type: 'Exercise', label: ex.name, ex });
          link(ex.id, jid, 'LOADS_JOINT', { unsafe: true });
          link(inj.id, ex.id, 'CONTRAINDICATES', { unsafe: true });
        });
      }
    });
    // a few safe exercises trained toward goal + muscles + patterns
    const safeEx = (live.exercises || exercises).filter(ex => evalExerciseForMember(ex, mbr).state === 'safe').slice(0, 6);
    safeEx.forEach(ex => {
      add({ id: ex.id, type: 'Exercise', label: ex.name, ex });
      ex.muscle_groups.slice(0, 2).forEach(mg => { const id = 'mus_' + mg.replace(/\W/g, ''); add({ id, type: 'MuscleGroup', label: mg }); link(ex.id, id, 'TRAINS_MUSCLE'); });
      ex.movement_patterns.slice(0, 1).forEach(p => { const id = 'pat_' + p.replace(/\W/g, ''); add({ id, type: 'MovementPattern', label: p }); link(ex.id, id, 'HAS_MOVEMENT_PATTERN'); });
    });
    // a completed workout node
    add({ id: 'wk_recent_' + mbr.id, type: 'Workout', label: 'Upper-body session · May 28' });
    link(mbr.id, 'wk_recent_' + mbr.id, 'COMPLETED_WORKOUT');
    return { nodes, edges };
  }
  function signalText(id) {
    const t = { sig_alex_1: '"Knee felt irritated after lunges last week."', sig_mich_1: '"Lower back tight after deadlifts."',
      sig_mich_2: 'Resolved knee injury — cleared Nov 2025', sig_dana_1: '"Shoulder pinches on overhead press."' };
    return t[id] || 'Context signal';
  }

  // ---- Recent activity / history --------------------------------------------
  function historyFor(mbr) {
    const base = [
      { date: '2026-05-31', focus: 'Lower body', status: 'completed', adherence: 'completed', source: 'AI generated', complaints: [], dur: 48 },
      { date: '2026-05-29', focus: 'Upper push', status: 'completed', adherence: 'partial', source: 'coach edited', complaints: [], dur: 41 },
      { date: '2026-05-27', focus: 'Conditioning', status: 'missed', adherence: 'missed', source: 'AI generated', complaints: [], dur: 0 },
      { date: '2026-05-25', focus: 'Lower body', status: 'modified', adherence: 'completed', source: 'AI generated', complaints: mbr.id==='mbr_alex'?['Knee tweaked on lunges']:[], dur: 52 },
      { date: '2026-05-23', focus: 'Mobility', status: 'completed', adherence: 'completed', source: 'manual entry', complaints: [], dur: 22 },
      { date: '2026-05-21', focus: 'Upper pull', status: 'completed', adherence: 'completed', source: 'AI generated', complaints: [], dur: 44 },
    ];
    return base;
  }

  // ---- Versions --------------------------------------------------------------
  const versions = { model: 'claude-opus-4 · anthropic', prompt: 'coach-gen v3.2', retrieval: 'hybrid-rrf v1.4', safety: 'standard v2.1', schema: 'graph v0.9' };

  // ---- Prompt templates ------------------------------------------------------
  const prompts = [
    { id: 'tpl_router', name: 'Router', purpose: 'router', version: 'v2.0', hash: '8f3a1c', edited: '2026-05-19',
      vars: ['user_message', 'member_context'], schema: 'RouteDecision { route, confidence, reasoning, needs_clarification }',
      body: 'You are the routing layer. Classify the request into COACH, WORKOUT_GENERATE, WORKOUT_LOG, or CLARIFY.\nReturn structured RouteDecision. If confidence < 0.55 choose CLARIFY.\n\nUser: {{user_message}}\nMember: {{member_context}}' },
    { id: 'tpl_coach', name: 'Coach Generator', purpose: 'coach', version: 'v3.2', hash: 'c01be4', edited: '2026-05-28',
      vars: ['member_context', 'retrieved_graph', 'retrieved_notes', 'request', 'safety_policy'], schema: 'WorkoutPlan { warmup[], main[], cooldown[], notes, excluded[] }',
      body: 'You are an injury-aware strength coach. Build a structured workout for the member.\nNEVER invent exercises — only use exercises present in {{retrieved_graph}}.\nRespect the safety policy {{safety_policy}}: exclude exercises loading injured joints.\nFor each included exercise, cite the graph fact that justifies inclusion.\n\nMember: {{member_context}}\nGraph context: {{retrieved_graph}}\nNotes: {{retrieved_notes}}\nRequest: {{request}}' },
    { id: 'tpl_logger', name: 'Workout Logger', purpose: 'logger', version: 'v1.6', hash: '4d9f02', edited: '2026-05-11',
      vars: ['raw_text', 'exercise_index'], schema: 'WorkoutLog { exercise_id, sets, reps, weight, unit, duration, confidence, missing[] }',
      body: 'Extract structured log entries from natural language. Fuzzy-match the exercise name to {{exercise_index}}.\nIf weight is not stated, leave null — never invent. If the exercise does not support weight, set weight=null and note it.\n\nText: {{raw_text}}' },
    { id: 'tpl_explainer', name: 'Explainer', purpose: 'explainer', version: 'v2.3', hash: 'aa17de', edited: '2026-05-24',
      vars: ['decision', 'graph_path', 'member_facts'], schema: 'Explanation { plain, graph_path, facts[], confidence }',
      body: 'Explain a recommendation decision in plain English, grounded in the graph path {{graph_path}} and member facts {{member_facts}}. Cite every fact.' },
    { id: 'tpl_validator', name: 'Safety Validator', purpose: 'validator', version: 'v2.1', hash: 'fe7720', edited: '2026-05-26',
      vars: ['recommendation', 'member_context', 'exercise_index'], schema: 'ValidationResult { pass, corrected[], unknown_ids[], violations[] }',
      body: 'Validate the recommendation. Reject unknown exercise IDs. Reject any exercise contraindicated for the member. Return corrections.' },
    { id: 'tpl_safety', name: 'Safety Reviewer', purpose: 'safety', version: 'v2.1', hash: 'b3c9a0', edited: '2026-05-26',
      vars: ['plan', 'policy'], schema: 'SafetyReview { decisions[], conservatism }',
      body: 'Apply safety policy {{policy}} to {{plan}}. For each exercise return safe / caution / exclude with the rule that fired.' },
  ];

  // ---- Schema (nodes + edges) ------------------------------------------------
  const schemaNodes = [
    ['Member', 'The synthetic member (coach\'s client).', ['id:str pk', 'name:str', 'persona:str', 'skill:enum'], 'mbr_alex'],
    ['Goal', 'A training objective.', ['id:str pk', 'label:str'], 'goal_alex_0'],
    ['Preference', 'Stated preference or constraint.', ['id:str pk', 'label:str'], 'pref_alex_0'],
    ['Equipment', 'Available equipment item.', ['id:str pk', 'label:str'], 'equip_dumbbell'],
    ['Injury', 'Injury or condition.', ['id:str pk', 'label:str', 'severity:enum', 'status:enum', 'noted:date'], 'inj_alex_knee'],
    ['Joint', 'Anatomical joint (FMA-aligned).', ['id:str pk', 'label:str', 'fma_code:str?'], 'joint_knee'],
    ['Exercise', 'Dataset exercise.', ['id:str pk', 'name:str', 'priority_tier:int', 'supports_weight:bool', 'is_bilateral:bool'], 'ex_001'],
    ['MuscleGroup', 'Trained muscle group.', ['id:str pk', 'label:str'], 'mus_quads'],
    ['MovementPattern', 'Movement pattern classification.', ['id:str pk', 'label:str'], 'pat_squat'],
    ['Workout', 'A generated or completed session.', ['id:str pk', 'date:date', 'focus:str'], 'wk_recent'],
    ['WorkoutLog', 'Logged performance entry.', ['id:str pk', 'sets:int', 'reps:int?', 'weight:float?'], 'log_001'],
    ['ContextSignal', 'Raw ingested synthetic note.', ['id:str pk', 'text:str', 'type:enum', 'confidence:float', 'ts:datetime'], 'sig_alex_1'],
  ];
  const schemaEdges = [
    ['HAS_GOAL', 'Member', 'Goal', '1:N', 'Member pursues goal.'],
    ['PREFERS', 'Member', 'Preference', '1:N', 'Member preference / constraint.'],
    ['HAS_EQUIPMENT', 'Member', 'Equipment', '1:N', 'Member can access equipment.'],
    ['HAS_INJURY', 'Member', 'Injury', '1:N', 'Member has active/resolved injury.'],
    ['AFFECTS_JOINT', 'Injury', 'Joint', 'N:1', 'Injury affects this joint.'],
    ['LOADS_JOINT', 'Exercise', 'Joint', 'N:N', 'Exercise mechanically loads joint.'],
    ['TRAINS_MUSCLE', 'Exercise', 'MuscleGroup', 'N:N', 'Exercise trains muscle group.'],
    ['USES_EQUIPMENT', 'Exercise', 'Equipment', 'N:N', 'Exercise requires equipment.'],
    ['HAS_MOVEMENT_PATTERN', 'Exercise', 'MovementPattern', 'N:N', 'Exercise classified by pattern.'],
    ['CONTRAINDICATES', 'Injury', 'Exercise', 'N:N', 'Derived: injury contraindicates exercise.'],
    ['COMPLETED_WORKOUT', 'Member', 'Workout', '1:N', 'Member completed session.'],
    ['MENTIONED_IN', 'ContextSignal', 'Injury', 'N:N', 'Signal evidences a fact.'],
    ['HAS_BILATERAL_PAIR', 'Exercise', 'Exercise', '1:1', 'Left/right paired movement.'],
  ];
  const invariants = [
    { rule: 'An active Injury must have ≥1 AFFECTS_JOINT edge.', status: 'pass', count: 0 },
    { rule: 'Every CONTRAINDICATES edge must trace to an active Injury.', status: 'pass', count: 0 },
    { rule: 'Exercise with empty joints_loaded must carry a missing-data flag.', status: 'warn', count: 3 },
    { rule: 'A bilateral Exercise must resolve its bilateral_pair_id.', status: 'pass', count: 0 },
  ];

  // ---- API endpoints ---------------------------------------------------------
  const endpoints = [
    { method: 'POST', path: '/ingest', desc: 'Ingest a synthetic signal → nodes + edges.' },
    { method: 'POST', path: '/retrieve', desc: 'Hybrid GraphRAG retrieval for a member + query.' },
    { method: 'POST', path: '/recommend', desc: 'Generate an injury-aware structured workout.' },
    { method: 'POST', path: '/explain', desc: 'Explain an inclusion / exclusion decision.' },
    { method: 'GET', path: '/members', desc: 'List synthetic members.' },
    { method: 'GET', path: '/members/:id/graph', desc: 'Member-centered subgraph.' },
    { method: 'GET', path: '/exercises', desc: 'Exercise dataset with safety metadata.' },
  ];

  // ---- Settings defaults -----------------------------------------------------
  const settings = {
    provider: 'Anthropic', model: 'claude-opus-4', temperature: 0.3, maxTokens: 2048,
    embModel: 'voyage-3', embDim: 1024, embCache: true,
    topK: 8, graphDepth: 2, maxContextTokens: 6000, dedup: 'mmr', recencyBoost: 0.3,
    validatorMode: 'strict', retryBudget: 2,
    memWindow: 8, summarize: 'rolling', maxTurns: 40,
    logLevel: 'info', redactPII: true, sampleRate: 0.25,
  };

  // ---- Safety policy ---------------------------------------------------------
  const safetyPolicy = {
    conservatism: 'standard',
    joints: { knee: 'exclude', shoulder: 'caution-only', 'lumbar spine': 'caution-only', hip: 'allow-reduced', ankle: 'allow-reduced' },
    patterns: { plyometric: 'exclude-when-knee', 'vertical push': 'caution-when-shoulder' },
    equipment: 'hard-exclude',
    bilateral: 'replace-both',
    missingData: 'caution',
    fadeDays: 21,
  };

  // ---- Eval scenarios --------------------------------------------------------
  const scenarios = [
    { id: 'sc_injury', name: 'Injury filtering', desc: 'Knee-injury member requests lower body; knee-loading exercises excluded or replaced.', metric: 'Safety violation rate', expected: 'No knee-loading exercise in plan', status: 'pass' },
    { id: 'sc_explain', name: 'Explainability', desc: '"Why did you skip X?" returns graph-traceable reasoning.', metric: 'Explanation coverage', expected: 'Graph path returned', status: 'pass' },
    { id: 'sc_thin', name: 'Thin retrieval', desc: 'Member has incomplete context; assistant asks for clarification.', metric: 'Clarification rate', expected: 'Clarifying question, no guess', status: 'pass' },
    { id: 'sc_invalid', name: 'Invalid recommendation', desc: 'Validator catches unknown exercise ID or contraindicated exercise.', metric: 'Unknown ID rate', expected: 'Caught & corrected', status: 'pass' },
    { id: 'sc_noresult', name: 'No search results', desc: 'Unavailable equipment returns no results and recovers gracefully.', metric: 'Recovery', expected: 'Explains zero results, offers alternatives', status: 'warn' },
  ];
  const metrics = {
    safetyViolation: 0.004, unknownId: 0.011, retrievalHit: 0.93, explanationCoverage: 0.97,
    p50: 2.1, p95: 4.8, clarification: 0.08, acceptance: 0.84, avgTokens: 5240,
  };

  // ---- Cost / perf series ----------------------------------------------------
  const costSeries = Array.from({ length: 14 }, (_, i) => ({
    day: i, cost: 2.1 + Math.sin(i / 2) * 0.9 + i * 0.12 + Math.random() * 0.3,
    tokens: 120000 + i * 9000 + Math.random() * 20000,
  }));
  const latencyStages = [
    { stage: 'Routing', p50: 0.18, p95: 0.4, p99: 0.7, budget: 0.5 },
    { stage: 'Retrieval', p50: 1.2, p95: 2.0, p99: 2.9, budget: 2.0 },
    { stage: 'Generation', p50: 1.9, p95: 4.1, p99: 6.2, budget: 4.5 },
    { stage: 'Validation', p50: 0.3, p95: 0.6, p99: 0.9, budget: 1.0 },
  ];

  // ---- Notifications ---------------------------------------------------------
  const notifications = [
    { id: 'n1', sev: 'safety', title: 'Safety validator corrected a recommendation', detail: 'Replaced Kettlebell Goblet Cyclist Squat → Glute Bridge for Alex Rivera.', ts: '2 min ago', screen: 'trace' },
    { id: 'n2', sev: 'warning', title: 'Vector index stale', detail: 'Falling back to graph-only retrieval. Re-embed recommended.', ts: '18 min ago', screen: 'settings' },
    { id: 'n3', sev: 'info', title: 'Ingested 3 facts for Alex Rivera', detail: 'Knee-irritation signal strengthened.', ts: '1 hour ago', screen: 'ingest' },
  ];

  // ---- Tradeoffs / ADR -------------------------------------------------------
  const tradeoffs = {
    implemented: [
      ['GraphRAG retrieval over injuries → joints → exercises', 'done'],
      ['Injury-aware safety filtering with explainable exclusions', 'done'],
      ['Structured workout generation with per-exercise provenance', 'done'],
      ['Force-directed graph explorer with safety neighborhood', 'done'],
      ['Synthetic-only ingestion with extraction preview', 'done'],
      ['Multi-turn memory inspector', 'partial'],
      ['SNOMED/FMA ontology grounding', 'cut'],
      ['Live cost telemetry from provider billing', 'cut'],
    ],
    limitations: [
      ['Embeddings are mocked; retrieval scores are illustrative.', 'low'],
      ['Fade decay for resolved injuries is time-based, not session-based yet.', 'medium'],
      ['Graph physics can crowd on members with >60 nodes.', 'low'],
    ],
    next: [
      ['Wire real Neo4j + pgvector behind the API layer', 'L', 'high'],
      ['Session-based injury fade with recurrence detection', 'M', 'high'],
      ['Batch eval harness across all members nightly', 'M', 'medium'],
    ],
    adr: [
      ['Neo4j over Postgres + pgvector', 'Native graph traversal makes injury→joint→exercise paths first-class and explainable. We keep pgvector only as a fallback index.'],
      ['Prompt caching off by default', 'Member context changes between turns; stale cache risked safety drift. Enabled only for static system prompt.'],
      ['Hybrid RRF retrieval', 'Pure vector missed structural contraindications; pure graph missed semantic intent. Reciprocal-rank-fusion balances both.'],
    ],
  };

  // ---- Sessions --------------------------------------------------------------
  const sessions = [
    { id: 's1', member: 'mbr_alex', title: 'Lower-body week + knee question', start: 'Today 09:14', last: 'Why did you skip barbell squats?', msgs: 8, recs: 2, outcome: 'approved', pinned: true },
    { id: 's2', member: 'mbr_alex', title: 'Return-to-run progression', start: 'May 30', last: 'When can he start jogging?', msgs: 5, recs: 1, outcome: 'edited', pinned: false },
    { id: 's3', member: 'mbr_michelle', title: '5k base-building block', start: 'May 29', last: 'Build week 3.', msgs: 12, recs: 3, outcome: 'approved', pinned: false },
    { id: 's4', member: 'mbr_dana', title: 'Overhead press alternatives', start: 'May 27', last: 'Shoulder-safe pressing?', msgs: 6, recs: 2, outcome: 'discarded', pinned: false },
  ];

  // ---- Multi-agent demo prompts ----------------------------------------------
  const maPrompts = [
    { label: 'Coach question', text: 'What muscles does a deadlift work?', route: 'COACH' },
    { label: 'Generate workout', text: 'Build me a 30 min upper body session with dumbbells.', route: 'WORKOUT_GENERATE' },
    { label: 'Log workout', text: 'I just did 3x10 bench press at 185 lbs.', route: 'WORKOUT_LOG' },
    { label: 'Ambiguous', text: 'Bench press.', route: 'CLARIFY' },
    { label: 'No results', text: 'Build me a workout using a rowing machine and sled.', route: 'WORKOUT_GENERATE' },
  ];

  // ---- Real-data bootstrap ---------------------------------------------------
  // Everything above is synthetic fallback (keeps the UI alive offline / when the
  // API is unreachable — the "degraded mode" the spec calls for). DB.init() fetches
  // the real backend and overwrites the API-backed collections in place, so every
  // screen renders live data from the graph database.
  const initials = name => (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const hueFor = id => { let h = 0; for (const c of (id || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const sevWord = s => { const n = typeof s === 'number' ? s : 2; return n <= 2 ? 'mild' : n <= 4 ? 'moderate' : 'severe'; };

  function mapExercise(e) {
    return {
      id: e.id, name: e.name,
      muscle_groups: e.muscle_groups || [], joints_loaded: e.joints_loaded || [],
      movement_patterns: e.movement_patterns || [], equipment_required: e.equipment_required || [],
      supports_weight: e.supports_weight !== false, is_reps: e.is_reps !== false, is_duration: !!e.is_duration,
      is_bilateral: !!e.is_bilateral, side: e.side || null, bilateral_pair_id: e.bilateral_pair_id || null,
      priority_tier: e.priority_tier || 3, est_rep_seconds: e.estimated_rep_duration || (e.is_duration ? null : 4),
    };
  }
  function mapMember(item, detail) {
    const d = detail || {};
    const injuries = (d.injuries || []).map(i => ({
      id: i.id, label: i.label, joint: (i.joints && i.joints[0]) || null, joints: i.joints || [],
      severity: i.status === 'resolved' ? 'resolved' : sevWord(i.severity), status: i.status || 'active',
      noted: i.noted_at || '—', patterns: [], source: null, rule: 'caution-load',
    }));
    const active = injuries.filter(i => i.status === 'active' || i.status === 'improving');
    const equipment = d.equipment || item.equipment || [];
    const goals = (d.goals || []).map(g => g.label);
    const thin = goals.length === 0 && injuries.length === 0 && equipment.length <= 1;
    return {
      id: item.id, name: item.name, persona: item.persona || d.persona || '',
      initials: initials(item.name), hue: hueFor(item.id),
      goal: goals[0] || 'General fitness', frequency: d.training_days_per_week ? d.training_days_per_week + ' days/week' : '—',
      skill: d.skill_level || '—', equipment, preferences: (d.preferences || []).map(p => p.label),
      goals: goals.length ? goals : ['Get started'], injuries, flags: active.map(i => i.label),
      graphHealth: { nodes: 0, edges: 0, lastIngest: 'seeded', vector: thin ? 'sparse' : 'healthy' },
      adherence: thin ? null : +(0.7 + (hueFor(item.id) % 25) / 100).toFixed(2), demo: true, thin,
    };
  }

  async function init() {
    const API = window.API;
    if (!API) return;
    try {
      const [exs, mems, settings, schema, prompts, safety, scenarios, metricsResp] = await Promise.all([
        API.listExercises(), API.listMembers(),
        API.getSettings().catch(() => null), API.graphSchema().catch(() => null),
        API.prompts().catch(() => null), API.safetyPolicy().catch(() => null),
        API.evalScenarios().catch(() => null), API.metrics().catch(() => null),
      ]);

      const exercisesReal = exs.map(mapExercise);
      live.exercises = exercisesReal;
      DB.exercises = exercisesReal;
      DB.exById = Object.fromEntries(exercisesReal.map(e => [e.id, e]));
      DB.byName = n => exercisesReal.find(e => e.name === n);
      DB.muscleList = [...new Set(exercisesReal.flatMap(e => e.muscle_groups))].sort();
      DB.jointList = [...new Set(exercisesReal.flatMap(e => e.joints_loaded))].sort();
      DB.patternList = [...new Set(exercisesReal.flatMap(e => e.movement_patterns))].sort();
      DB.equipList = [...new Set(exercisesReal.flatMap(e => e.equipment_required))].sort();

      const details = await Promise.all(mems.map(m => API.getMember(m.id).catch(() => ({}))));
      const membersReal = mems.map((m, i) => mapMember(m, details[i]));
      await Promise.all(membersReal.map(async m => {
        try { const g = await API.memberGraph(m.id, 2); m.graphHealth.nodes = g.nodes.length; m.graphHealth.edges = g.edges.length; } catch (e) { /* leave zero */ }
      }));
      DB.members = membersReal;
      DB.memberById = Object.fromEntries(membersReal.map(m => [m.id, m]));

      if (settings) {
        DB.versions = {
          model: `${settings.llm.model} · ${settings.llm.provider}`,
          prompt: 'catalogue v1.0', retrieval: `hybrid top-k ${settings.retrieval.top_k}`,
          safety: `${settings.safety.level} ${settings.safety.version}`, schema: `graph ${settings.schema_version}`,
        };
        DB.settings = {
          ...DB.settings, provider: settings.llm.provider, model: settings.llm.model,
          temperature: settings.llm.temperature, maxTokens: settings.llm.max_tokens,
          topK: settings.retrieval.top_k, graphDepth: settings.retrieval.graph_depth, maxContextTokens: settings.retrieval.max_context_tokens,
          embModel: settings.embeddings.model, embDim: settings.embeddings.dimension,
          validatorMode: settings.validator.strict ? 'strict' : 'lenient', retryBudget: settings.validator.max_retries,
        };
      }
      if (prompts) {
        DB.prompts = prompts.map(p => ({
          id: 'tpl_' + p.id, name: p.id.charAt(0).toUpperCase() + p.id.slice(1).replace(/_/g, ' '),
          purpose: p.id, version: 'v' + p.version, hash: p.hash, edited: '—',
          vars: p.variables || [], schema: p.description, body: p.body,
        }));
      }
      if (schema) {
        DB.schemaNodes = schema.nodes.map(n => [n.type, n.description, (n.properties || []).map(pr => `${pr.name}:${pr.type}${pr.required ? ' pk' : ''}`), '—']);
        DB.schemaEdges = schema.edges.map(e => [e.type, e.source, e.target, e.cardinality, e.description]);
        DB.invariants = (schema.invariants || []).map(iv => ({ rule: iv.description, status: 'pass', count: 0 }));
      }
      if (safety) {
        DB.safetyPolicy = {
          ...DB.safetyPolicy, conservatism: safety.level,
          equipment: safety.require_equipment_match ? 'hard-exclude' : 'prefer-available',
          bilateral: safety.bilateral_rule, missingData: safety.unknown_data,
          fadeDays: safety.fade_resolved_injury_after_sessions,
        };
      }
      if (scenarios) {
        DB.scenarios = scenarios.map(s => ({ id: s.id, name: s.name, desc: s.request, metric: s.kind, expected: s.expected, status: 'idle' }));
      }
      if (metricsResp) {
        DB.realMetrics = metricsResp;
        if (metricsResp.stages && metricsResp.stages.length) {
          const nameMap = { route: 'Routing', retrieve: 'Retrieval', generate: 'Generation', validate: 'Validation', explain: 'Explain', log: 'Log', safety_review: 'Safety review', ingest: 'Ingest' };
          DB.latencyStages = metricsResp.stages.map(s => ({ stage: nameMap[s.stage] || s.stage, p50: s.p50_ms / 1000, p95: s.p95_ms / 1000, p99: s.p99_ms / 1000, budget: 2.0 }));
        }
      }
      DB.degraded = false;
    } catch (err) {
      DB.degraded = true;
      // eslint-disable-next-line no-console
      console.error('DB.init failed; using synthetic fallback data.', err);
    }
  }

  window.DB = {
    exercises, exById, byName, members, memberById, evalExerciseForMember, buildGraph, signalText,
    historyFor, versions, prompts, schemaNodes, schemaEdges, invariants, endpoints, settings,
    safetyPolicy, scenarios, metrics, costSeries, latencyStages, notifications, tradeoffs, sessions,
    maPrompts, M, J, P, E,
    init, _subgraphs: {}, degraded: false, realMetrics: null,
    muscleList: [...new Set(exercises.flatMap(e => e.muscle_groups))].sort(),
    jointList: [...new Set(exercises.flatMap(e => e.joints_loaded))].sort(),
    patternList: [...new Set(exercises.flatMap(e => e.movement_patterns))].sort(),
    equipList: [...new Set(exercises.flatMap(e => e.equipment_required))].sort(),
  };
})();
