/* FUTURE — Multi-agent: Agent Console, StateGraph Topology, Memory Inspector, Routing Tests. */
(function () {
  const { useState, useEffect, useRef } = React;
  const Icon = window.Icon, DB = window.DB, ENGINE = window.ENGINE;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Card, MetaPanel, PageHead, Stat, Stages, EmptyState, ExChips, useCopy, VersionFooter } = window;

  const ROUTE_COLOR = { COACH: 'var(--spectrum-4)', WORKOUT_GENERATE: 'var(--spectrum-3)', WORKOUT_LOG: 'var(--spectrum-1)', CLARIFY: 'var(--caution)' };

  // ---------- Agent Console ----------
  function AgentConsole() {
    const { go, toast } = useStore();
    const copy = useCopy();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [lastRoute, setLastRoute] = useState(null);
    const scrollRef = useRef();
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);

    const run = async (text) => {
      if (!text.trim() || busy) return;
      setMessages(m => [...m, { id: 'u' + Date.now(), role: 'user', text }]); setInput(''); setBusy(true);
      const route = ENGINE.classify(text);
      setLastRoute(route);
      await new Promise(r => setTimeout(r, 700));
      let result;
      if (route.clarify) result = { kind: 'clarify', text: clarifyFor(text) };
      else if (route.route === 'COACH') result = { kind: 'coach', text: coachAnswer(text), matched: matchedExercises(text) };
      else if (route.route === 'WORKOUT_LOG') result = { kind: 'log', parsed: ENGINE.parseLog(text) };
      else { const search = inferSearch(text); const res = ENGINE.searchExercises(search); result = { kind: 'workout', search, results: res }; }
      setMessages(m => [...m, { id: 'a' + Date.now(), role: 'assistant', route, ...result }]); setBusy(false);
    };

    return React.createElement('div', { className: 'screen', style: { overflow: 'hidden' } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '230px 1fr 300px', height: '100%', minHeight: 0 } },
        // examples
        React.createElement('div', { style: { borderRight: '1px solid var(--line-soft)', overflowY: 'auto', padding: 16, background: 'var(--bg-1)' } },
          React.createElement('div', { className: 'row gap8 center mb16' }, React.createElement(Icon, { name: 'agent', size: 20, style: { color: 'var(--accent)' } }), React.createElement('span', { className: 'fw7 fs15' }, 'Multi-Agent Hub')),
          React.createElement('div', { className: 'sec-title mb8' }, 'Example prompts'),
          React.createElement('div', { className: 'col gap8' }, DB.maPrompts.map((p, i) => React.createElement('button', { key: i, className: 'card', style: { padding: 10, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-2)' }, onClick: () => run(p.text) },
            React.createElement('div', { className: 'fs11 fw7', style: { color: ROUTE_COLOR[p.route] } }, p.label),
            React.createElement('div', { className: 'fs12 muted mt4' }, p.text))))),
        // transcript
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', minWidth: 0 } },
          React.createElement('div', { ref: scrollRef, style: { flex: 1, overflowY: 'auto', padding: '24px 28px' } },
            messages.length === 0 && React.createElement('div', { style: { maxWidth: 520, margin: '10vh auto 0' } }, React.createElement(EmptyState, { icon: 'agent', title: 'Route a request', sub: 'The hub classifies each message and routes to the coach, workout generator, or logger sub-agent — with the parsed routing object on the right.' })),
            React.createElement('div', { style: { maxWidth: 720, margin: '0 auto' } },
              messages.map(m => React.createElement(MaMessage, { key: m.id, m, go, copy, toast })),
              busy && React.createElement('div', { className: 'fadein row gap10 mt12' }, React.createElement('div', { style: { width: 26, height: 26, borderRadius: 7, background: 'var(--grad)', display: 'grid', placeItems: 'center', flex: 'none' } }, React.createElement(Icon, { name: 'agent', size: 14, style: { color: '#fff' } })), React.createElement('div', { className: 'card grow', style: { padding: 12 } }, React.createElement(Stages, { stages: ['Classifying request', 'Routing to sub-agent', 'Executing tool calls', 'Composing response'], current: 2 }))))),
          React.createElement('div', { style: { borderTop: '1px solid var(--line-soft)', padding: '14px 28px 18px', background: 'var(--bg-0)' } },
            React.createElement('div', { style: { maxWidth: 720, margin: '0 auto' }, className: 'card row gap8', },
              React.createElement('input', { 'data-composer': true, className: 'input', value: input, placeholder: 'Ask anything — routing is automatic…', style: { border: 'none', background: 'none' }, onChange: e => setInput(e.target.value), onKeyDown: e => { if (e.key === 'Enter') run(input); } }),
              React.createElement(IconBtn, { icon: 'send', title: 'Send', onClick: () => run(input), disabled: busy }),
              React.createElement(IconBtn, { icon: 'trash', size: '', title: 'Clear', onClick: () => { setMessages([]); setLastRoute(null); } })))),
        // router panel
        React.createElement(RouterPanel, { route: lastRoute, go })));
  }

  function MaMessage({ m, go, copy, toast }) {
    if (m.role === 'user') return React.createElement('div', { className: 'row', style: { justifyContent: 'flex-end', margin: '14px 0' } },
      React.createElement('div', { style: { background: 'var(--grad)', color: '#fff', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', maxWidth: '78%', fontWeight: 500 } }, m.text));
    return React.createElement('div', { className: 'fadein', style: { margin: '14px 0' } },
      React.createElement('div', { className: 'row gap10', style: { alignItems: 'flex-start' } },
        React.createElement('div', { style: { width: 26, height: 26, borderRadius: 7, background: 'var(--grad)', display: 'grid', placeItems: 'center', flex: 'none' } }, React.createElement(Icon, { name: 'agent', size: 14, style: { color: '#fff' } })),
        React.createElement('div', { className: 'grow', style: { minWidth: 0 } },
          React.createElement('div', { className: 'mb8' }, React.createElement('span', { className: 'chip', style: { color: ROUTE_COLOR[m.route.route], fontWeight: 700 } }, m.route.route)),
          m.kind === 'clarify' && React.createElement('div', null, React.createElement(SafetyBadge, { state: 'caution', label: 'Clarification required' }), React.createElement('div', { className: 'fs14 mt8', style: { color: 'var(--ink-0)' } }, m.text)),
          m.kind === 'coach' && React.createElement(CoachAnswer, { m, go }),
          m.kind === 'log' && React.createElement(LoggerResult, { parsed: m.parsed, toast, copy }),
          m.kind === 'workout' && React.createElement(WorkoutGenResult, { search: m.search, results: m.results, go, copy, toast }),
          React.createElement(VersionFooter, { onClick: go }))));
  }
  function CoachAnswer({ m, go }) {
    return React.createElement('div', null,
      React.createElement('div', { className: 'fs14', style: { color: 'var(--ink-0)', lineHeight: 1.55 } }, m.text),
      m.matched.length > 0 && React.createElement('div', { className: 'card mt12', style: { padding: 12, background: 'var(--bg-2)' } },
        React.createElement('div', { className: 'sec-title mb8' }, 'Matched dataset exercises'),
        React.createElement('div', { className: 'col gap6' }, m.matched.map(e => React.createElement('button', { key: e.id, className: 'row between fs12', style: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', width: '100%' }, onClick: () => go('exerciseDetail', { id: e.id }) },
          React.createElement('span', { style: { color: 'var(--ink-1)' } }, e.name), React.createElement('span', { className: 'faint mono fs11' }, e.muscle_groups.slice(0, 2).join(', ')))))));
  }
  function LoggerResult({ parsed, toast, copy }) {
    const multi = parsed.candidates.length > 1;
    const [chosen, setChosen] = useState(parsed.matched);
    return React.createElement('div', { className: 'card', style: { padding: 14, background: 'var(--bg-1)' } },
      React.createElement('div', { className: 'fs12 faint mb8 mono' }, '"' + parsed.raw + '"'),
      multi && React.createElement('div', { className: 'card mb12', style: { padding: 10, background: 'var(--caution-bg)' } },
        React.createElement('div', { className: 'fs12 mb8', style: { color: 'var(--caution)' } }, 'Multiple matches — choose the intended exercise:'),
        React.createElement('div', { className: 'row wrap gap6' }, parsed.candidates.map(c => React.createElement(Chip, { key: c.id, onClick: () => setChosen(c), active: chosen?.id === c.id }, c.name)))),
      React.createElement('div', { className: 'grid g4', style: { gap: 10 } },
        React.createElement(LogField, { k: 'Exercise', v: chosen?.name || '—' }),
        React.createElement(LogField, { k: 'Sets', v: parsed.sets ?? '—' }),
        React.createElement(LogField, { k: 'Reps', v: parsed.reps ?? '—' }),
        React.createElement(LogField, { k: chosen && !chosen.supports_weight ? 'Weight (n/a)' : 'Weight', v: parsed.weight ? parsed.weight + ' ' + parsed.unit : (chosen && !chosen.supports_weight ? 'bodyweight' : 'null') })),
      React.createElement('div', { className: 'row gap8 center mt12' },
        React.createElement(SafetyBadge, { state: parsed.confidence > 0.8 ? 'safe' : 'caution', label: Math.round(parsed.confidence * 100) + '% match' }),
        parsed.missing.length > 0 && React.createElement('span', { className: 'fs12 faint' }, 'Missing: ' + parsed.missing.join(', ') + ' (left null, not invented)')),
      React.createElement('div', { className: 'row gap6 mt12' },
        React.createElement(Btn, { size: 'sm', variant: 'primary', icon: 'check', onClick: () => toast({ title: 'Log confirmed', detail: chosen?.name + ' added to history.', sev: 'success' }) }, 'Confirm log'),
        React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'edit', onClick: () => toast({ title: 'Edit log', sev: 'info' }) }, 'Edit'),
        React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', onClick: () => copy(parsed, 'Log JSON copied') }, 'Copy JSON')));
  }
  function LogField({ k, v }) { return React.createElement('div', { className: 'card', style: { padding: '8px 10px', background: 'var(--bg-2)' } }, React.createElement('div', { className: 'fs10 faint' }, k), React.createElement('div', { className: 'fw6 fs13 mt2' }, String(v))); }

  function WorkoutGenResult({ search, results, go, copy, toast }) {
    const none = results.length === 0;
    return React.createElement('div', { className: 'card', style: { padding: 14, background: 'var(--bg-1)' } },
      React.createElement('div', { className: 'sec-title mb8' }, 'Inferred search filters'),
      React.createElement('div', { className: 'row wrap gap6 mb12' },
        search.muscles.map(m => React.createElement(Chip, { key: m, kind: 'muscle' }, m)),
        search.equipment.map(e => React.createElement(Chip, { key: e, kind: 'equip' }, e)),
        search.patterns.map(p => React.createElement(Chip, { key: p, kind: 'pattern' }, p)),
        (!search.muscles.length && !search.equipment.length && !search.patterns.length) && React.createElement('span', { className: 'fs12 faint' }, 'none')),
      none ? React.createElement('div', { className: 'card', style: { padding: 14, background: 'var(--caution-bg)' } },
        React.createElement('div', { className: 'row gap8 center mb8' }, React.createElement(Icon, { name: 'warning', size: 15, style: { color: 'var(--caution)' } }), React.createElement('span', { className: 'fw6 fs13', style: { color: 'var(--ink-0)' } }, 'No matching exercises in the dataset')),
        React.createElement('div', { className: 'fs12 muted mb8' }, 'The dataset has no exercises requiring ' + search.equipment.join(' + ') + '. Recovery options:'),
        React.createElement('div', { className: 'row gap6 wrap' },
          React.createElement(Btn, { size: 'sm', variant: 'subtle', onClick: () => toast({ title: 'Switched to bodyweight', sev: 'info' }) }, 'Use bodyweight alternatives'),
          React.createElement(Btn, { size: 'sm', variant: 'ghost', onClick: () => toast({ title: 'Relaxing equipment filter', sev: 'info' }) }, 'Change equipment')))
        : React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'search_exercises → ' + results.length + ' results'),
          React.createElement('div', { className: 'col gap6' }, results.slice(0, 5).map(e => React.createElement('button', { key: e.id, className: 'row between center', style: { padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%' }, onClick: () => go('exerciseDetail', { id: e.id }) },
            React.createElement('span', { className: 'fw6 fs13' }, e.name), React.createElement(ExChips, { ex: e, show: ['muscle'] })))),
          React.createElement('div', { className: 'row gap6 mt12' },
            React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'refresh', onClick: () => toast({ title: 'Regenerating', sev: 'info' }) }, 'Regenerate'),
            React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', onClick: () => copy({ search, results: results.map(r => r.id) }, 'Tool result copied') }, 'Copy JSON'))));
  }

  function RouterPanel({ route, go }) {
    return React.createElement('div', { style: { borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', background: 'var(--bg-1)' } },
      React.createElement('div', { className: 'panel-head' }, React.createElement(Icon, { name: 'target', size: 16, style: { color: 'var(--ink-2)' } }), React.createElement('h3', { className: 'grow' }, 'Router decision')),
      React.createElement('div', { style: { padding: 16 } },
        !route ? React.createElement(EmptyState, { icon: 'target', title: 'No route yet', sub: 'Send a message to see the parsed routing object.' })
          : React.createElement('div', { className: 'col gap16' },
            React.createElement('div', { className: 'card', style: { padding: 14, background: 'var(--bg-2)' } },
              React.createElement('div', { className: 'fs11 faint mb4' }, 'Route selected'),
              React.createElement('div', { className: 'fw7 fs18', style: { color: ROUTE_COLOR[route.route] } }, route.route)),
            React.createElement('div', null, React.createElement('div', { className: 'row between fs12 mb6' }, React.createElement('span', { className: 'muted' }, 'Confidence'), React.createElement('span', { className: 'mono' }, Math.round(route.confidence * 100) + '%')),
              React.createElement('div', { style: { height: 8, borderRadius: 4, background: 'var(--bg-3)' } }, React.createElement('div', { style: { height: '100%', width: route.confidence * 100 + '%', background: route.confidence < 0.55 ? 'var(--caution)' : 'var(--grad)', borderRadius: 4 } })),
              route.confidence < 0.55 && React.createElement('div', { className: 'fs11 mt6', style: { color: 'var(--caution)' } }, 'Below 0.55 threshold → clarification triggered, not a guess.')),
            React.createElement('div', null, React.createElement('div', { className: 'sec-title mb6' }, 'Reasoning'), React.createElement('div', { className: 'fs12 muted' }, route.reasoning)),
            React.createElement('div', null, React.createElement('div', { className: 'sec-title mb6' }, 'StateGraph path'),
              React.createElement('div', { className: 'mono fs11', style: { color: 'var(--accent-ink)', lineHeight: 1.7 } }, 'entry → router → ' + (route.clarify ? 'clarify_node → END' : route.route.toLowerCase() + '_agent → validate → END'))),
            React.createElement('div', null, React.createElement('div', { className: 'sec-title mb6' }, 'Parsed routing object'),
              React.createElement('pre', { className: 'card mono', style: { padding: 10, fontSize: 11, background: 'var(--bg-0)', whiteSpace: 'pre-wrap', color: 'var(--ink-1)' } }, JSON.stringify({ route: route.route, confidence: route.confidence, needs_clarification: !!route.clarify }, null, 2))),
            React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'layers', onClick: () => go('topology') }, 'View StateGraph topology'))));
  }

  // ---------- StateGraph Topology ----------
  function StateGraphTopology() {
    const { toast, go } = useStore();
    const [hover, setHover] = useState(null);
    const nodes = [
      { id: 'entry', label: 'entry', x: 80, y: 200, kind: 'io' },
      { id: 'router', label: 'router', x: 240, y: 200, kind: 'hub' },
      { id: 'coach', label: 'coach_agent', x: 440, y: 90, kind: 'agent' },
      { id: 'gen', label: 'workout_generate', x: 440, y: 200, kind: 'agent' },
      { id: 'log', label: 'workout_log', x: 440, y: 310, kind: 'agent' },
      { id: 'clarify', label: 'clarify', x: 440, y: 400, kind: 'agent', err: false },
      { id: 'validate', label: 'validate', x: 660, y: 200, kind: 'hub' },
      { id: 'end', label: 'END', x: 820, y: 200, kind: 'io' },
    ];
    const edges = [['entry', 'router'], ['router', 'coach', 'COACH'], ['router', 'gen', 'WORKOUT_GENERATE'], ['router', 'log', 'WORKOUT_LOG'], ['router', 'clarify', 'conf<0.55'], ['coach', 'validate'], ['gen', 'validate'], ['log', 'validate'], ['validate', 'end'], ['clarify', 'end']];
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const kindColor = { io: 'var(--ink-3)', hub: 'var(--accent)', agent: 'var(--spectrum-3)' };
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'StateGraph Topology', sub: 'Hub graph + composed sub-agents · typed state, explicit edges' },
        React.createElement(Btn, { icon: 'activity', onClick: () => toast({ title: 'Tracing last request', detail: 'Path: entry → router → workout_generate → validate → END', sev: 'info' }) }, 'Trace last request')),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' } },
        React.createElement('div', { className: 'card', style: { padding: 16, overflowX: 'auto' } },
          React.createElement('svg', { viewBox: '0 0 920 460', style: { width: '100%', minWidth: 700 } },
            edges.map((e, i) => { const a = byId[e[0]], b = byId[e[1]]; const active = hover && (hover === e[0] || hover === e[1]);
              return React.createElement('g', { key: i },
                React.createElement('line', { x1: a.x + 50, y1: a.y, x2: b.x - 50, y2: b.y, stroke: active ? 'var(--accent)' : 'var(--line)', strokeWidth: active ? 2 : 1.2, markerEnd: 'url(#arrow)' }),
                e[2] && React.createElement('text', { x: (a.x + b.x) / 2 + 25, y: (a.y + b.y) / 2 - 5, fill: 'var(--ink-3)', fontSize: 10, fontFamily: 'JetBrains Mono', textAnchor: 'middle' }, e[2])); }),
            React.createElement('defs', null, React.createElement('marker', { id: 'arrow', markerWidth: 8, markerHeight: 8, refX: 6, refY: 3, orient: 'auto', markerUnits: 'strokeWidth' }, React.createElement('path', { d: 'M0,0 L6,3 L0,6', fill: 'var(--line)' }))),
            nodes.map(n => React.createElement('g', { key: n.id, onMouseEnter: () => setHover(n.id), onMouseLeave: () => setHover(null), style: { cursor: 'pointer' } },
              React.createElement('rect', { x: n.x - 50, y: n.y - 20, width: 100, height: 40, rx: n.kind === 'io' ? 20 : 9, fill: hover === n.id ? 'var(--bg-3)' : 'var(--bg-2)', stroke: kindColor[n.kind], strokeWidth: 1.5 }),
              React.createElement('text', { x: n.x, y: n.y + 4, fill: 'var(--ink-0)', fontSize: 11, fontFamily: 'JetBrains Mono', textAnchor: 'middle' }, n.label)))),
          React.createElement('div', { className: 'row gap16 mt12 fs11 faint' }, Object.entries(kindColor).map(([k, c]) => React.createElement('span', { key: k, className: 'row gap6 center' }, React.createElement('span', { style: { width: 10, height: 10, borderRadius: 3, border: '1.5px solid ' + c } }), k)))),
        React.createElement('div', { className: 'col gap16' },
          React.createElement(MetaPanel, { title: 'Typed state', icon: 'code' },
            React.createElement('pre', { className: 'mono fs11', style: { whiteSpace: 'pre-wrap', color: 'var(--ink-1)', lineHeight: 1.7 } }, 'class HubState(BaseModel):\n  message: str\n  member_id: str | None\n  route: Route | None\n  retrieved: list[Fact]\n  recommendation: Plan | None\n  validation: ValidationResult\n  memory: list[Turn]')),
          React.createElement(MetaPanel, { title: hover ? 'Node: ' + byId[hover].label : 'Hover a node', icon: 'layers' },
            hover ? React.createElement('div', { className: 'col gap6 fs12' },
              React.createElement('div', null, React.createElement('span', { className: 'faint' }, 'kind · '), byId[hover].kind),
              React.createElement('div', null, React.createElement('span', { className: 'faint' }, 'input keys · '), 'message, member_id'),
              React.createElement('div', null, React.createElement('span', { className: 'faint' }, 'output keys · '), 'route, recommendation'),
              React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'prompt', className: 'mt8', onClick: () => go('prompt') }, 'Open function / template'))
              : React.createElement('div', { className: 'fs12 faint' }, 'Hover or click a node to inspect its function reference, input/output keys, and edge conditions.')))),
    ));
  }

  // ---------- Memory Inspector ----------
  function MemoryInspector() {
    const { toast, go } = useStore();
    const copy = useCopy();
    const [turns, setTurns] = useState([
      { id: 1, role: 'user', text: 'Build me an upper body session.', route: 'WORKOUT_GENERATE', state: 'in-window', pinned: false },
      { id: 2, role: 'assistant', text: 'Generated 6-exercise upper session.', route: 'WORKOUT_GENERATE', state: 'in-window', pinned: false },
      { id: 3, role: 'user', text: 'Make the second one a pull instead.', route: 'WORKOUT_GENERATE', state: 'in-window', pinned: true },
      { id: 4, role: 'assistant', text: 'Swapped to Single-Arm Row.', route: 'WORKOUT_GENERATE', state: 'in-window', pinned: false },
      { id: 5, role: 'user', text: 'What muscles does that work?', route: 'COACH', state: 'summarized', pinned: false },
    ]);
    const inWindow = turns.filter(t => t.state === 'in-window').length;
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Memory Inspector', sub: 'Conversation memory window · what the next call actually sees' },
        React.createElement(Btn, { icon: 'export', onClick: () => copy(turns, 'Memory state exported') }, 'Export memory'),
        React.createElement(Btn, { icon: 'refresh', onClick: () => { setTurns(t => t.map(x => ({ ...x, state: 'in-window' }))); toast({ title: 'Memory reset — transcript preserved', sev: 'info' }); } }, 'Reset memory')),
      React.createElement('div', { className: 'row gap16 mb20' },
        React.createElement('div', { className: 'card grow', style: { padding: 14 } }, React.createElement(Stat, { v: inWindow + ' / ' + turns.length, k: 'Turns in window' })),
        React.createElement('div', { className: 'card grow', style: { padding: 14 } }, React.createElement(Stat, { v: '62%', k: 'Memory budget used' })),
        React.createElement('div', { className: 'card grow', style: { padding: 14 } }, React.createElement(Stat, { v: DB.settings.memWindow, k: 'Window size (turns)' }))),
      React.createElement('div', { className: 'col gap8' }, turns.map(t => React.createElement('div', { key: t.id, className: 'card', style: { padding: 12, opacity: t.state === 'summarized' ? .6 : 1, borderColor: t.pinned ? 'var(--accent)' : 'var(--line-soft)' } },
        React.createElement('div', { className: 'row gap10 center' },
          React.createElement('span', { className: 'chip', style: { fontSize: 10 } }, t.role),
          React.createElement('span', { className: 'fs13 grow' }, t.text),
          t.pinned && React.createElement(Icon, { name: 'pin', size: 13, style: { color: 'var(--accent)' } }),
          React.createElement('span', { className: `sb ${t.state === 'in-window' ? 'safe' : 'missing'}` }, t.state),
          React.createElement(IconBtn, { icon: 'pin', size: 'sm', title: 'Pin', onClick: () => setTurns(ts => ts.map(x => x.id === t.id ? { ...x, pinned: !x.pinned } : x)) }),
          React.createElement(IconBtn, { icon: 'trash', size: 'sm', title: 'Evict', onClick: () => { setTurns(ts => ts.map(x => x.id === t.id ? { ...x, state: 'evicted' } : x)); toast({ title: 'Turn evicted from memory', sev: 'warning' }); } })),
        t.state === 'summarized' && React.createElement('div', { className: 'fs11 faint mt8 mono' }, '↳ summarized: "user asked about muscle targets; answered quads/glutes"')))),
      React.createElement('div', { className: 'card mt16', style: { padding: 12, background: 'var(--info-bg)' } }, React.createElement('span', { className: 'fs12', style: { color: 'var(--ink-1)' } }, React.createElement(Icon, { name: 'info', size: 13, style: { color: 'var(--info)' } }), ' If a follow-up depends on an evicted turn, the degraded answer is shown alongside the eviction marker.'))));
  }

  // ---------- Routing Tests ----------
  function MaDemo() {
    const { toast, go } = useStore();
    const copy = useCopy();
    const [results, setResults] = useState(null);
    const [running, setRunning] = useState(false);
    const tests = DB.maPrompts.map(p => { const r = ENGINE.classify(p.text); return { ...p, actual: r.route, confidence: r.confidence, pass: r.route === p.route }; });
    const runAll = async () => { setRunning(true); setResults(null); await new Promise(r => setTimeout(r, 1100)); setResults(tests); setRunning(false); toast({ title: 'Routing tests complete', detail: tests.filter(t => t.pass).length + ' / ' + tests.length + ' pass', sev: 'success' }); };
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Routing Tests', sub: 'Critical-path tests for routing, tool use & graceful fallback' },
        React.createElement(Btn, { icon: 'copy', onClick: () => copy(tests, 'Transcript copied') }, 'Copy transcript'),
        React.createElement(Btn, { variant: 'primary', icon: 'play', onClick: runAll, disabled: running }, running ? 'Running…' : 'Run tests')),
      React.createElement('div', { className: 'card', style: { overflow: 'hidden' } },
        React.createElement('table', { className: 'tbl' }, React.createElement('thead', null, React.createElement('tr', null, ['', 'Prompt', 'Expected', 'Actual', 'Confidence', 'Result'].map(h => React.createElement('th', { key: h }, h)))),
          React.createElement('tbody', null, (results || tests).map((t, i) => React.createElement('tr', { key: i },
            React.createElement('td', null, React.createElement('span', { className: 'fs11 fw7', style: { color: 'var(--ink-3)' } }, t.label)),
            React.createElement('td', null, React.createElement('span', { className: 'name' }, t.text)),
            React.createElement('td', { className: 'mono fs11' }, t.route),
            React.createElement('td', { className: 'mono fs11', style: { color: t.pass ? 'var(--safe)' : 'var(--danger)' } }, t.actual),
            React.createElement('td', { className: 'mono fs12' }, Math.round(t.confidence * 100) + '%'),
            React.createElement('td', null, React.createElement(SafetyBadge, { state: t.pass ? 'safe' : 'excluded', label: t.pass ? 'Pass' : 'Fail' })))))),
      running && React.createElement('div', { className: 'card mt16', style: { padding: 16 } }, React.createElement(Stages, { stages: ['Loading prompts', 'Routing each', 'Checking fallback', 'Aggregating'], current: 2 })))));
  }

  // helpers
  function inferSearch(text) {
    const t = text.toLowerCase();
    const muscles = DB.muscleList.filter(m => t.includes(m));
    if (t.includes('upper')) muscles.push('chest', 'back', 'shoulders');
    if (t.includes('lower')) muscles.push('quads', 'glutes');
    const equipment = DB.equipList.filter(e => t.includes(e));
    if (t.includes('dumbbell')) equipment.push('dumbbell');
    const patterns = DB.patternList.filter(p => t.includes(p));
    return { muscles: [...new Set(muscles)], equipment: [...new Set(equipment)], patterns: [...new Set(patterns)] };
  }
  function coachAnswer(text) {
    const t = text.toLowerCase();
    if (t.includes('deadlift')) return 'A deadlift is a hip-hinge pattern that primarily trains the hamstrings, glutes, and back (erectors & lats), with the core stabilizing. In the dataset, Romanian Deadlift and Dumbbell RDL load the hip and lumbar spine — relevant if a member has lower-back flags.';
    return 'Grounded in the exercise dataset: this movement targets the listed muscle groups via its movement pattern. I only assert fields present in the dataset and flag anything outside it.';
  }
  function matchedExercises(text) {
    const t = text.toLowerCase();
    return DB.exercises.filter(e => e.name.toLowerCase().split(' ').some(w => w.length > 4 && t.includes(w))).slice(0, 3);
  }
  function clarifyFor(text) { return `“${text.trim()}” is ambiguous — did you want to log it, generate a workout with it, or ask about it? I won't guess. Tell me which and I'll route accordingly.`; }

  Object.assign(window, { AgentConsole, StateGraphTopology, MemoryInspector, MaDemo });
})();
