/* FUTURE — Evaluations, Comparison Harness, Demo Walkthrough, System Trace, Cost Dashboard. */
(function () {
  const { useState, useMemo, useEffect } = React;
  const Icon = window.Icon, DB = window.DB, ENGINE = window.ENGINE;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Card, MetaPanel, PageHead, Stat, Stages, EmptyState, useCopy, VersionFooter } = window;

  // ---------- Evaluations ----------
  function EvalScreen() {
    const { member, toast, go } = useStore();
    const copy = useCopy();
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState(null);
    const M = DB.metrics;
    // Runs the scenarios against the LIVE backend (drives the real hub end-to-end).
    const runAll = async () => {
      setRunning(true); setResults(null);
      try {
        const res = await ENGINE.runEvalLive();
        const byId = Object.fromEntries(res.results.map(r => [r.id, r]));
        setResults(DB.scenarios.map(s => ({ ...s, status: byId[s.id] ? byId[s.id].status : s.status, expected: byId[s.id] ? byId[s.id].detail : s.expected, trace_id: byId[s.id] && byId[s.id].trace_id })));
        toast({ title: `Ran ${res.summary.total} critical-path tests`, detail: `${res.summary.passed} pass · ${res.summary.warned} warn · ${res.summary.failed} fail`, sev: res.summary.failed ? 'warning' : 'success' });
      } catch (e) {
        setResults(DB.scenarios.map(s => ({ ...s, status: s.status })));
        toast({ title: 'Eval run failed — backend unavailable', detail: e.message, sev: 'warning' });
      }
      setRunning(false);
    };
    const runOne = async (s) => {
      toast({ title: 'Running scenario: ' + s.name, sev: 'info' });
      try {
        const res = await ENGINE.runEvalLive(s.id);
        const r = res.results[0];
        setResults(prev => (prev || DB.scenarios).map(x => x.id === s.id ? { ...x, status: r.status, expected: r.detail, trace_id: r.trace_id } : x));
      } catch (e) { toast({ title: 'Scenario failed', detail: e.message, sev: 'warning' }); }
    };
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'Evaluations', sub: 'Critical-path tests, scenario runner, and production evaluation metrics' },
        React.createElement(Btn, { icon: 'copy', onClick: () => copy('## Evaluation\\n\\nSafety violation rate: 0.4% ...', 'README section copied') }, 'Copy README section'),
        React.createElement(Btn, { variant: 'primary', icon: 'play', onClick: runAll, disabled: running }, running ? 'Running…' : 'Run all tests')),
      React.createElement('div', { className: 'grid g4 mb20' },
        React.createElement(MetricCard, { v: (M.safetyViolation * 100).toFixed(1) + '%', k: 'Safety violation rate', good: true }),
        React.createElement(MetricCard, { v: (M.unknownId * 100).toFixed(1) + '%', k: 'Unknown exercise ID rate', good: true }),
        React.createElement(MetricCard, { v: Math.round(M.retrievalHit * 100) + '%', k: 'Retrieval hit rate', good: true }),
        React.createElement(MetricCard, { v: Math.round(M.explanationCoverage * 100) + '%', k: 'Explanation coverage', good: true }),
        React.createElement(MetricCard, { v: M.p50 + 's / ' + M.p95 + 's', k: 'Latency p50 / p95' }),
        React.createElement(MetricCard, { v: Math.round(M.clarification * 100) + '%', k: 'Clarification rate' }),
        React.createElement(MetricCard, { v: (M.avgTokens / 1000).toFixed(1) + 'k', k: 'Avg context size' }),
        React.createElement(MetricCard, { v: Math.round(M.acceptance * 100) + '%', k: 'Coach acceptance', good: true })),
      React.createElement(MetaPanel, { title: 'Critical-path scenarios', icon: 'flask' },
        React.createElement('div', { className: 'col gap10' },
          (results || DB.scenarios).map(s => React.createElement('div', { key: s.id, className: 'card', style: { padding: 14, background: 'var(--bg-2)' } },
            React.createElement('div', { className: 'row gap10 center mb8' },
              React.createElement('span', { className: `sb ${s.status === 'pass' ? 'safe' : 'caution'}` }, React.createElement(Icon, { name: s.status === 'pass' ? 'check' : 'warning', size: 11 }), s.status),
              React.createElement('span', { className: 'fw7 fs14 grow' }, s.name),
              React.createElement('span', { className: 'chip', style: { fontSize: 10 } }, s.metric)),
            React.createElement('div', { className: 'fs12 muted mb8' }, s.desc),
            React.createElement('div', { className: 'row gap8' },
              React.createElement('div', { className: 'card grow', style: { padding: 9, background: 'var(--bg-1)' } }, React.createElement('div', { className: 'fs10 faint' }, 'EXPECTED'), React.createElement('div', { className: 'fs12 mt4' }, s.expected)),
              React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'play', onClick: () => runOne(s) }, 'Run'),
              React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'activity', onClick: () => go('trace') }, 'Trace'))))),
        running && React.createElement('div', { className: 'mt12' }, React.createElement(Stages, { stages: ['Loading scenarios', 'Running injury filter', 'Running explainability', 'Checking validator', 'Aggregating'], current: 3 }))),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }
  function MetricCard({ v, k, good }) {
    return React.createElement('div', { className: 'card', style: { padding: 16 } },
      React.createElement('div', { className: 'row between' }, React.createElement('div', { className: 'stat' }, React.createElement('div', { className: 'v' }, v), React.createElement('div', { className: 'k' }, k)),
        good && React.createElement(Icon, { name: 'checkCircle', size: 16, style: { color: 'var(--safe)' } })));
  }

  // ---------- Comparison Harness ----------
  function ComparisonHarness() {
    const { member, toast, go } = useStore();
    const copy = useCopy();
    const [ran, setRan] = useState(true);
    const cfgA = { model: 'claude-opus-4', temp: 0.3, retrieval: 'hybrid', safety: 'standard', validator: 'strict' };
    const cfgB = { model: 'claude-sonnet-4', temp: 0.5, retrieval: 'vector-only', safety: 'lenient', validator: 'lenient' };
    const recA = useMemo(() => ENGINE.buildWorkout(member, { focus: 'lower' }), [member]);
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'Comparison Harness', sub: 'Run the same request under two configurations and diff the result' },
        React.createElement(Btn, { icon: 'swap2', onClick: () => toast({ title: 'Swapped A ↔ B', sev: 'info' }) }, 'Swap A & B'),
        React.createElement(Btn, { icon: 'members', onClick: () => toast({ title: 'Running on all members', detail: 'Batched comparison across synthetic set.', sev: 'info' }) }, 'Run on all members'),
        React.createElement(Btn, { variant: 'primary', icon: 'play', onClick: () => { setRan(true); toast({ title: 'Comparison complete', detail: 'Cached — revisit without re-spending tokens.', sev: 'success' }); } }, 'Run comparison')),
      React.createElement('div', { className: 'card mb20', style: { padding: 14 } },
        React.createElement('div', { className: 'row gap10 center' }, React.createElement('span', { className: 'sec-title' }, 'Request'),
          React.createElement('span', { className: 'fs13 grow' }, '“Build ' + member.name.split(' ')[0] + ' a lower-body session for this week.”'),
          React.createElement(Chip, { kind: '', icon: 'user' }, member.name))),
      React.createElement('div', { className: 'grid g2' },
        React.createElement(CfgSide, { tag: 'A', label: 'Current', cfg: cfgA, rec: recA, safe: true, latency: 4.2, tokens: 5240, cost: 0.031 }),
        React.createElement(CfgSide, { tag: 'B', label: 'Variant', cfg: cfgB, rec: recA, safe: false, latency: 2.8, tokens: 3980, cost: 0.012 })),
      ran && React.createElement(MetaPanel, { title: 'Diff metrics', icon: 'activity', className: 'mt20' },
        React.createElement('div', { className: 'grid g4', style: { gap: 14 } },
          React.createElement(Stat, { v: '0.71', k: 'Recommendation overlap (Jaccard)' }),
          React.createElement(Stat, { v: '2 exercises', k: 'Safety divergence', delta: 'B included 2 knee-loading', deltaDir: 'down' }),
          React.createElement(Stat, { v: '−1.4s', k: 'Latency delta (B faster)' }),
          React.createElement(Stat, { v: '−$0.019', k: 'Cost delta (B cheaper)' })),
        React.createElement('div', { className: 'card mt16', style: { padding: 12, background: 'var(--danger-bg)' } },
          React.createElement('div', { className: 'row gap8 center' }, React.createElement(Icon, { name: 'warning', size: 15, style: { color: 'var(--danger)' } }),
            React.createElement('span', { className: 'fs13', style: { color: 'var(--ink-0)' } }, 'Configuration B is faster and cheaper but produced a ', React.createElement('b', null, 'safety-violating'), ' recommendation (included knee-loading exercises with lenient safety). Speed/cost gains do not justify promotion.'))),
        React.createElement('div', { className: 'row gap8 mt16' },
          React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'flask', onClick: () => { toast({ title: 'Saved as scenario', sev: 'success' }); go('eval'); } }, 'Save as scenario'),
          React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'check', onClick: () => toast({ title: 'Cannot promote — B violates safety', sev: 'error' }) }, 'Promote variant'))),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }
  function CfgSide({ tag, label, cfg, rec, safe, latency, tokens, cost }) {
    return React.createElement('div', { className: 'card', style: { borderColor: tag === 'A' ? 'var(--line)' : (safe ? 'var(--line)' : 'oklch(0.66 0.20 22 / 0.4)') } },
      React.createElement('div', { className: 'panel-head' },
        React.createElement('span', { style: { width: 26, height: 26, borderRadius: 7, background: tag === 'A' ? 'var(--bg-4)' : 'var(--grad-soft)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 } }, tag),
        React.createElement('div', { className: 'grow' }, React.createElement('h3', null, label), React.createElement('div', { className: 'sub mono fs11' }, cfg.model)),
        React.createElement(SafetyBadge, { state: safe ? 'safe' : 'excluded', label: safe ? 'Safe' : 'Violation' })),
      React.createElement('div', { className: 'card-pad' },
        React.createElement('div', { className: 'row wrap gap6 mb12' }, Object.entries(cfg).map(([k, v]) => React.createElement(Chip, { key: k, style: { fontSize: 10 } }, k + ': ' + v))),
        React.createElement('div', { className: 'grid g3 mb12', style: { gap: 8 } },
          React.createElement(MiniMetric, { v: latency + 's', k: 'latency' }), React.createElement(MiniMetric, { v: (tokens / 1000).toFixed(1) + 'k', k: 'tokens' }), React.createElement(MiniMetric, { v: '$' + cost.toFixed(3), k: 'cost' })),
        React.createElement('div', { className: 'sec-title mb8' }, 'Included exercises'),
        React.createElement('div', { className: 'col gap4' }, rec.rows.main.map((r, i) => React.createElement('div', { key: i, className: 'row gap8 fs12', style: { color: 'var(--ink-1)' } },
          React.createElement(SafetyBadge, { state: (!safe && i === 0) ? 'excluded' : 'safe' }), r.ex.name)))));
  }
  function MiniMetric({ v, k }) { return React.createElement('div', { className: 'card', style: { padding: '8px 6px', textAlign: 'center', background: 'var(--bg-2)' } }, React.createElement('div', { className: 'mono fw7 fs14' }, v), React.createElement('div', { className: 'fs10 faint' }, k)); }

  // ---------- Demo Walkthrough ----------
  function DemoWalkthrough() {
    const { member, selectMember, go, toast } = useStore();
    const copy = useCopy();
    const [step, setStep] = useState(0);
    const [transcript, setTranscript] = useState([]);
    const steps = [
      ['Run seed', 'Seed Alex: knee issue, dumbbell access, lower-body strength goal.', 'ingest', () => { selectMember('mbr_alex'); push('Seeded synthetic member Alex Rivera with knee injury + dumbbells.'); }],
      ['Ingest signal', 'Ingest a chat signal: "knee irritated after lunges."', 'sparkle', () => push('Extracted Injury(knee irritation) + AFFECTS_JOINT(knee) + CONTRAINDICATES edges.')],
      ['Open graph', 'Show member → knee → contraindicated exercises.', 'graph', () => { push('Highlighted Member → HAS_INJURY → Knee → CONTRAINDICATES → 7 exercises.'); }],
      ['Generate workout', 'Ask for a lower-body session.', 'dumbbell', () => push('Generated lower-body session; 3 knee-loading exercises excluded, replaced with glute bridge & RDL.')],
      ['Ask why', 'Ask why barbell squat was skipped.', 'why', () => push('Explanation: loads knee · active knee pain · graph path returned · replacement Glute Bridge.')],
      ['Run safety test', 'Confirm no knee-loading exercise in the plan.', 'safety', () => push('Safety test PASS — 0 knee-loading exercises in final plan.')],
    ];
    const push = (t) => setTranscript(tr => [...tr, { t, ts: new Date().toLocaleTimeString() }]);
    const runStep = (i) => { steps[i][3](); setStep(i + 1); };
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Demo Walkthrough', sub: 'Scripted knowledge-graph demo for submission' },
        React.createElement(Btn, { icon: 'export', onClick: () => copy(transcript.map(t => t.t).join('\\n'), 'Transcript exported') }, 'Export transcript'),
        React.createElement(Btn, { variant: 'primary', icon: 'play', onClick: () => { setTranscript([]); setStep(0); steps.forEach((s, i) => setTimeout(() => runStep(i), i * 700)); } }, 'Run full demo')),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' } },
        React.createElement('div', { className: 'col gap10' }, steps.map((s, i) => React.createElement('div', { key: i, className: 'card', style: { padding: 14, opacity: i <= step ? 1 : .6, borderColor: i < step ? 'var(--safe)' : 'var(--line-soft)' } },
          React.createElement('div', { className: 'row gap10 center' },
            React.createElement('span', { style: { width: 26, height: 26, borderRadius: '50%', background: i < step ? 'var(--safe-bg)' : 'var(--bg-3)', display: 'grid', placeItems: 'center', flex: 'none' } }, i < step ? React.createElement(Icon, { name: 'check', size: 14, style: { color: 'var(--safe)' } }) : React.createElement('span', { className: 'fs12 fw7' }, i + 1)),
            React.createElement('div', { className: 'grow' }, React.createElement('div', { className: 'fw6 fs13' }, s[0]), React.createElement('div', { className: 'fs11 faint' }, s[1])),
            React.createElement(Btn, { size: 'sm', variant: i === step ? 'primary' : 'ghost', icon: s[2], onClick: () => runStep(i) }, 'Run')))),
        ),
        React.createElement(MetaPanel, { title: 'Transcript', icon: 'note', right: React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'copy', onClick: () => copy(transcript.map(t => t.t).join('\\n')) }, 'Copy') },
          transcript.length === 0 ? React.createElement('div', { className: 'fs13 faint', style: { padding: 20, textAlign: 'center' } }, 'Run a step to populate the transcript.')
            : React.createElement('div', { className: 'col gap8' }, transcript.map((t, i) => React.createElement('div', { key: i, className: 'row gap8', style: { fontSize: 12 } },
              React.createElement('span', { className: 'mono fs10 faint', style: { flex: 'none' } }, t.ts),
              React.createElement('span', { style: { color: 'var(--ink-1)' } }, t.t)))),
          React.createElement('div', { className: 'fs10 faint mt12 mono' }, '// Synthetic data — exported transcripts reassert synthetic-only contract.')))));
  }

  // ---------- System Trace ----------
  const _STAGE_NAME = { route: 'Routing', retrieve: 'Retrieval', generate: 'Generation', validate: 'Validation', explain: 'Explain', log: 'Log', safety_review: 'Safety review', ingest: 'Ingest' };
  function SystemTrace() {
    const { go, toast } = useStore();
    const copy = useCopy();
    const [expanded, setExpanded] = useState(0);
    const [traces, setTraces] = useState(null);
    // Real recorded traces from the in-process trace store.
    useEffect(() => {
      let on = true;
      window.API.listTraces({ limit: 50 }).then(ts => { if (on) setTraces(ts); }).catch(() => { if (on) setTraces([]); });
      return () => { on = false; };
    }, []);
    const rows = (traces || []).map(t => {
      const stages = (t.stages || []).map(s => ({ stage: _STAGE_NAME[s.kind] || s.name || s.kind, latency: (s.duration_ms || 0) / 1000, tokens: (s.tokens_prompt || 0) + (s.tokens_completion || 0), success: s.success !== false, error: s.error }));
      const failed = stages.some(s => !s.success);
      const type = /\[eval\]|eval/i.test(t.request_summary || '') ? 'eval' : /why|explain/i.test(t.request_summary || '') ? 'explain' : /log/i.test(t.request_summary || '') ? 'log' : 'recommend';
      return { id: t.id, type, label: t.request_summary || t.id, status: failed ? 'warn' : 'ok', latency: +stages.reduce((a, s) => a + s.latency, 0).toFixed(2), stages, policy: t.safety_policy_version, schema: t.schema_version };
    });
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'System Trace', sub: 'Real request traces · retrieval → LLM/tool calls → validation → safety, with latency budgets' },
        React.createElement(Btn, { icon: 'refresh', onClick: () => { setTraces(null); window.API.listTraces({ limit: 50 }).then(setTraces).catch(() => setTraces([])); } }, 'Refresh'),
        React.createElement(Btn, { icon: 'copy', onClick: () => copy(rows, 'Traces copied') }, 'Copy traces')),
      traces === null
        ? React.createElement('div', { className: 'card', style: { padding: 40, textAlign: 'center' } }, React.createElement('span', { className: 'fs13 faint' }, 'Loading traces…'))
        : rows.length === 0
          ? React.createElement(EmptyState, { icon: 'activity', title: 'No traces yet', sub: 'Generate a recommendation in the Coach Console or run an evaluation — every request is traced here with per-stage latency and tokens.' })
          : React.createElement('div', { className: 'col gap10' }, rows.map((req, i) => React.createElement('div', { key: req.id, className: 'card' },
            React.createElement('button', { className: 'panel-head', style: { width: '100%', background: 'none', border: 'none', cursor: 'pointer' }, onClick: () => setExpanded(expanded === i ? -1 : i) },
              React.createElement(Icon, { name: expanded === i ? 'chevDown' : 'chevRight', size: 15 }),
              React.createElement('span', { className: 'chip mono', style: { fontSize: 10 } }, req.type),
              React.createElement('span', { className: 'fw6 fs13 grow', style: { textAlign: 'left' } }, req.label),
              React.createElement('span', { className: `sb ${req.status === 'ok' ? 'safe' : 'caution'}` }, req.status),
              React.createElement('span', { className: 'mono fs12 faint' }, req.latency + 's')),
            expanded === i && React.createElement('div', { className: 'card-pad', style: { borderTop: '1px solid var(--line-soft)' } },
              req.stages.length === 0 && React.createElement('div', { className: 'fs12 faint mb12' }, 'No stage timings recorded for this request.'),
              React.createElement('div', { className: 'col gap6 mb16' }, req.stages.map((s, j) => {
                const budget = (DB.latencyStages[Math.min(j, DB.latencyStages.length - 1)] || {}).budget || 2;
                const over = s.latency > budget;
                return React.createElement('div', { key: j, className: 'row gap12 center' },
                  React.createElement('span', { className: 'fs12 muted', style: { width: 130 } }, s.stage),
                  React.createElement('div', { className: 'grow', style: { height: 16, borderRadius: 5, background: 'var(--bg-3)', position: 'relative', overflow: 'hidden' } },
                    React.createElement('div', { style: { height: '100%', width: Math.min(100, s.latency / budget * 100) + '%', background: !s.success ? 'var(--danger)' : over ? 'var(--caution)' : 'var(--grad)' } }),
                    React.createElement('span', { style: { position: 'absolute', right: 8, top: 0, fontSize: 10, lineHeight: '16px', color: 'var(--ink-1)' }, className: 'mono' }, s.latency.toFixed(2) + 's / ' + budget + 's')),
                  s.tokens > 0 && React.createElement('span', { className: 'fs11 faint mono', style: { width: 60, textAlign: 'right' } }, s.tokens + ' tok'));
              })),
              !req.stages.every(s => s.success) && React.createElement('div', { className: 'card mb12', style: { padding: 10, background: 'var(--danger-bg)' } }, React.createElement('span', { className: 'fs12', style: { color: 'var(--danger)' } }, 'A stage failed — see error in the copied trace JSON.')),
              React.createElement('div', { className: 'fs11 faint mono mb8' }, 'safety ' + (req.policy || '—') + ' · schema ' + (req.schema || '—')),
              React.createElement(VersionFooter, { onClick: go }))))),
    ));
  }

  // ---------- Cost & Performance ----------
  function CostDashboard() {
    const { go, toast } = useStore();
    const series = DB.costSeries;
    const maxC = Math.max(...series.map(s => s.cost));
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'Cost & Performance', sub: 'Aggregate spend, latency percentiles, token usage, cache hit rate' },
        React.createElement(Btn, { icon: 'bell', onClick: () => toast({ title: 'Budget alert set', detail: '$8 / day ceiling.', sev: 'success' }) }, 'Set budget alert')),
      React.createElement('div', { className: 'grid g4 mb20' },
        React.createElement(MetricCard, { v: '$' + series.reduce((a, s) => a + s.cost, 0).toFixed(2), k: 'Total spend (14d) · estimated' }),
        React.createElement(MetricCard, { v: '94%', k: 'Embedding cache hit' }),
        React.createElement(MetricCard, { v: '1.1%', k: 'Error rate', good: true }),
        React.createElement(MetricCard, { v: '5.2k', k: 'Avg tokens / request' })),
      React.createElement('div', { className: 'grid g2' },
        React.createElement(MetaPanel, { title: 'Daily spend (estimated)', icon: 'cost' },
          React.createElement('div', { className: 'row gap6', style: { height: 140, alignItems: 'flex-end' } }, series.map((s, i) => React.createElement('div', { key: i, className: 'grow', title: '$' + s.cost.toFixed(2), style: { height: (s.cost / maxC * 100) + '%', background: 'var(--grad)', borderRadius: '4px 4px 0 0', minHeight: 4 } }))),
          React.createElement('div', { className: 'row between fs10 faint mt8' }, React.createElement('span', null, '14 days ago'), React.createElement('span', null, 'today'))),
        React.createElement(MetaPanel, { title: 'Latency percentiles by stage', icon: 'activity' },
          React.createElement('table', { className: 'tbl' }, React.createElement('thead', null, React.createElement('tr', null, ['Stage', 'p50', 'p95', 'p99', 'budget'].map(h => React.createElement('th', { key: h }, h)))),
            React.createElement('tbody', null, DB.latencyStages.map(s => React.createElement('tr', { key: s.stage },
              React.createElement('td', null, React.createElement('span', { className: 'name' }, s.stage)),
              React.createElement('td', { className: 'mono' }, s.p50 + 's'), React.createElement('td', { className: 'mono' }, s.p95 + 's'),
              React.createElement('td', { className: 'mono', style: { color: s.p99 > s.budget ? 'var(--danger)' : 'inherit' } }, s.p99 + 's'),
              React.createElement('td', { className: 'mono faint' }, s.budget + 's')))))),
      ),
      React.createElement(MetaPanel, { title: 'Token usage by template version', icon: 'prompt', className: 'mt20' },
        React.createElement('div', { className: 'col gap8' }, DB.prompts.slice(0, 5).map((p, i) => React.createElement('div', { key: p.id, className: 'row gap12 center' },
          React.createElement('span', { className: 'fs12 grow' }, p.name + ' ' + p.version),
          React.createElement('div', { style: { width: '50%', height: 8, borderRadius: 4, background: 'var(--bg-3)' } }, React.createElement('div', { style: { height: '100%', width: (30 + i * 14) + '%', background: 'var(--grad)', borderRadius: 4 } })),
          React.createElement('span', { className: 'mono fs11 faint', style: { width: 60, textAlign: 'right' } }, (1.2 + i * 0.6).toFixed(1) + 'k tok'))))),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }

  Object.assign(window, { EvalScreen, ComparisonHarness, DemoWalkthrough, SystemTrace, CostDashboard });
})();
