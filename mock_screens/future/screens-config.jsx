/* FUTURE — Schema Reference, Prompt Inspector, Safety Policy, API Explorer, Settings, Tradeoffs. */
(function () {
  const { useState } = React;
  const Icon = window.Icon, DB = window.DB;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Card, MetaPanel, PageHead, Field, Tabs, useCopy, VersionFooter } = window;
  const C = window.GRAPH_TYPE_COLORS || {};

  // ---------- Schema & Ontology ----------
  function SchemaReference() {
    const { go, toast } = useStore();
    const copy = useCopy();
    const [tab, setTab] = useState('nodes');
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'Schema & Ontology', sub: 'Canonical reference · node types, edge types, constraints, ontology mappings' },
        React.createElement(Btn, { icon: 'safety', onClick: () => toast({ title: 'Invariants checked', detail: '3 of 4 pass · 1 warning (missing joint data)', sev: 'warning' }) }, 'Check invariants'),
        React.createElement(Btn, { icon: 'copy', onClick: () => copy(DB.schemaNodes, 'Schema copied') }, 'Copy schema')),
      React.createElement('div', { style: { maxWidth: 400, marginBottom: 18 } }, React.createElement(Tabs, { tabs: [{ id: 'nodes', label: 'Node types', count: DB.schemaNodes.length }, { id: 'edges', label: 'Edge types', count: DB.schemaEdges.length }, { id: 'invariants', label: 'Invariants' }], value: tab, onChange: setTab })),
      tab === 'nodes' && React.createElement('div', { className: 'grid g2' }, DB.schemaNodes.map(n => React.createElement('div', { key: n[0], className: 'card', style: { padding: 16 } },
        React.createElement('div', { className: 'row gap8 center mb8' }, React.createElement('span', { style: { width: 11, height: 11, borderRadius: '50%', background: C[n[0]] || '#888' } }),
          React.createElement('span', { className: 'fw7 fs15' }, n[0]), React.createElement('div', { className: 'grow' }), React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'graph', onClick: () => go('graph') }, 'Open')),
        React.createElement('div', { className: 'fs12 muted mb12' }, n[1]),
        React.createElement('div', { className: 'col gap4 mb8' }, n[2].map((p, i) => React.createElement('div', { key: i, className: 'mono fs11', style: { color: 'var(--ink-1)' } }, '· ' + p))),
        React.createElement('div', { className: 'fs11 faint mono' }, 'e.g. ', React.createElement('span', { style: { color: 'var(--accent-ink)' } }, n[3]))))),
      tab === 'edges' && React.createElement('div', { className: 'card', style: { overflow: 'hidden' } },
        React.createElement('table', { className: 'tbl' }, React.createElement('thead', null, React.createElement('tr', null, ['Edge', 'Source → Target', 'Cardinality', 'Meaning'].map(h => React.createElement('th', { key: h }, h)))),
          React.createElement('tbody', null, DB.schemaEdges.map(e => React.createElement('tr', { key: e[0] },
            React.createElement('td', null, React.createElement('span', { className: 'mono fw6', style: { color: 'var(--accent)' } }, e[0])),
            React.createElement('td', { className: 'mono fs12' }, e[1] + ' → ' + e[2]),
            React.createElement('td', { className: 'mono fs12 faint' }, e[3]),
            React.createElement('td', { className: 'fs12' }, e[4]))))),
      tab === 'invariants' && React.createElement('div', { className: 'col gap10' }, DB.invariants.map((iv, i) => React.createElement('div', { key: i, className: 'card', style: { padding: 14 } },
        React.createElement('div', { className: 'row gap10 center' },
          React.createElement('span', { className: `sb ${iv.status === 'pass' ? 'safe' : 'caution'}` }, React.createElement(Icon, { name: iv.status === 'pass' ? 'check' : 'warning', size: 11 }), iv.status),
          React.createElement('span', { className: 'fs13 grow' }, iv.rule),
          iv.count > 0 && React.createElement('button', { className: 'link fs12', onClick: () => go('graph') }, iv.count + ' violations →'))))),
      React.createElement('div', { className: 'card mt20', style: { padding: 16 } },
        React.createElement('div', { className: 'sec-title mb8' }, 'Ontology mappings'),
        React.createElement('div', { className: 'fs13 muted' }, 'Joint nodes align to FMA (Foundational Model of Anatomy) concepts; Injury nodes map to SNOMED CT where available. Mapping is documented and read-only — schema changes happen via code migrations, not the UI.')),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go })))));
  }

  // ---------- Prompt Inspector ----------
  function PromptInspector() {
    const { go, toast } = useStore();
    const copy = useCopy();
    const [sel, setSel] = useState(DB.prompts[1]);
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'Prompt Inspector', sub: 'Templates are first-class & versioned · edits create new versions' }),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' } },
        React.createElement('div', { className: 'col gap6' }, DB.prompts.map(p => React.createElement('button', {
          key: p.id, className: 'card', style: { padding: 12, textAlign: 'left', cursor: 'pointer', outline: sel.id === p.id ? '1.5px solid var(--accent)' : 'none', background: 'var(--bg-2)' }, onClick: () => setSel(p),
        },
          React.createElement('div', { className: 'row between' }, React.createElement('span', { className: 'fw6 fs13' }, p.name), React.createElement('span', { className: 'chip mono', style: { fontSize: 10 } }, p.version)),
          React.createElement('div', { className: 'fs11 faint mt4' }, p.purpose + ' · ' + p.hash)))),
        React.createElement('div', { className: 'col gap16' },
          React.createElement(MetaPanel, { title: sel.name + ' · ' + sel.version, icon: 'prompt', right: React.createElement('div', { className: 'row gap6' },
            React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'sessions', onClick: () => toast({ title: 'Version history', detail: 'Rollback available.', sev: 'info' }) }, 'History'),
            React.createElement(Btn, { size: 'sm', icon: 'edit', onClick: () => toast({ title: 'Editing creates a new version', detail: 'Active version is never mutated.', sev: 'info' }) }, 'Edit template')) },
            React.createElement('div', { className: 'row gap16 mb12 fs12 faint' }, React.createElement('span', null, 'Last edited ' + sel.edited), React.createElement('span', { className: 'mono' }, 'hash ' + sel.hash)),
            React.createElement('div', { className: 'sec-title mb8' }, 'Variables'),
            React.createElement('div', { className: 'row wrap gap6 mb16' }, sel.vars.map(v => React.createElement(Chip, { key: v, className: 'mono', style: { fontSize: 10 } }, v.includes('pii') || v.includes('member') ? React.createElement(React.Fragment, null, React.createElement(Icon, { name: 'lock', size: 10 }), ' ' + v) : '{{' + v + '}}'))),
            React.createElement('div', { className: 'sec-title mb8' }, 'Template body'),
            React.createElement('pre', { className: 'card mono', style: { padding: 14, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--ink-1)', background: 'var(--bg-0)' } }, sel.body),
            React.createElement('div', { className: 'sec-title mt16 mb8' }, 'Output schema'),
            React.createElement('div', { className: 'card mono fs12', style: { padding: 12, color: 'var(--accent-ink)', background: 'var(--bg-0)' } }, sel.schema),
            React.createElement('div', { className: 'row gap8 mt16' },
              React.createElement(Btn, { size: 'sm', variant: 'primary', icon: 'play', onClick: () => toast({ title: 'Ran against sample', detail: 'latency 2.1s · 1840 tok · parsed OK', sev: 'success' }) }, 'Run against sample'),
              React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'sparkle', onClick: () => toast({ title: 'Test render', detail: 'Variables filled with sample request.', sev: 'info' }) }, 'Test render'),
              React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'swap2', onClick: () => toast({ title: 'Diff vs production', sev: 'info' }) }, 'Diff vs production'),
              React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', onClick: () => copy(sel.body) }, 'Copy')))),
      ),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }

  // ---------- Safety Policy ----------
  function SafetyPolicy() {
    const { member, toast, go } = useStore();
    const P = DB.safetyPolicy;
    const [cons, setCons] = useState(P.conservatism);
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Safety Policy', sub: 'The policy that decides what counts as unsafe · versioned & visible in System Trace' },
        React.createElement(Btn, { icon: 'play', onClick: () => toast({ title: 'Simulated on ' + member.name.split(' ')[0], detail: 'Include/exclude diff computed.', sev: 'info' }) }, 'Simulate on member'),
        React.createElement(Btn, { variant: 'primary', icon: 'check', onClick: () => toast({ title: 'Policy promoted to default', detail: 'Affected members flagged for regeneration.', sev: 'safety', sticky: false }) }, 'Promote to default')),
      React.createElement('div', { className: 'card mb20', style: { padding: 16 } },
        React.createElement('div', { className: 'sec-title mb12' }, 'Conservatism level'),
        React.createElement('div', { className: 'row gap8' }, ['lenient', 'standard', 'strict', 'max'].map(l => React.createElement('button', { key: l, className: `pill-tab ${cons === l ? 'active' : ''}`, style: { padding: '8px 18px', textTransform: 'capitalize' }, onClick: () => setCons(l) }, l)))),
      React.createElement('div', { className: 'grid g2' },
        React.createElement(MetaPanel, { title: 'Per-joint rules', icon: 'bone' },
          React.createElement('div', { className: 'col gap8' }, Object.entries(P.joints).map(([j, rule]) => React.createElement('div', { key: j, className: 'row between center', style: { padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 8 } },
            React.createElement('span', { className: 'fs13', style: { textTransform: 'capitalize' } }, j),
            React.createElement('select', { className: 'select', defaultValue: rule, style: { width: 170, padding: '5px 8px', fontSize: 12 } }, ['exclude', 'caution-only', 'allow-reduced'].map(o => React.createElement('option', { key: o }, o))))))),
        React.createElement(MetaPanel, { title: 'Other rules', icon: 'safety' },
          React.createElement('div', { className: 'col gap12' },
            React.createElement(RuleRow, { label: 'Plyometric when knee active', value: 'exclude' }),
            React.createElement(RuleRow, { label: 'Vertical push when shoulder active', value: 'caution' }),
            React.createElement(RuleRow, { label: 'Unavailable equipment', value: P.equipment }),
            React.createElement(RuleRow, { label: 'Bilateral contraindication', value: P.bilateral }),
            React.createElement(RuleRow, { label: 'Missing joints_loaded data', value: P.missingData }),
            React.createElement(RuleRow, { label: 'Complaint fade after resolved', value: P.fadeDays + ' days' }))),
      ),
      React.createElement('div', { className: 'card mt20', style: { padding: 14, background: 'var(--caution-bg)' } },
        React.createElement('div', { className: 'row gap8 center' }, React.createElement(Icon, { name: 'warning', size: 15, style: { color: 'var(--caution)' } }),
          React.createElement('span', { className: 'fs13', style: { color: 'var(--ink-0)' } }, 'Policy changes affecting an active member\u2019s current recommendations require explicit review and offer to regenerate affected sessions.'))),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }
  function RuleRow({ label, value }) {
    return React.createElement('div', { className: 'row between center' }, React.createElement('span', { className: 'fs13 muted' }, label),
      React.createElement('span', { className: 'chip mono', style: { fontSize: 11 } }, value));
  }

  // ---------- API Explorer ----------
  function ApiExplorer() {
    const { go, toast } = useStore();
    const copy = useCopy();
    const [sel, setSel] = useState(DB.endpoints[2]);
    const [resp, setResp] = useState(null);
    const sampleReq = { member_id: 'mbr_alex', request: 'Build a lower-body session', focus: 'lower' };
    const sampleResp = { recommendation_id: 'rec_8f3a', focus: 'lower', exercises: [{ id: 'ex_008', name: 'Glute Bridge', safe: true }], excluded: [{ id: 'ex_001', reason: 'loads knee' }], validation: { pass: true, unknown_ids: [] }, reasoning_ref: 'trace_91c2', versions: DB.versions };
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'API & Schema', sub: 'Typed contracts & clean system boundaries · synthetic sample payloads' }),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' } },
        React.createElement('div', { className: 'col gap6' }, DB.endpoints.map(e => React.createElement('button', { key: e.path, className: 'card', style: { padding: 11, textAlign: 'left', cursor: 'pointer', outline: sel.path === e.path ? '1.5px solid var(--accent)' : 'none', background: 'var(--bg-2)' }, onClick: () => { setSel(e); setResp(null); } },
          React.createElement('div', { className: 'row gap8 center' }, React.createElement('span', { className: 'mono fs10 fw7', style: { color: e.method === 'GET' ? 'var(--info)' : 'var(--safe)' } }, e.method), React.createElement('span', { className: 'mono fs12' }, e.path)),
          React.createElement('div', { className: 'fs11 faint mt4' }, e.desc)))),
        React.createElement('div', { className: 'col gap16' },
          React.createElement(MetaPanel, { title: sel.method + ' ' + sel.path, icon: 'code', right: React.createElement('div', { className: 'row gap6' },
            React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', onClick: () => copy('curl -X ' + sel.method + ' https://api.future.dev' + sel.path) }, 'Copy curl'),
            React.createElement(Btn, { size: 'sm', variant: 'primary', icon: 'send', onClick: () => { setResp(sampleResp); toast({ title: 'Sample request sent', sev: 'success' }); } }, 'Send sample request')) },
            React.createElement('div', { className: 'sec-title mb8' }, 'Request schema'),
            React.createElement('pre', { className: 'card mono', style: { padding: 12, fontSize: 12, whiteSpace: 'pre-wrap', background: 'var(--bg-0)', color: 'var(--ink-1)' } }, JSON.stringify(sampleReq, null, 2)),
            React.createElement('div', { className: 'sec-title mt16 mb8' }, 'Response' + (resp ? '' : ' schema')),
            React.createElement('pre', { className: 'card mono', style: { padding: 12, fontSize: 12, whiteSpace: 'pre-wrap', background: 'var(--bg-0)', color: resp ? 'var(--accent-ink)' : 'var(--ink-2)' } }, JSON.stringify(resp || sampleResp, null, 2)),
            React.createElement('div', { className: 'fs10 faint mono mt8' }, '// Synthetic data — sample payloads only.'))),
      ),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }

  // ---------- Settings ----------
  function SettingsScreen() {
    const { toast, go } = useStore();
    const S = DB.settings;
    const Section = ({ title, icon, children }) => React.createElement(MetaPanel, { title, icon, right: React.createElement('div', { className: 'row gap6' },
      React.createElement(Btn, { size: 'xs', variant: 'ghost', onClick: () => toast({ title: title + ' reset to default', sev: 'info' }) }, 'Reset'),
      React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'export', onClick: () => toast({ title: 'Exported as JSON', sev: 'success' }) }, 'Export')) }, children);
    const Row = ({ k, v }) => React.createElement('div', { className: 'row between center', style: { padding: '7px 0' } }, React.createElement('span', { className: 'fs13 muted' }, k), React.createElement('span', { className: 'mono fs13' }, String(v)));
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Settings', sub: 'The tunable surface · production-evaluation thinking rests here' },
        React.createElement(Btn, { icon: 'flask', onClick: () => toast({ title: 'Sandbox run', detail: 'Fixed test prompt against current settings.', sev: 'info' }) }, 'Try in sandbox'),
        React.createElement(Btn, { icon: 'swap2', onClick: () => toast({ title: 'Showing diff vs recommended defaults', sev: 'info' }) }, 'Show diff')),
      React.createElement('div', { className: 'grid g2', style: { alignItems: 'start' } },
        React.createElement(Section, { title: 'Provider & model', icon: 'sparkle' }, React.createElement(Row, { k: 'Provider', v: S.provider }), React.createElement(Row, { k: 'Model', v: S.model }), React.createElement(Row, { k: 'Temperature', v: S.temperature }), React.createElement(Row, { k: 'Max tokens', v: S.maxTokens })),
        React.createElement(Section, { title: 'Embedding model', icon: 'layers' }, React.createElement(Row, { k: 'Model', v: S.embModel }), React.createElement(Row, { k: 'Dimension', v: S.embDim }), React.createElement(Row, { k: 'Cache', v: S.embCache ? 'enabled' : 'off' }),
          React.createElement('div', { className: 'card mt8', style: { padding: 9, background: 'var(--caution-bg)' } }, React.createElement('span', { className: 'fs11', style: { color: 'var(--caution)' } }, React.createElement(Icon, { name: 'warning', size: 11 }), ' Changing embedding model requires a rebuild — stored embeddings become incomparable.'))),
        React.createElement(Section, { title: 'Retrieval', icon: 'graph' }, React.createElement(Row, { k: 'Vector top-k', v: S.topK }), React.createElement(Row, { k: 'Graph depth', v: S.graphDepth }), React.createElement(Row, { k: 'Max context tokens', v: S.maxContextTokens }), React.createElement(Row, { k: 'Dedup', v: S.dedup }), React.createElement(Row, { k: 'Recency boost', v: S.recencyBoost })),
        React.createElement(Section, { title: 'Validator & memory', icon: 'safety' }, React.createElement(Row, { k: 'Validator mode', v: S.validatorMode }), React.createElement(Row, { k: 'Retry budget', v: S.retryBudget }), React.createElement(Row, { k: 'Memory window', v: S.memWindow }), React.createElement(Row, { k: 'Summarization', v: S.summarize })),
        React.createElement(Section, { title: 'Logging', icon: 'activity' }, React.createElement(Row, { k: 'Log level', v: S.logLevel }), React.createElement(Row, { k: 'Redact PII', v: S.redactPII ? 'on' : 'off' }), React.createElement(Row, { k: 'Trace sample rate', v: S.sampleRate })),
        React.createElement(Section, { title: 'API keys', icon: 'lock' }, React.createElement('div', { className: 'fs12 muted' }, 'Sensitive values are write-only and never displayed back.'),
          React.createElement('input', { className: 'input mt8', type: 'password', value: '••••••••••••', readOnly: true }))),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }

  // ---------- Tradeoffs ----------
  function Tradeoffs() {
    const { go, toast } = useStore();
    const copy = useCopy();
    const T = DB.tradeoffs;
    const badge = s => s === 'done' ? React.createElement(SafetyBadge, { state: 'safe', label: 'Done' }) : s === 'partial' ? React.createElement(SafetyBadge, { state: 'caution', label: 'Partial' }) : React.createElement(SafetyBadge, { state: 'excluded', label: 'Cut' });
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Tradeoffs & Notes', sub: 'What was built, cut, and what\u2019s next — surfaced in-product (gate with ?notes=1)' },
        React.createElement(Btn, { icon: 'copy', onClick: () => copy(T, 'README section copied') }, 'Copy README section')),
      React.createElement('div', { className: 'grid g2', style: { alignItems: 'start' } },
        React.createElement(MetaPanel, { title: 'Implemented vs cut', icon: 'check' },
          React.createElement('div', { className: 'col gap8' }, T.implemented.map((r, i) => React.createElement('div', { key: i, className: 'row between center', style: { padding: '7px 0' } },
            React.createElement('span', { className: 'fs13', style: { color: 'var(--ink-1)' } }, r[0]), badge(r[1]))))),
        React.createElement(MetaPanel, { title: 'Known limitations', icon: 'warning' },
          React.createElement('div', { className: 'col gap8' }, T.limitations.map((r, i) => React.createElement('div', { key: i, className: 'row between center', style: { padding: '7px 0' } },
            React.createElement('span', { className: 'fs13 muted grow' }, r[0]), React.createElement('span', { className: `sb ${r[1] === 'low' ? 'safe' : 'caution'}` }, r[1] + ' impact'))))),
        React.createElement(MetaPanel, { title: 'Next iterations', icon: 'arrowRight' },
          React.createElement('div', { className: 'col gap8' }, T.next.map((r, i) => React.createElement('div', { key: i, className: 'row gap10 center', style: { padding: '7px 0' } },
            React.createElement('span', { className: 'chip mono', style: { fontSize: 10 } }, r[1]), React.createElement('span', { className: 'fs13 grow', style: { color: 'var(--ink-1)' } }, r[0]), React.createElement('span', { className: `sb ${r[2] === 'high' ? 'info' : 'missing'}` }, r[2] + ' value'))))),
        React.createElement(MetaPanel, { title: 'Architecture decisions', icon: 'book' },
          React.createElement('div', { className: 'col gap12' }, T.adr.map((r, i) => React.createElement('div', { key: i },
            React.createElement('div', { className: 'fw6 fs13 mb4' }, r[0]), React.createElement('div', { className: 'fs12 muted' }, r[1]))))),
      )));
  }

  Object.assign(window, { SchemaReference, PromptInspector, SafetyPolicy, ApiExplorer, SettingsScreen, Tradeoffs });
})();
