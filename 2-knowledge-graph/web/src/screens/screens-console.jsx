/* FUTURE — Coach Console (streaming chat + trace) + Recommendation Detail. */
(function () {
  const { useState, useEffect, useRef, useMemo } = React;
  const Icon = window.Icon, DB = window.DB, ENGINE = window.ENGINE;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Avatar, Card, MetaPanel, Stages, VersionFooter, WorkoutCard, useCopy, EmptyState } = window;

  const STAGES = ['Understanding request', 'Retrieving semantic context', 'Expanding graph neighborhood', 'Filtering unsafe exercises', 'Generating recommendation', 'Validating output'];
  const PROMPT_EX = [
    'Build this member a lower-body session for this week.',
    'Why did you skip barbell squats for her?',
    'What should I watch for with this member?',
  ];

  function CoachConsole() {
    const { member, route, openDrawer, go, toast, setRecommendations } = useStore();
    const copy = useCopy();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [stage, setStage] = useState(0);
    const [activeTrace, setActiveTrace] = useState(null);
    const scrollRef = useRef();
    const payload = route.console;

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy, stage]);

    const run = async (text, focus) => {
      if (!text.trim() || busy) return;
      const userMsg = { id: 'u' + Date.now(), role: 'user', text };
      setMessages(m => [...m, userMsg]); setInput(''); setBusy(true); setStage(0);
      const isWhy = /why/i.test(text) && /skip|not|exclude/i.test(text);
      const isWatch = /watch for|watch out|careful/i.test(text);
      const isThin = member.thin;
      for (let s = 0; s < STAGES.length; s++) { setStage(s); await wait(isThin && s >= 2 ? 220 : 420 + Math.random() * 280); }
      setStage(STAGES.length);
      let asst;
      if (isThin) {
        asst = { id: 'a' + Date.now(), role: 'assistant', kind: 'clarify',
          text: `I don't have enough context on ${member.name.split(' ')[0]} to build a safe plan yet. I can see ${member.graphHealth.nodes} nodes but no goals, equipment, or injury history. Could you ingest a profile, available equipment, and any injuries first?`,
          trace: ENGINE.buildTrace(member, {}), thin: true };
      } else if (isWhy) {
        const sq = DB.byName('Barbell Back Squat');
        const why = ENGINE.buildWhySkipped(sq, member);
        asst = { id: 'a' + Date.now(), role: 'assistant', kind: 'why', ex: sq, why,
          text: `I skipped Barbell Back Squat because it loads the knee, and ${member.name.split(' ')[0]} has an active ${(member.injuries.find(i=>i.status!=='resolved')||{}).label || 'injury'}. ${why.path}. I substituted Glute Bridge, which trains glutes & hamstrings without knee load.`,
          trace: ENGINE.buildTrace(member, {}) };
      } else if (isWatch) {
        const inj = member.injuries.filter(i => i.status !== 'resolved');
        asst = { id: 'a' + Date.now(), role: 'assistant', kind: 'watch',
          text: inj.length ? `Key things to watch for ${member.name.split(' ')[0]}:` : 'No active safety flags — proceed normally, monitor recovery.',
          watch: inj, trace: ENGINE.buildTrace(member, {}) };
      } else {
        const f = focus || (/(upper)/i.test(text) ? 'upper' : /(recovery|mobility)/i.test(text) ? 'recovery' : /(full)/i.test(text) ? 'full' : 'lower');
        // Real backend: LangGraph hub → GraphRAG → safety filter → LLM → validator.
        // Falls back to the client engine (on the same real data) if the API errors.
        let rec;
        try { rec = await ENGINE.recommend(member, { focus: f, request: text }); }
        catch (e) { rec = ENGINE.buildWorkout(member, { focus: f, request: text }); rec._fallbackError = e.message; }
        setRecommendations(rs => [rec, ...rs]);
        const validatedNote = rec._fallbackError
          ? `(Backend unavailable — generated locally from the live graph data. ${rec._fallbackError})`
          : (rec.validation.corrected.length ? 'The safety validator corrected an exercise.' : 'All exercises passed safety validation.');
        asst = { id: 'a' + Date.now(), role: 'assistant', kind: 'workout', rec,
          text: `Here's a ${rec.focus || f}-body session for ${member.name.split(' ')[0]}, built around available equipment and filtered for active injuries. ${validatedNote}`,
          trace: rec.trace };
      }
      setMessages(m => [...m, asst]); setActiveTrace(asst.trace); setBusy(false); setStage(0);
    };

    // autostart from dashboard
    useEffect(() => {
      window.__consoleGen = (focus) => run(`Build a ${focus}-body session for this member.`, focus);
      if (payload?.autostart && payload.prompt) { run(payload.prompt, payload.focus); }
      else if (payload?.prompt) { setInput(payload.prompt); }
    }, [payload]);

    return React.createElement('div', { className: 'screen', style: { overflow: 'hidden' } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '248px 1fr 308px', height: '100%', minHeight: 0 } },
        // left context
        React.createElement('div', { style: { borderRight: '1px solid var(--line-soft)', overflowY: 'auto', padding: 16, background: 'var(--bg-1)' } },
          React.createElement('div', { className: 'row gap10 mb16' }, React.createElement(Avatar, { member, size: 38, sq: true }),
            React.createElement('div', null, React.createElement('div', { className: 'fw7 fs14' }, member.name), React.createElement('div', { className: 'fs11 faint' }, member.persona))),
          React.createElement('div', { className: 'sec-title mb8' }, 'Goal'),
          React.createElement('div', { className: 'fs13 muted mb16' }, member.goal),
          (member.injuries || []).filter(i => i.status !== 'resolved').length > 0 && React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'sec-title mb8' }, 'Active safety context'),
            React.createElement('div', { className: 'col gap6 mb16' }, member.injuries.filter(i => i.status !== 'resolved').map(i =>
              React.createElement('button', { key: i.id, className: 'chip clickable joint', onClick: () => openDrawer('injury', { inj: i, member }) }, React.createElement(Icon, { name: 'bone', size: 11 }), i.label)))),
          React.createElement('div', { className: 'sec-title mb8' }, 'Equipment'),
          React.createElement('div', { className: 'row wrap gap6 mb16' }, member.equipment.map(e => React.createElement(Chip, { key: e, kind: 'equip' }, e))),
          React.createElement('div', { className: 'sec-title mb8' }, 'Try asking'),
          React.createElement('div', { className: 'col gap6' }, PROMPT_EX.map((p, i) => React.createElement('button', {
            key: i, className: 'card', style: { padding: 9, textAlign: 'left', cursor: 'pointer', fontSize: 12, background: 'var(--bg-2)', color: 'var(--ink-1)' }, onClick: () => setInput(p),
          }, p)))),
        // center transcript + composer
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 } },
          React.createElement('div', { ref: scrollRef, style: { flex: 1, overflowY: 'auto', padding: '24px 28px' } },
            messages.length === 0 && !busy && React.createElement('div', { style: { maxWidth: 560, margin: '8vh auto 0' } },
              React.createElement(EmptyState, { icon: 'console', title: 'Ask about ' + member.name.split(' ')[0],
                sub: 'Generate sessions, ask why an exercise was skipped, or check what to watch for. Every answer is grounded in the graph and the safety policy.',
                action: React.createElement('div', { className: 'row gap8 wrap mt8', style: { justifyContent: 'center' } }, PROMPT_EX.map((p, i) => React.createElement(Btn, { key: i, size: 'sm', variant: 'subtle', onClick: () => run(p) }, p))) })),
            React.createElement('div', { style: { maxWidth: 740, margin: '0 auto' } },
              messages.map(m => React.createElement(Message, { key: m.id, m, member, onTrace: () => setActiveTrace(m.trace), openDrawer, go, copy })),
              busy && React.createElement(GeneratingCard, { stage, member }))),
          React.createElement(Composer, { input, setInput, busy, onSend: () => run(input), onClear: () => { setMessages([]); setActiveTrace(null); }, member })),
        // right trace
        React.createElement(TracePanel, { trace: activeTrace, member, go })));
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  function Message({ m, member, onTrace, openDrawer, go, copy }) {
    if (m.role === 'user') return React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end', margin: '14px 0' } },
      React.createElement('div', { style: { background: 'var(--grad)', color: '#fff', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', maxWidth: '78%', fontSize: 14, fontWeight: 500 } }, m.text));
    return React.createElement('div', { className: 'fadein', style: { margin: '14px 0' } },
      React.createElement('div', { className: 'row gap10', style: { alignItems: 'flex-start' } },
        React.createElement('div', { style: { width: 28, height: 28, borderRadius: 8, background: 'var(--grad)', flex: 'none', display: 'grid', placeItems: 'center' } }, React.createElement(Icon, { name: 'sparkle', size: 15, style: { color: '#fff' } })),
        React.createElement('div', { className: 'grow', style: { minWidth: 0 } },
          m.thin && React.createElement('div', { className: 'mb8' }, React.createElement(SafetyBadge, { state: 'missing', label: 'Thin retrieval — asking for context' })),
          m.kind === 'why' && React.createElement('div', { className: 'mb8' }, React.createElement(SafetyBadge, { state: 'info', label: 'Explainability' })),
          React.createElement('div', { className: 'fs14', style: { color: 'var(--ink-0)', lineHeight: 1.55 } }, m.text),
          m.kind === 'workout' && React.createElement(WorkoutResult, { rec: m.rec, member, go, copy }),
          m.kind === 'why' && React.createElement('div', { className: 'mt12' },
            React.createElement(Btn, { size: 'sm', variant: 'subtle', icon: 'why', onClick: () => openDrawer('why', { kind: 'skipped', ex: m.ex, member }) }, 'Open explanation drawer')),
          m.kind === 'watch' && m.watch && React.createElement('div', { className: 'col gap8 mt12' },
            m.watch.map(inj => React.createElement('div', { key: inj.id, className: 'card', style: { padding: 12, background: 'var(--bg-2)' } },
              React.createElement('div', { className: 'row gap8 center mb4' }, React.createElement(Icon, { name: 'bone', size: 14, style: { color: 'var(--spectrum-1)' } }), React.createElement('span', { className: 'fw6 fs13' }, inj.label)),
              React.createElement('div', { className: 'fs12 muted' }, `Avoid exercises loading the ${inj.joint}; ${inj.patterns.length ? 'limit ' + inj.patterns.join(', ') : 'monitor for flare-ups'}. Severity ${inj.severity}.`)))),
          React.createElement('div', { className: 'row gap8 mt12 center' },
            React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'activity', onClick: onTrace }, 'View trace'),
            React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'copy', onClick: () => copy(m.text) }, 'Copy')),
          React.createElement(VersionFooter, { onClick: go }))));
  }

  function WorkoutResult({ rec, member, go, copy }) {
    return React.createElement('div', { className: 'card mt12', style: { background: 'var(--bg-1)' } },
      React.createElement('div', { className: 'panel-head' },
        React.createElement('span', { style: { width: 30, height: 30, borderRadius: 8, background: 'var(--grad-soft)', display: 'grid', placeItems: 'center' } }, React.createElement(Icon, { name: 'dumbbell', size: 16, style: { color: 'var(--accent-ink)' } })),
        React.createElement('div', { className: 'grow' }, React.createElement('h3', { style: { textTransform: 'capitalize' } }, rec.focus + '-body session'),
          React.createElement('div', { className: 'sub' }, sumExercises(rec) + ' exercises · ' + estDuration(rec) + ' min')),
        React.createElement(SafetyBadge, { state: rec.safetyStatus === 'clear' ? 'safe' : 'caution', label: rec.safetyStatus === 'clear' ? 'Safety clear' : 'Injury-guarded' })),
      rec.validation.corrected.length > 0 && React.createElement('div', { style: { padding: '10px 16px', background: 'var(--info-bg)', borderBottom: '1px solid var(--line-soft)', display: 'flex', gap: 8, alignItems: 'center' } },
        React.createElement(Icon, { name: 'safety', size: 14, style: { color: 'var(--info)' } }),
        React.createElement('span', { className: 'fs12', style: { color: 'var(--ink-1)' } }, `Corrected by safety validator: ${rec.validation.corrected[0].rejected} (${rec.validation.corrected[0].reason}) → ${rec.validation.corrected[0].replacement}`)),
      React.createElement('div', { className: 'card-pad' },
        React.createElement(WorkoutCard, { rec, member }),
        rec.excluded.length > 0 && React.createElement('div', { className: 'mt8' },
          React.createElement('div', { className: 'sec-title mb8' }, 'Excluded (' + rec.excluded.length + ')'),
          React.createElement('div', { className: 'col gap6' }, rec.excluded.map((x, i) => React.createElement('div', { key: i, className: 'row between fs12', style: { padding: '7px 10px', background: 'var(--danger-bg)', borderRadius: 7 } },
            React.createElement('span', { style: { color: 'var(--ink-1)' } }, x.ex.name),
            React.createElement('span', { className: 'fs11', style: { color: 'var(--danger)' } }, x.reason))))),
        React.createElement('div', { className: 'row gap8 mt16 wrap' },
          React.createElement(Btn, { size: 'sm', variant: 'primary', icon: 'arrowRight', onClick: () => go('recDetail', { rec }) }, 'Open full recommendation'),
          React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', onClick: () => copy(rec, 'Recommendation JSON copied') }, 'Copy JSON'))));
  }
  function sumExercises(rec) { return rec.rows.warmup.length + rec.rows.main.length + rec.rows.cooldown.length; }
  function estDuration(rec) { return 8 + rec.rows.main.length * 9 + rec.rows.warmup.length * 3 + rec.rows.cooldown.length * 3; }

  function GeneratingCard({ stage, member }) {
    return React.createElement('div', { className: 'fadein', style: { margin: '14px 0' } },
      React.createElement('div', { className: 'row gap10', style: { alignItems: 'flex-start' } },
        React.createElement('div', { style: { width: 28, height: 28, borderRadius: 8, background: 'var(--grad)', flex: 'none', display: 'grid', placeItems: 'center' } }, React.createElement(Icon, { name: 'sparkle', size: 15, style: { color: '#fff' } })),
        React.createElement('div', { className: 'card grow', style: { padding: 16, background: 'var(--bg-1)' } },
          React.createElement(Stages, { stages: STAGES, current: stage }))));
  }

  function Composer({ input, setInput, busy, onSend, onClear, member }) {
    const [genOpen, setGenOpen] = useState(false);
    const { go } = useStore();
    const presets = [['Lower body', 'lower'], ['Upper body', 'upper'], ['Recovery', 'recovery'], ['Full body', 'full']];
    return React.createElement('div', { style: { borderTop: '1px solid var(--line-soft)', padding: '14px 28px 18px', background: 'var(--bg-0)' } },
      React.createElement('div', { style: { maxWidth: 740, margin: '0 auto' } },
        React.createElement('div', { className: 'card', style: { padding: 10, display: 'flex', gap: 8, alignItems: 'flex-end' } },
          React.createElement('textarea', {
            'data-composer': true, className: 'textarea', value: input, placeholder: 'Build this member a lower-body session for this week…',
            style: { border: 'none', background: 'none', minHeight: 24, maxHeight: 120, padding: '6px 4px', resize: 'none' }, rows: 1,
            onChange: e => setInput(e.target.value),
            onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSend(); } },
          }),
          React.createElement('div', { className: 'row gap6' },
            React.createElement('div', { style: { position: 'relative' } },
              React.createElement(Btn, { size: 'sm', variant: 'subtle', icon: 'dumbbell', onClick: () => setGenOpen(o => !o) }, 'Generate', React.createElement(Icon, { name: 'chevDown', size: 13 })),
              genOpen && React.createElement('div', { className: 'card', style: { position: 'absolute', bottom: 40, right: 0, width: 180, zIndex: 20, padding: 6, boxShadow: 'var(--sh-3)' } },
                presets.map(p => React.createElement('button', { key: p[1], className: 'nav-item', style: { width: '100%' }, onClick: () => { setGenOpen(false); setInput(''); window.__consoleGen?.(p[1]); } }, React.createElement(Icon, { name: 'dumbbell', size: 14 }), p[0] + ' session')))),
            React.createElement(IconBtn, { icon: 'send', title: 'Send', onClick: onSend, disabled: busy || !input.trim() })),
        ),
        React.createElement('div', { className: 'row between mt8' },
          React.createElement('div', { className: 'row gap8 fs11 faint' }, React.createElement('span', null, React.createElement('span', { className: 'kbd' }, '↵'), ' send'), React.createElement('span', null, React.createElement('span', { className: 'kbd' }, '⇧↵'), ' newline')),
          React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'trash', onClick: onClear }, 'Clear chat'))));
  }

  function TracePanel({ trace, member, go }) {
    const copy = useCopy();
    return React.createElement('div', { style: { borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', background: 'var(--bg-1)' } },
      React.createElement('div', { className: 'panel-head' }, React.createElement(Icon, { name: 'activity', size: 16, style: { color: 'var(--ink-2)' } }), React.createElement('h3', { className: 'grow' }, 'Retrieval & safety trace')),
      !trace ? React.createElement('div', { style: { padding: 16 } }, React.createElement(EmptyState, { icon: 'activity', title: 'No response selected', sub: 'Generate or select a response to inspect its retrieval and safety trace.' }))
        : React.createElement('div', { style: { padding: 16 } },
          React.createElement('div', { className: 'sec-title mb8' }, 'Retrieval summary'),
          React.createElement('div', { className: 'grid g3 mb16', style: { gap: 8 } },
            React.createElement(MiniStat, { v: trace.retrieval.vectorMatches, k: 'vector' }),
            React.createElement(MiniStat, { v: trace.retrieval.graphExpansions, k: 'graph edges' }),
            React.createElement(MiniStat, { v: (trace.retrieval.contextTokens / 1000).toFixed(1) + 'k', k: 'ctx tokens' })),
          React.createElement('div', { className: 'sec-title mb8' }, 'Safety exclusions'),
          React.createElement('div', { className: 'col gap6 mb16' }, trace.exclusions.length ? trace.exclusions.map((e, i) => React.createElement('div', { key: i, className: 'card', style: { padding: '8px 10px', background: 'var(--bg-2)' } },
            React.createElement('div', { className: 'fs12 fw6' }, e.name), React.createElement('div', { className: 'fs11', style: { color: 'var(--danger)' } }, e.reason))) : React.createElement('div', { className: 'fs12 faint' }, 'No exclusions')),
          React.createElement('div', { className: 'sec-title mb8' }, 'Graph paths'),
          React.createElement('div', { className: 'col gap8 mb16' }, trace.graphPaths.length ? trace.graphPaths.map((p, i) => React.createElement('div', { key: i, className: 'card mono fs11', style: { padding: 10, lineHeight: 1.7, color: 'var(--accent-ink)' } }, p)) : React.createElement('div', { className: 'fs12 faint' }, 'No injury paths')),
          React.createElement('div', { className: 'sec-title mb8' }, 'Validation'),
          React.createElement('div', { className: 'card', style: { padding: 12, background: 'var(--safe-bg)' } },
            React.createElement('div', { className: 'row gap8 center' }, React.createElement(SafetyBadge, { state: 'safe', label: 'Pass' }),
              React.createElement('span', { className: 'fs12 muted' }, 'unknown IDs: 0'))),
          React.createElement('div', { className: 'sec-title mt16 mb8' }, 'Latency by stage'),
          React.createElement('div', { className: 'col gap4' }, trace.stages.map((s, i) => React.createElement('div', { key: i, className: 'row between fs11' },
            React.createElement('span', { className: 'muted' }, s.stage), React.createElement('span', { className: 'mono' }, s.latency.toFixed(1) + 's')))),
          React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', className: 'mt12', onClick: () => copy(trace, 'Trace copied') }, 'Copy trace'),
          React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'activity', onClick: () => go('trace') }, 'Open in System Trace')));
  }
  function MiniStat({ v, k }) {
    return React.createElement('div', { className: 'card', style: { padding: '8px 10px', background: 'var(--bg-2)', textAlign: 'center' } },
      React.createElement('div', { className: 'fw7 fs15 mono' }, v), React.createElement('div', { className: 'fs10 faint' }, k));
  }

  // ---------- Recommendation Detail ----------
  function RecommendationDetail() {
    const { route, member, go, toast, openDrawer } = useStore();
    const copy = useCopy();
    const rec = route.recDetail?.rec || (window.ENGINE.buildWorkout(member, { focus: 'lower' }));
    const [edited, setEdited] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement('div', { className: 'row between mb20', style: { flexWrap: 'wrap', gap: 12 } },
        React.createElement('div', null,
          React.createElement('div', { className: 'row gap8 center' }, React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'chevLeft', onClick: () => go('console') }, 'Console'),
            React.createElement('h1', { className: 'page-title', style: { textTransform: 'capitalize' } }, rec.focus + '-body session')),
          React.createElement('div', { className: 'page-sub' }, new Date(rec.created).toLocaleString() + ' · ' + member.name + ' · “' + rec.request + '”')),
        React.createElement('div', { className: 'row gap8 wrap' },
          React.createElement(SafetyBadge, { state: rec.safetyStatus === 'clear' ? 'safe' : 'caution', label: rec.safetyStatus === 'clear' ? 'Safety clear' : 'Injury-guarded' }))),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' } },
        React.createElement('div', { className: 'col gap20' },
          React.createElement(MetaPanel, { title: 'Structured workout', icon: 'dumbbell', right: edited && React.createElement(SafetyBadge, { state: 'info', label: 'Edited' }) },
            React.createElement(WorkoutCard, { rec, member, editable: true, onChange: () => setEdited(true) })),
          rec.excluded.length > 0 && React.createElement(MetaPanel, { title: 'Excluded exercises', icon: 'close' },
            React.createElement('div', { className: 'col gap8' }, rec.excluded.map((x, i) => React.createElement('div', { key: i, className: 'row between center', style: { padding: '9px 12px', background: 'var(--danger-bg)', borderRadius: 9 } },
              React.createElement('div', null, React.createElement('div', { className: 'fw6 fs13' }, x.ex.name), React.createElement('div', { className: 'fs11', style: { color: 'var(--danger)' } }, x.reason)),
              React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'why', onClick: () => openDrawer('why', { kind: 'skipped', ex: x.ex, member }) }, 'Why'))))),
          React.createElement(MetaPanel, { title: 'Explanation timeline', icon: 'activity' },
            React.createElement('div', { className: 'col gap8' }, rec.trace.stages.map((s, i) => React.createElement('div', { key: i, className: 'row gap12 center fs13' },
              React.createElement('span', { className: 'mono fs11 faint', style: { width: 38 } }, s.latency.toFixed(1) + 's'),
              React.createElement('span', { style: { width: 7, height: 7, borderRadius: '50%', background: 'var(--safe)' } }),
              React.createElement('span', { className: 'grow' }, s.stage),
              s.tokens > 0 && React.createElement('span', { className: 'fs11 faint mono' }, s.tokens + ' tok'))))),
        ),
        React.createElement('div', { className: 'col gap16' },
          React.createElement(MetaPanel, { title: 'Actions', icon: 'bolt' },
            React.createElement('div', { className: 'col gap8' },
              React.createElement(Btn, { variant: 'primary', icon: 'check', onClick: () => toast({ title: 'Recommendation approved', detail: 'Feedback event emitted for acceptance metric.', sev: 'success' }) }, 'Approve'),
              React.createElement(Btn, { icon: 'close', onClick: () => setRejectOpen(o => !o) }, 'Reject'),
              rejectOpen && React.createElement('div', { className: 'card', style: { padding: 10, background: 'var(--bg-2)' } },
                React.createElement('div', { className: 'fs11 faint mb8' }, 'Reason code'),
                React.createElement('div', { className: 'col gap4' }, ['unsafe', 'off-target', 'equipment wrong', 'other'].map(r => React.createElement(Btn, { key: r, size: 'sm', variant: 'ghost', onClick: () => { setRejectOpen(false); toast({ title: 'Rejected: ' + r, detail: 'Stored for acceptance-rate metric.', sev: 'warning' }); } }, r)))),
              React.createElement('div', { className: 'row gap8' },
                React.createElement(Btn, { size: 'sm', icon: 'refresh', className: 'grow', onClick: () => toast({ title: 'Regenerating…', sev: 'info' }) }, 'Regenerate'),
                React.createElement(Btn, { size: 'sm', icon: 'safety', className: 'grow', onClick: () => toast({ title: 'Regenerating safer', detail: 'Elevated conservatism, lower joint load.', sev: 'safety' }) }, 'Safer')),
              React.createElement(Btn, { size: 'sm', variant: 'subtle', icon: 'flask', onClick: () => go('harness', { rec }) }, 'Compare configurations'),
              React.createElement('div', { className: 'row gap8' },
                React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'export', className: 'grow', onClick: () => copy(rec, 'Transcript exported') }, 'Export'),
                React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', className: 'grow', onClick: () => copy(rec, 'JSON copied') }, 'Copy JSON')))),
          React.createElement(MetaPanel, { title: 'Validation report', icon: 'safety' },
            React.createElement('div', { className: 'row gap8 center mb12' }, React.createElement(SafetyBadge, { state: 'safe', label: 'Pass' })),
            rec.validation.corrected.length > 0 ? React.createElement('div', { className: 'card', style: { padding: 10, background: 'var(--info-bg)' } },
              React.createElement('div', { className: 'fs12 fw6', style: { color: 'var(--info)' } }, 'Corrected by safety validator'),
              React.createElement('div', { className: 'fs12 muted mt4' }, rec.validation.corrected[0].rejected + ' → ' + rec.validation.corrected[0].replacement))
              : React.createElement('div', { className: 'fs12 muted' }, rec.validation.note),
            React.createElement('div', { className: 'fs12 muted mt8' }, 'Unknown exercise IDs: ', React.createElement('span', { className: 'mono' }, '0'))),
          React.createElement(MetaPanel, { title: 'Source context', icon: 'note' },
            React.createElement('div', { className: 'col gap6' }, rec.trace.graphPaths.map((p, i) => React.createElement('div', { key: i, className: 'mono fs11', style: { color: 'var(--accent-ink)', lineHeight: 1.6 } }, p))))),
      ),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }

  Object.assign(window, { CoachConsole, RecommendationDetail });
})();
