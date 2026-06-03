/* FUTURE — core screens: Dashboard, Members, Context Editor, WorkoutCard, DrawerRouter. */
(function () {
  const { useState, useMemo, useEffect } = React;
  const Icon = window.Icon, DB = window.DB, ENGINE = window.ENGINE;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Avatar, Card, MetaPanel, PageHead, Stat, EmptyState, Drawer, Field, useCopy, VersionFooter } = window;

  // ---------- Shared: exercise chips ----------
  function ExChips({ ex, show = ['muscle', 'joint', 'equip', 'pattern'] }) {
    return React.createElement('div', { className: 'row wrap gap6' },
      show.includes('muscle') && ex.muscle_groups.map(m => React.createElement(Chip, { key: 'm' + m, kind: 'muscle' }, m)),
      show.includes('joint') && ex.joints_loaded.map(j => React.createElement(Chip, { key: 'j' + j, kind: 'joint', icon: 'bone' }, j)),
      show.includes('pattern') && ex.movement_patterns.map(p => React.createElement(Chip, { key: 'p' + p, kind: 'pattern' }, p)),
      show.includes('equip') && ex.equipment_required.map(e => React.createElement(Chip, { key: 'e' + e, kind: 'equip' }, e)));
  }
  window.ExChips = ExChips;

  // ---------- Shared: WorkoutCard ----------
  function WorkoutCard({ rec, editable = false, onChange, member }) {
    const { go, openDrawer } = useStore();
    const [local, setLocal] = useState(rec);
    const r = onChange ? rec : local;
    const update = (kind, i, field, val) => {
      const next = { ...r, rows: { ...r.rows, [kind]: r.rows[kind].map((row, j) => j === i ? { ...row, [field]: val } : row) } };
      (onChange || setLocal)(next);
    };
    const Section = ({ title, kind, accent }) => React.createElement('div', { className: 'mb16' },
      React.createElement('div', { className: 'row gap8 mb8' },
        React.createElement('span', { style: { width: 3, height: 14, borderRadius: 3, background: accent } }),
        React.createElement('span', { className: 'sec-title' }, title),
        React.createElement('span', { className: 'fs11 faint' }, r.rows[kind].length + ' exercises')),
      React.createElement('div', { className: 'col gap8' },
        r.rows[kind].map((row, i) => React.createElement(ExRow, { key: row.id, row, kind, i, editable, update, member, go, openDrawer }))));
    return React.createElement('div', null,
      React.createElement(Section, { title: 'Warm-up', kind: 'warmup', accent: 'var(--spectrum-1)' }),
      React.createElement(Section, { title: 'Main work', kind: 'main', accent: 'var(--spectrum-3)' }),
      React.createElement(Section, { title: 'Cool-down', kind: 'cooldown', accent: 'var(--spectrum-4)' }));
  }
  function ExRow({ row, kind, i, editable, update, member, go, openDrawer }) {
    const ex = row.ex;
    const ev = DB.evalExerciseForMember(ex, member);
    const noWeight = !ex.supports_weight;
    const durOnly = ex.is_duration && !ex.is_reps;
    const cell = (val, field, suffix, disabled) => editable
      ? React.createElement('input', { className: 'input', disabled, value: val ?? '', onChange: e => update(kind, i, field, e.target.value),
          style: { width: 58, padding: '4px 6px', textAlign: 'center', fontSize: 12, opacity: disabled ? .4 : 1 } })
      : React.createElement('span', { className: 'mono fs12', style: { opacity: disabled ? .4 : 1 } }, (val ?? '—') + (suffix && val ? '' : ''));
    return React.createElement('div', { className: 'card', style: { padding: 12, background: 'var(--bg-2)' } },
      React.createElement('div', { className: 'row between', style: { alignItems: 'flex-start' } },
        React.createElement('div', { className: 'grow' },
          React.createElement('div', { className: 'row gap8 center' },
            React.createElement('span', { className: 'fw7 fs13', style: { color: 'var(--ink-0)' } }, ex.name),
            ev.state !== 'safe' && React.createElement(SafetyBadge, { state: ev.state })),
          React.createElement('div', { className: 'mt8' }, React.createElement(ExChips, { ex, show: ['muscle', 'joint'] }))),
        React.createElement('div', { className: 'row gap4' },
          React.createElement(IconBtn, { icon: 'why', size: 'sm', title: 'Why included', onClick: () => openDrawer('why', { kind: 'included', ex, member, why: row.why }) }),
          React.createElement(IconBtn, { icon: 'swap', size: 'sm', title: 'Swap', onClick: () => openDrawer('swap', { ex, member, onReplace: c => update(kind, i, 'ex', c) }) }),
          React.createElement(IconBtn, { icon: 'eye', size: 'sm', title: 'View exercise', onClick: () => go('exerciseDetail', { id: ex.id }) }))),
      React.createElement('div', { className: 'row gap16 mt12', style: { fontSize: 11 } },
        React.createElement(Metric, { label: 'sets', node: cell(row.sets, 'sets') }),
        React.createElement(Metric, { label: durOnly ? 'reps (n/a)' : 'reps', node: cell(durOnly ? null : row.reps, 'reps', '', durOnly) }),
        React.createElement(Metric, { label: 'duration', node: durOnly || row.duration ? cell(row.duration, 'duration') : React.createElement('span', { className: 'faint' }, '—') }),
        React.createElement(Metric, { label: 'rest', node: cell(row.rest, 'rest') }),
        React.createElement(Metric, { label: noWeight ? 'load (bw)' : 'load', node: cell(noWeight ? null : row.load, 'load', '', noWeight) })));
  }
  function Metric({ label, node }) {
    return React.createElement('div', { className: 'col', style: { gap: 2 } },
      React.createElement('span', { className: 'fs11 faint' }, label), node);
  }
  window.WorkoutCard = WorkoutCard;

  // ---------- Member Dashboard ----------
  function MemberDashboard() {
    const { member, go, openDrawer, toast } = useStore();
    const history = useMemo(() => DB.historyFor(member), [member]);
    const activeInj = (member.injuries || []).filter(i => i.status === 'active' || i.status === 'improving');
    const sendPrompt = (text, focus) => { go('console', { prompt: text, autostart: true, focus }); };
    const shortcuts = [
      ['Lower-body session', 'Build this member a lower-body session for this week.', 'dumbbell', 'lower'],
      ['Upper-body session', 'Build an upper-body session for this member.', 'dumbbell', 'upper'],
      ['Recovery session', 'Give this member a recovery / mobility session.', 'heart', 'recovery'],
      ['Weekly plan', 'Build a full week of training for this member.', 'calendar', 'week'],
      ['What to watch for', 'What should I watch for with this member?', 'eye', null],
      ['Explain last recommendation', 'Explain the last recommendation you made.', 'why', null],
    ];

    if (member.thin) return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: member.name, sub: member.persona }),
      React.createElement(Card, { className: 'glow', pad: true },
        React.createElement(EmptyState, {
          icon: 'ingest', title: 'This member needs context',
          sub: 'Priya exists in the graph but lacks enough facts to generate safe recommendations. Ingest a profile, injuries, equipment, or history to begin.',
          action: React.createElement('div', { className: 'row gap8 mt8' },
            React.createElement(Btn, { variant: 'primary', icon: 'ingest', onClick: () => go('ingest') }, 'Ingest context'),
            React.createElement(Btn, { variant: 'ghost', icon: 'edit', onClick: () => go('contextEditor') }, 'Edit context')) }))));

    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      // header
      React.createElement('div', { className: 'row between mb20', style: { flexWrap: 'wrap', gap: 16 } },
        React.createElement('div', { className: 'row gap16', style: { minWidth: 0 } },
          React.createElement(Avatar, { member, size: 60, sq: true }),
          React.createElement('div', { style: { minWidth: 0 } },
            React.createElement('div', { className: 'row gap10 center wrap' },
              React.createElement('h1', { className: 'page-title' }, member.name),
              React.createElement('span', { className: 'chip outline' }, member.persona)),
            React.createElement('div', { className: 'row gap16 mt8 muted fs13 wrap' },
              React.createElement('span', null, React.createElement('span', { className: 'faint' }, 'Goal · '), member.goal),
              React.createElement('span', null, React.createElement('span', { className: 'faint' }, 'Trains · '), member.frequency),
              React.createElement('span', null, React.createElement('span', { className: 'faint' }, 'Level · '), member.skill)))),
        React.createElement('div', { className: 'row gap8' },
          React.createElement(Btn, { icon: 'ingest', onClick: () => go('ingest') }, 'Ingest signal'),
          React.createElement(Btn, { icon: 'edit', onClick: () => go('contextEditor') }, 'Edit context'),
          React.createElement(Btn, { variant: 'primary', icon: 'console', onClick: () => go('console') }, 'Open console'))),

      // safety strip
      activeInj.length > 0 && React.createElement('div', { className: 'card mb20', style: { borderColor: 'oklch(0.80 0.14 78 / 0.3)', background: 'oklch(0.80 0.14 78 / 0.06)' } },
        React.createElement('div', { className: 'card-pad row gap14 wrap', style: { alignItems: 'center' } },
          React.createElement('span', { className: 'sb caution' }, React.createElement(Icon, { name: 'warning', size: 12 }), 'Active safety context'),
          activeInj.map(inj => React.createElement('button', {
            key: inj.id, className: 'chip clickable joint', style: { padding: '5px 11px' }, onClick: () => openDrawer('injury', { inj, member }),
          },
            React.createElement(Icon, { name: 'bone', size: 12 }),
            inj.label + ' · ' + inj.joint + ' · ' + inj.severity,
            React.createElement(Icon, { name: 'chevRight', size: 12 }))),
          React.createElement('span', { className: 'fs12 faint grow', style: { textAlign: 'right' } }, 'Safety filter active before generation'))),

      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' } },
        // left
        React.createElement('div', { className: 'col gap20' },
          // shortcuts
          React.createElement(MetaPanel, { title: 'Generate', icon: 'sparkle', right: React.createElement('span', { className: 'fs11 faint' }, 'sends a templated prompt to the console') },
            React.createElement('div', { className: 'grid g3', style: { gap: 10 } },
              shortcuts.map((s, i) => React.createElement('button', {
                key: i, className: 'card', style: { padding: 14, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-2)' },
                onClick: () => s[3] === 'week' ? go('weekly') : sendPrompt(s[1], s[3]),
              },
                React.createElement('div', { className: 'row gap8 center mb8' },
                  React.createElement('span', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--grad-soft)', display: 'grid', placeItems: 'center' } }, React.createElement(Icon, { name: s[0] === 'Weekly plan' ? 'calendar' : s[2], size: 16, style: { color: 'var(--accent-ink)' } }))),
                React.createElement('div', { className: 'fw6 fs13' }, s[0]),
                React.createElement('div', { className: 'fs11 faint mt4', style: { lineHeight: 1.4 } }, s[1]))))),
          // recent activity
          React.createElement(MetaPanel, { title: 'Recent activity', icon: 'sessions', right: React.createElement(Btn, { size: 'xs', variant: 'ghost', onClick: () => go('history') }, 'Full timeline →') },
            React.createElement('div', { className: 'col gap8' },
              history.slice(0, 4).map((h, i) => React.createElement('button', {
                key: i, className: 'row gap12 center', style: { padding: '9px 10px', borderRadius: 9, background: 'var(--bg-2)', border: 'none', width: '100%', cursor: 'pointer' }, onClick: () => go('history'),
              },
                React.createElement(AdherenceDot, { status: h.adherence }),
                React.createElement('div', { className: 'grow', style: { textAlign: 'left' } },
                  React.createElement('div', { className: 'fw6 fs13' }, h.focus),
                  React.createElement('div', { className: 'fs11 faint' }, h.date + ' · ' + h.source)),
                h.complaints.length > 0 && React.createElement('span', { className: 'sb caution' }, React.createElement(Icon, { name: 'warning', size: 10 }), h.complaints[0]),
                React.createElement('span', { className: 'fs12 muted mono' }, h.dur ? h.dur + ' min' : 'missed'))))),
        ),
        // right rail
        React.createElement('div', { className: 'col gap20' },
          React.createElement(MetaPanel, { title: 'Graph health', icon: 'graph' },
            React.createElement('div', { className: 'grid g2', style: { gap: 14 } },
              React.createElement(Stat, { v: member.graphHealth.nodes, k: 'Nodes ingested' }),
              React.createElement(Stat, { v: member.graphHealth.edges, k: 'Relationships' })),
            React.createElement('div', { className: 'divider' }),
            React.createElement('div', { className: 'row between fs12' }, React.createElement('span', { className: 'muted' }, 'Last ingestion'), React.createElement('span', null, member.graphHealth.lastIngest)),
            React.createElement('div', { className: 'row between fs12 mt8' }, React.createElement('span', { className: 'muted' }, 'Vector index'),
              React.createElement('span', { className: `sb ${member.graphHealth.vector === 'healthy' ? 'safe' : 'caution'}` }, member.graphHealth.vector)),
            React.createElement(Btn, { size: 'sm', variant: 'subtle', icon: 'graph', className: 'mt12', style: { width: '100%' }, onClick: () => go('graph') }, 'Open graph explorer')),
          React.createElement(MetaPanel, { title: 'Provenance', icon: 'note', right: React.createElement(Btn, { size: 'xs', variant: 'ghost', onClick: () => go('trace') }, 'Audit →') },
            React.createElement('div', { className: 'col gap8' },
              [['Profile form', 9, 'var(--spectrum-4)'], ['Ingested chat signal', 6, 'var(--spectrum-1)'], ['Logged complaint', 3, 'var(--spectrum-2)'], ['Derived from rule', 5, 'var(--spectrum-3)']].map((p, i) =>
                React.createElement('div', { key: i, className: 'row gap8 center fs12' },
                  React.createElement('span', { style: { width: 8, height: 8, borderRadius: 2, background: p[2] } }),
                  React.createElement('span', { className: 'grow' }, p[0]),
                  React.createElement('span', { className: 'mono muted' }, p[1] + ' facts'))))),
          React.createElement(MetaPanel, { title: 'Equipment & preferences', icon: 'dumbbell' },
            React.createElement('div', { className: 'row wrap gap6 mb12' }, member.equipment.map(e => React.createElement(Chip, { key: e, kind: 'equip' }, e))),
            React.createElement('div', { className: 'col gap6' }, member.preferences.map((p, i) => React.createElement('div', { key: i, className: 'fs12 muted row gap6' }, React.createElement(Icon, { name: 'check', size: 12, style: { color: 'var(--safe)' } }), p)))),
        )),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }
  function AdherenceDot({ status }) {
    const c = { completed: 'var(--safe)', partial: 'var(--caution)', missed: 'var(--danger)' }[status] || 'var(--ink-3)';
    return React.createElement('span', { title: status, style: { width: 10, height: 10, borderRadius: '50%', background: c, flex: 'none', boxShadow: `0 0 0 3px ${c}22` } });
  }
  window.AdherenceDot = AdherenceDot;

  // ---------- Members screen ----------
  function MembersScreen() {
    const { members, selectMember, go, member: cur, setModal } = useStore();
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Members', sub: 'Synthetic member profiles · goals, injuries, equipment, history' },
        React.createElement(Btn, { variant: 'primary', icon: 'plus', onClick: () => setModal({ type: 'newMember' }) }, 'New synthetic member')),
      React.createElement('div', { className: 'grid g3' },
        members.map(m => {
          const inj = (m.injuries || []).filter(i => i.status !== 'resolved');
          return React.createElement('div', { key: m.id, className: 'card', style: { padding: 18, cursor: 'pointer', outline: cur.id === m.id ? '1.5px solid var(--accent)' : 'none' }, onClick: () => { selectMember(m.id); go('dashboard'); } },
            React.createElement('div', { className: 'row gap12 mb12' },
              React.createElement(Avatar, { member: m, size: 46, sq: true }),
              React.createElement('div', { className: 'grow' },
                React.createElement('div', { className: 'fw7 fs15' }, m.name),
                React.createElement('div', { className: 'fs12 faint' }, m.persona))),
            React.createElement('div', { className: 'fs12 muted mb12' }, React.createElement('span', { className: 'faint' }, 'Goal · '), m.goal),
            React.createElement('div', { className: 'row wrap gap6 mb12' },
              m.thin ? React.createElement(SafetyBadge, { state: 'missing', label: 'Thin context' })
                : inj.length ? inj.map(i => React.createElement(SafetyBadge, { key: i.id, state: i.severity === 'mild' ? 'caution' : 'excluded', label: i.joint })) : React.createElement(SafetyBadge, { state: 'safe', label: 'No active injuries' })),
            React.createElement('div', { className: 'row between fs11 faint mono' },
              React.createElement('span', null, m.graphHealth.nodes + ' nodes · ' + m.graphHealth.edges + ' edges'),
              m.adherence != null && React.createElement('span', null, Math.round(m.adherence * 100) + '% adherence')));
        })),
      React.createElement('div', { className: 'mt16 fs12 faint' }, 'All members are synthetic. No real personal data is stored.')));
  }

  // ---------- Context editor ----------
  function ContextEditor() {
    const { member, go, toast } = useStore();
    const [draft, setDraft] = useState(member);
    const tabs = ['Profile', 'Goals', 'Preferences', 'Equipment', 'Injuries', 'History', 'Signals'];
    const [tab, setTab] = useState('Injuries');
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Edit context', sub: member.name + ' · changes update safety filters & recommendation context immediately' },
        React.createElement(Btn, { variant: 'ghost', onClick: () => go('dashboard') }, 'Cancel'),
        React.createElement(Btn, { icon: 'refresh', onClick: () => toast({ title: 'Graph rebuild queued', detail: 'Re-ingesting changed facts.', sev: 'info' }) }, 'Rebuild graph'),
        React.createElement(Btn, { variant: 'primary', icon: 'check', onClick: () => { toast({ title: 'Changes saved', sev: 'success' }); go('dashboard'); } }, 'Save changes')),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24 } },
        React.createElement('div', { className: 'col gap2' },
          tabs.map(t => React.createElement('button', { key: t, className: `nav-item ${tab === t ? 'active' : ''}`, onClick: () => setTab(t) }, t))),
        React.createElement('div', null,
          tab === 'Injuries' ? React.createElement(InjuryEditor, { member, toast }) : React.createElement(GenericEditor, { member, tab, toast })))));
  }
  function InjuryEditor({ member, toast }) {
    const [injuries, setInjuries] = useState(member.injuries || []);
    return React.createElement('div', { className: 'col gap12' },
      injuries.map((inj, i) => React.createElement('div', { key: inj.id, className: 'card', style: { padding: 16 } },
        React.createElement('div', { className: 'row between mb12' },
          React.createElement('div', { className: 'row gap8 center' },
            React.createElement(Icon, { name: 'bone', size: 16, style: { color: 'var(--spectrum-1)' } }),
            React.createElement('span', { className: 'fw7' }, inj.label)),
          React.createElement('div', { className: 'row gap8 center' },
            React.createElement('span', { className: 'fs12 muted' }, inj.status === 'resolved' ? 'Resolved' : 'Active'),
            React.createElement(window.Switch, { on: inj.status !== 'resolved', onClick: () => { setInjuries(a => a.map((x, j) => j === i ? { ...x, status: x.status === 'resolved' ? 'active' : 'resolved' } : x)); toast({ title: inj.status === 'resolved' ? 'Injury re-activated' : 'Injury resolved — contraindications retained as history', sev: 'info' }); } }),
            React.createElement(IconBtn, { icon: 'trash', size: 'sm', title: 'Delete', onClick: () => { setInjuries(a => a.filter((_, j) => j !== i)); toast({ title: 'Injury removed — contraindication edges deactivated', sev: 'warning' }); } }))),
        React.createElement('div', { className: 'grid g3', style: { gap: 12 } },
          React.createElement(Field, { label: 'Affected joint' }, React.createElement('input', { className: 'input', defaultValue: inj.joint })),
          React.createElement(Field, { label: 'Severity' }, React.createElement('select', { className: 'select', defaultValue: inj.severity }, ['mild', 'moderate', 'severe', 'resolved'].map(s => React.createElement('option', { key: s }, s)))),
          React.createElement(Field, { label: 'Noted' }, React.createElement('input', { className: 'input', defaultValue: inj.noted }))),
        React.createElement('div', { className: 'fs12 muted' }, 'Contraindicated patterns: ', inj.patterns.length ? inj.patterns.join(', ') : '—'))),
      React.createElement(Btn, { variant: 'subtle', icon: 'plus', onClick: () => setInjuries(a => [...a, { id: 'inj_new_' + Date.now(), label: 'New condition', joint: 'knee', severity: 'mild', status: 'active', noted: '2026-06-02', patterns: [] }]) }, 'Add injury / condition'));
  }
  function GenericEditor({ member, tab, toast }) {
    const data = { Profile: [['Name', member.name], ['Persona', member.persona], ['Frequency', member.frequency], ['Skill', member.skill]],
      Goals: member.goals.map(g => ['Goal', g]), Preferences: member.preferences.map(p => ['Preference', p]),
      Equipment: member.equipment.map(e => ['Equipment', e]), History: ['—'], Signals: ['—'] }[tab];
    return React.createElement('div', { className: 'col gap12' },
      React.createElement('div', { className: 'card', style: { padding: 16 } },
        React.createElement('div', { className: 'col gap12' },
          (data || []).map((row, i) => Array.isArray(row) ? React.createElement(Field, { key: i, label: row[0] },
            React.createElement('div', { className: 'row gap8' }, React.createElement('input', { className: 'input', defaultValue: row[1] }),
              React.createElement(IconBtn, { icon: 'trash', size: 'sm', title: 'Remove', onClick: () => toast({ title: 'Removed', sev: 'info' }) }))) : React.createElement('div', { key: i, className: 'fs13 muted' }, 'No entries yet.'))),
        React.createElement(Btn, { variant: 'subtle', icon: 'plus', className: 'mt12', onClick: () => toast({ title: 'Add ' + tab.toLowerCase(), sev: 'info' }) }, 'Add ' + tab.toLowerCase().replace(/s$/, ''))));
  }

  // ---------- Drawer router ----------
  function DrawerRouter({ drawer, onClose }) {
    const { member } = useStore();
    if (drawer.type === 'why') return React.createElement(WhyDrawer, { data: drawer.data, onClose });
    if (drawer.type === 'injury') return React.createElement(InjuryPanel, { data: drawer.data, onClose });
    if (drawer.type === 'swap') return React.createElement(SwapPicker, { data: drawer.data, onClose });
    return null;
  }

  function WhyDrawer({ data, onClose }) {
    const { go, openDrawer, member: storeMember } = useStore();
    const copy = useCopy();
    const { ex, member, kind } = data;
    const why = kind === 'included' ? (data.why || ENGINE.buildWhy(ex, member)) : ENGINE.buildWhySkipped(ex, member);
    const skipped = kind !== 'included';
    const action = skipped ? 'skipped' : 'included';

    // Hybrid explainability: the graph path + facts below are the deterministic,
    // auditable evidence (computed from the real graph, instant). In parallel we
    // ask the backend /explain (LLM explainer) to *narrate* that evidence in
    // natural language. The graph-grounded instant text is the guaranteed fallback.
    const [ai, setAi] = useState({ state: ex ? 'loading' : 'skip', text: null });
    useEffect(() => {
      if (!ex || !member) return;
      let on = true;
      const req = `Why did you ${action} ${ex.name} for this member?`;
      ENGINE.explainLive(member, ex.id, action, req)
        .then(p => { if (on) setAi({ state: (p && p.explanation) ? 'done' : 'empty', text: p && p.explanation }); })
        .catch(() => { if (on) setAi({ state: 'error', text: null }); });
      return () => { on = false; };
    }, [ex && ex.id, member && member.id, action]);

    const aiNarration = ai.state === 'done' && ai.text;

    return React.createElement(Drawer, { title: skipped ? 'Why skipped' : 'Why included', sub: ex?.name || data.node?.label, onClose,
      foot: React.createElement('div', { className: 'row gap8' },
        React.createElement(Btn, { size: 'sm', icon: 'graph', onClick: () => { onClose(); go('graph'); } }, 'Open in graph'),
        ex && React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'swap', onClick: () => { openDrawer('swap', { ex, member }); } }, 'Find alternatives'),
        React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', onClick: () => copy(aiNarration || why.plain, 'Explanation copied') }, 'Copy')) },
      React.createElement('div', { className: 'col gap16' },
        React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Decision'),
          React.createElement('div', { className: 'card', style: { padding: 14, background: skipped ? 'var(--danger-bg)' : 'var(--safe-bg)' } },
            React.createElement('div', { className: 'fs14 fw6', style: { color: skipped ? 'var(--danger)' : 'var(--safe)' } }, skipped ? 'Skipped ' + ex.name : 'Included ' + ex.name),
            // Graph-grounded reason (always shown, instant).
            React.createElement('div', { className: 'fs13 mt8', style: { color: 'var(--ink-1)' } }, why.plain),
            // LLM narration of that evidence, when it arrives.
            ex && React.createElement('div', { className: 'mt12', style: { borderTop: '1px solid var(--line-soft)', paddingTop: 10 } },
              React.createElement('div', { className: 'row gap6 center mb6' },
                React.createElement(Icon, { name: 'sparkle', size: 12, style: { color: 'var(--accent)' } }),
                React.createElement('span', { className: 'fs10 fw7', style: { color: 'var(--accent-ink)', letterSpacing: '.04em' } }, 'AI EXPLANATION'),
                ai.state === 'loading' && React.createElement('span', { className: 'fs10 faint' }, '· narrating…')),
              ai.state === 'loading'
                ? React.createElement('div', { className: 'fs12 faint', style: { fontStyle: 'italic' } }, 'Asking the explainer to narrate the graph evidence…')
                : aiNarration
                  ? React.createElement('div', { className: 'fs13', style: { color: 'var(--ink-1)', lineHeight: 1.55 } }, aiNarration)
                  : React.createElement('div', { className: 'fs12 faint' }, 'Live narration unavailable — the graph-grounded reason above stands on its own.')))),
        React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Graph path used'),
          React.createElement('div', { className: 'card mono fs12', style: { padding: 14, lineHeight: 1.8, color: 'var(--accent-ink)' } }, why.path)),
        React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Facts involved'),
          React.createElement('div', { className: 'col gap6' }, why.facts.map((f, i) => React.createElement('div', { key: i, className: 'row gap8 fs12 muted' }, React.createElement(Icon, { name: 'check', size: 12, style: { color: 'var(--ink-3)' } }), f)))),
        skipped && why.replacement && React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Replacement logic'),
          React.createElement('div', { className: 'card', style: { padding: 12, background: 'var(--bg-2)' } },
            React.createElement('div', { className: 'row gap8 center' }, React.createElement(Icon, { name: 'swap', size: 14, style: { color: 'var(--accent)' } }),
              React.createElement('span', { className: 'fw6 fs13' }, why.replacement.ex.name)),
            React.createElement('div', { className: 'fs12 muted mt4' }, why.replacement.reason))),
        React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Confidence'),
          React.createElement('div', { className: 'row gap8 center' }, React.createElement(SafetyBadge, { state: why.confidence === 'high' ? 'safe' : 'caution', label: why.confidence + ' confidence' }),
            React.createElement('span', { className: 'fs12 faint' }, 'graph evidence + dataset metadata agree'))),
        ex && React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Source signal'),
          React.createElement('div', { className: 'card', style: { padding: 12, background: 'var(--bg-2)' } },
            React.createElement('div', { className: 'fs12 muted' }, member.injuries?.[0] ? DB.signalText(member.injuries[0].source) : 'No source signal')))));
  }

  function InjuryPanel({ data, onClose }) {
    const { go } = useStore();
    const { inj, member } = data;
    const excluded = DB.exercises.filter(e => e.joints_loaded.includes(inj.joint)).slice(0, 8);
    return React.createElement(Drawer, { title: inj.label, sub: 'Graph facts · ' + inj.joint, onClose,
      foot: React.createElement(Btn, { size: 'sm', icon: 'graph', onClick: () => { onClose(); go('graph'); } }, 'Open in graph') },
      React.createElement('div', { className: 'col gap16' },
        React.createElement('div', { className: 'grid g2', style: { gap: 12 } },
          React.createElement(InfoBox, { k: 'Affected joint', v: inj.joint }),
          React.createElement(InfoBox, { k: 'Severity', v: inj.severity }),
          React.createElement(InfoBox, { k: 'Status', v: inj.status }),
          React.createElement(InfoBox, { k: 'Noted', v: inj.noted })),
        React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Contraindicated movement patterns'),
          React.createElement('div', { className: 'row wrap gap6' }, inj.patterns.length ? inj.patterns.map(p => React.createElement(Chip, { key: p, kind: 'pattern' }, p)) : React.createElement('span', { className: 'fs12 faint' }, 'None mapped'))),
        React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Excluded exercises (' + excluded.length + ')'),
          React.createElement('div', { className: 'col gap6' }, excluded.map(e => React.createElement('div', { key: e.id, className: 'row between fs12', style: { padding: '7px 10px', background: 'var(--bg-2)', borderRadius: 7 } },
            React.createElement('span', { style: { color: 'var(--ink-1)' } }, e.name), React.createElement(SafetyBadge, { state: 'excluded' }))))),
        React.createElement('div', null,
          React.createElement('div', { className: 'sec-title mb8' }, 'Source signal'),
          React.createElement('div', { className: 'card mono fs12', style: { padding: 12, color: 'var(--ink-1)' } }, DB.signalText(inj.source)))));
  }
  function InfoBox({ k, v }) {
    return React.createElement('div', { className: 'card', style: { padding: 12, background: 'var(--bg-2)' } },
      React.createElement('div', { className: 'fs11 faint' }, k), React.createElement('div', { className: 'fw6 fs14 mt4', style: { textTransform: 'capitalize' } }, v));
  }

  function SwapPicker({ data, onClose }) {
    const { toast } = useStore();
    const { ex, member, onReplace } = data;
    const [sel, setSel] = useState(null);
    const candidates = useMemo(() => ENGINE.swapCandidates(ex, member), [ex, member]);
    const [filters, setFilters] = useState({ pattern: true, muscle: false, equip: true, joint: true });
    return React.createElement(Drawer, { title: 'Safe swap', sub: 'Replacing ' + ex.name, onClose,
      foot: React.createElement('div', { className: 'row between' },
        React.createElement(Btn, { size: 'sm', variant: 'ghost', onClick: onClose }, 'Cancel'),
        React.createElement(Btn, { size: 'sm', variant: 'primary', icon: 'swap', disabled: !sel, onClick: () => { onReplace?.(sel); toast({ title: 'Replaced ' + ex.name + ' → ' + sel.name, sev: 'success' }); onClose(); } }, 'Replace')) },
      React.createElement('div', { className: 'row wrap gap6 mb16' },
        [['Same movement pattern', 'pattern'], ['Same muscle group', 'muscle'], ['Available equipment only', 'equip'], ['Avoid loaded joints', 'joint']].map(f =>
          React.createElement(Chip, { key: f[1], onClick: () => setFilters(s => ({ ...s, [f[1]]: !s[f[1]] })), active: filters[f[1]] }, f[0]))),
      React.createElement('div', { className: 'col gap8' },
        candidates.map(c => {
          const active = sel?.id === c.ex.id;
          return React.createElement('button', {
            key: c.ex.id, className: 'card', style: { padding: 12, textAlign: 'left', cursor: 'pointer', width: '100%', outline: active ? '1.5px solid var(--accent)' : 'none', background: 'var(--bg-2)' }, onClick: () => setSel(c.ex),
          },
            React.createElement('div', { className: 'row between mb8' },
              React.createElement('span', { className: 'fw6 fs13' }, c.ex.name),
              React.createElement(SafetyBadge, { state: 'safe' })),
            React.createElement('div', { className: 'fs12 muted mb8' }, React.createElement(Icon, { name: 'check', size: 11, style: { color: 'var(--safe)' } }), ' ' + c.reason),
            React.createElement(ExChips, { ex: c.ex, show: ['muscle', 'pattern'] }));
        })));
  }

  Object.assign(window, { MemberDashboard, MembersScreen, ContextEditor, DrawerRouter, WhyDrawer, SwapPicker, InjuryPanel });
})();
