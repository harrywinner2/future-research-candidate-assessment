/* FUTURE — app shell: sidebar, topbar, command palette, notifications, onboarding, router. */
(function () {
  const { useState, useEffect, useRef, useMemo } = React;
  const Icon = window.Icon, DB = window.DB;
  const { useStore, Btn, IconBtn, Avatar, SafetyBadge, Modal, EmptyState } = window;

  // ---- Nav config ----
  const NAV = [
    { group: 'Coaching', items: [
      { id: 'dashboard', label: 'Member Dashboard', icon: 'dashboard' },
      { id: 'console', label: 'Coach Console', icon: 'console' },
      { id: 'weekly', label: 'Weekly Programming', icon: 'calendar' },
      { id: 'history', label: 'History & Adherence', icon: 'sessions' },
      { id: 'sessions', label: 'Conversations', icon: 'note' },
    ]},
    { group: 'Knowledge', items: [
      { id: 'graph', label: 'Graph Explorer', icon: 'graph' },
      { id: 'library', label: 'Exercise Library', icon: 'library' },
      { id: 'ingest', label: 'Ingestion', icon: 'ingest' },
      { id: 'schema', label: 'Schema & Ontology', icon: 'schema' },
      { id: 'members', label: 'Members', icon: 'members' },
    ]},
    { group: 'Operate', items: [
      { id: 'eval', label: 'Evaluations', icon: 'eval' },
      { id: 'harness', label: 'Comparison Harness', icon: 'flask' },
      { id: 'trace', label: 'System Trace', icon: 'activity' },
      { id: 'cost', label: 'Cost & Performance', icon: 'cost' },
      { id: 'demo', label: 'Demo Walkthrough', icon: 'play' },
    ]},
    { group: 'Configure', items: [
      { id: 'prompt', label: 'Prompt Inspector', icon: 'prompt' },
      { id: 'safety', label: 'Safety Policy', icon: 'safety' },
      { id: 'api', label: 'API & Schema', icon: 'code' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
      { id: 'tradeoffs', label: 'Tradeoffs & Notes', icon: 'book' },
    ]},
    { group: 'Multi-Agent', items: [
      { id: 'agent', label: 'Agent Console', icon: 'agent' },
      { id: 'topology', label: 'StateGraph Topology', icon: 'layers' },
      { id: 'memory', label: 'Memory Inspector', icon: 'list' },
      { id: 'maDemo', label: 'Routing Tests', icon: 'target' },
    ]},
  ];
  const ALL_ITEMS = NAV.flatMap(g => g.items);
  const TITLES = Object.fromEntries(ALL_ITEMS.map(i => [i.id, i.label]));
  window.SCREEN_TITLES = TITLES;

  function Sidebar() {
    const { screen, go, navCollapsed } = useStore();
    return React.createElement('aside', { className: 'sidebar' },
      React.createElement('div', { className: 'brand' },
        React.createElement('div', { className: 'logo' }),
        React.createElement('div', null,
          React.createElement('div', { className: 'name' }, 'Future'),
          React.createElement('div', { className: 'sub' }, 'Coach Intelligence'))),
      React.createElement('nav', { className: 'nav' },
        NAV.map(g => React.createElement('div', { key: g.group },
          React.createElement('div', { className: 'nav-group-label' }, g.group),
          g.items.map(it => React.createElement('button', {
            key: it.id, className: `nav-item ${screen === it.id ? 'active' : ''}`, onClick: () => go(it.id), title: it.label,
          },
            React.createElement(Icon, { name: it.icon, size: 17 }),
            React.createElement('span', { className: 'label' }, it.label),
            it.id === 'trace' && React.createElement('span', { className: 'badge-count' }, '3')))))));
  }

  function MemberSelect() {
    const { member, members, selectMember, go } = useStore();
    const [open, setOpen] = useState(false);
    const ref = useRef();
    useEffect(() => { const f = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
    return React.createElement('div', { ref, style: { position: 'relative' } },
      React.createElement('button', { className: 'btn', style: { paddingLeft: 6, paddingRight: 10 }, onClick: () => setOpen(o => !o) },
        React.createElement(Avatar, { member, size: 24 }),
        React.createElement('span', { style: { fontWeight: 600 } }, member.name),
        member.injuries?.some(i => i.status === 'active') && React.createElement('span', { className: 'sb caution', style: { padding: '1px 6px' } }, React.createElement(Icon, { name: 'warning', size: 10 })),
        React.createElement(Icon, { name: 'chevDown', size: 14, style: { opacity: .6 } })),
      open && React.createElement('div', { className: 'card', style: { position: 'absolute', top: 42, left: 0, width: 320, zIndex: 30, boxShadow: 'var(--sh-3)', padding: 6 } },
        React.createElement('div', { className: 'fs11 fw7 faint', style: { padding: '6px 8px' } }, 'SWITCH MEMBER'),
        members.map(m => React.createElement('button', {
          key: m.id, className: 'nav-item', style: { width: '100%' }, onClick: () => { selectMember(m.id); setOpen(false); },
        },
          React.createElement(Avatar, { member: m, size: 30 }),
          React.createElement('div', { className: 'grow', style: { textAlign: 'left' } },
            React.createElement('div', { className: 'fw6 fs13' }, m.name),
            React.createElement('div', { className: 'fs11 faint' }, m.persona)),
          m.thin ? React.createElement('span', { className: 'sb missing', style: { padding: '1px 6px' } }, 'thin')
            : m.injuries.some(i => i.status === 'active') ? React.createElement('span', { className: 'sb caution', style: { padding: '1px 6px' } }, 'injury') : React.createElement('span', { className: 'sb safe', style: { padding: '1px 6px' } }, 'ok'))),
        React.createElement('div', { className: 'divider', style: { margin: '6px 0' } }),
        React.createElement('button', { className: 'nav-item', style: { width: '100%' }, onClick: () => { setOpen(false); go('members'); } },
          React.createElement(Icon, { name: 'plus', size: 16 }), React.createElement('span', null, 'New synthetic member'))));
  }

  function Topbar() {
    const { screen, setPaletteOpen, notifOpen, setNotifOpen } = useStore();
    return React.createElement('header', { className: 'topbar' },
      React.createElement(IconBtn, { icon: 'menu', size: 'sm', title: 'Toggle nav', onClick: () => useStoreToggleNav() }),
      React.createElement('div', { className: 'crumb' }, React.createElement('b', null, TITLES[screen] || 'Future')),
      React.createElement('div', { className: 'spacer' }),
      React.createElement('button', { className: 'btn sm ghost', onClick: () => setPaletteOpen(true), style: { gap: 8 } },
        React.createElement(Icon, { name: 'search', size: 14 }), 'Search', React.createElement('span', { className: 'kbd' }, '⌘K')),
      React.createElement(MemberSelect),
      React.createElement('div', { style: { position: 'relative' } },
        React.createElement(IconBtn, { icon: 'bell', size: 'sm', title: 'Notifications', onClick: () => setNotifOpen(o => !o) }),
        React.createElement('span', { style: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--spectrum-2)' } }),
        notifOpen && React.createElement(NotifCenter)));
  }
  function useStoreToggleNav() { const ev = new CustomEvent('toggle-nav'); window.dispatchEvent(ev); }

  function NotifCenter() {
    const { go, setNotifOpen } = useStore();
    const SEV = { safety: ['safety', 'Safety'], warning: ['warning', 'Warning'], info: ['info', 'Info'], error: ['warning', 'Error'] };
    return React.createElement('div', { className: 'card', style: { position: 'absolute', top: 40, right: 0, width: 360, zIndex: 40, boxShadow: 'var(--sh-3)' } },
      React.createElement('div', { className: 'panel-head' }, React.createElement('h3', { className: 'grow' }, 'Notifications'),
        React.createElement('span', { className: 'fs11 faint' }, DB.notifications.length + ' recent')),
      React.createElement('div', { style: { maxHeight: 360, overflowY: 'auto' } },
        DB.notifications.map(n => React.createElement('button', {
          key: n.id, onClick: () => { setNotifOpen(false); go(n.screen); }, style: { display: 'flex', gap: 10, padding: '12px 14px', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer' },
        },
          React.createElement('span', { className: `sb ${n.sev === 'error' ? 'excluded' : n.sev}`, style: { flex: 'none', marginTop: 1 } }, React.createElement(Icon, { name: n.sev === 'safety' ? 'safety' : n.sev === 'warning' ? 'warning' : 'info', size: 11 })),
          React.createElement('div', { className: 'grow' },
            React.createElement('div', { className: 'fs13 fw6', style: { color: 'var(--ink-0)' } }, n.title),
            React.createElement('div', { className: 'fs12 muted mt4' }, n.detail),
            React.createElement('div', { className: 'fs11 faint mt4' }, n.ts))))));
  }

  // ---- Command palette ----
  function CommandPalette() {
    const { paletteOpen, setPaletteOpen, go, selectMember, members } = useStore();
    const [q, setQ] = useState('');
    const [idx, setIdx] = useState(0);
    useEffect(() => { if (paletteOpen) { setQ(''); setIdx(0); } }, [paletteOpen]);
    if (!paletteOpen) return null;
    const ql = q.toLowerCase();
    const results = [];
    ALL_ITEMS.forEach(it => { if (it.label.toLowerCase().includes(ql)) results.push({ type: 'Screen', label: it.label, icon: it.icon, action: () => go(it.id) }); });
    members.forEach(m => { if (m.name.toLowerCase().includes(ql)) results.push({ type: 'Member', label: m.name, icon: 'user', action: () => { selectMember(m.id); go('dashboard'); } }); });
    DB.exercises.forEach(e => { if (ql.length >= 2 && e.name.toLowerCase().includes(ql)) results.push({ type: 'Exercise', label: e.name, icon: 'dumbbell', action: () => go('exerciseDetail', { id: e.id }) }); });
    DB.scenarios.forEach(s => { if (ql.length >= 2 && s.name.toLowerCase().includes(ql)) results.push({ type: 'Scenario', label: s.name, icon: 'flask', action: () => go('eval') }); });
    const top = results.slice(0, 9);
    const run = i => { top[i]?.action(); setPaletteOpen(false); };
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'scrim', style: { background: 'rgba(0,0,0,.4)' }, onClick: () => setPaletteOpen(false) }),
      React.createElement('div', { style: { position: 'fixed', top: '14%', left: '50%', transform: 'translateX(-50%)', width: 'min(580px,94vw)', zIndex: 80 } },
        React.createElement('div', { className: 'card', style: { boxShadow: 'var(--sh-3)', overflow: 'hidden' } },
          React.createElement('div', { className: 'row gap10', style: { padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' } },
            React.createElement(Icon, { name: 'command', size: 17, style: { color: 'var(--ink-2)' } }),
            React.createElement('input', {
              className: 'input', autoFocus: true, value: q, placeholder: 'Search members, screens, exercises, scenarios…',
              style: { border: 'none', background: 'none', padding: 0, fontSize: 15 },
              onChange: e => { setQ(e.target.value); setIdx(0); },
              onKeyDown: e => { if (e.key === 'ArrowDown') setIdx(i => Math.min(i + 1, top.length - 1)); if (e.key === 'ArrowUp') setIdx(i => Math.max(i - 1, 0)); if (e.key === 'Enter') run(idx); },
            })),
          React.createElement('div', { style: { maxHeight: 380, overflowY: 'auto', padding: 6 } },
            top.length === 0 ? React.createElement('div', { className: 'fs13 faint', style: { padding: 24, textAlign: 'center' } }, 'No matches')
              : top.map((r, i) => React.createElement('button', {
                key: i, className: 'nav-item', style: { width: '100%', background: i === idx ? 'var(--bg-3)' : 'transparent' }, onMouseEnter: () => setIdx(i), onClick: () => run(i),
              },
                React.createElement(Icon, { name: r.icon, size: 16 }),
                React.createElement('span', { className: 'grow', style: { textAlign: 'left' } }, r.label),
                React.createElement('span', { className: 'fs11 faint' }, r.type)))))));
  }

  // ---- Shortcuts modal ----
  function ShortcutsModal({ onClose }) {
    const rows = [['⌘K', 'Command palette'], ['/', 'Focus chat composer'], ['?', 'This help'], ['g then d', 'Go to dashboard'], ['g then c', 'Coach console'], ['g then g', 'Graph explorer'], ['g then m', 'Members'], ['⌘↵', 'Send message'], ['Esc', 'Close panel']];
    return React.createElement(Modal, { title: 'Keyboard shortcuts', onClose },
      React.createElement('div', { className: 'col gap8' },
        rows.map((r, i) => React.createElement('div', { key: i, className: 'row between', style: { padding: '4px 0' } },
          React.createElement('span', { className: 'fs13' }, r[1]), React.createElement('span', { className: 'kbd' }, r[0])))));
  }

  // ---- Onboarding ----
  function Onboarding() {
    const { onboard, setOnboard, go, toast } = useStore();
    if (!onboard) return null;
    const close = () => { setOnboard(false); localStorage.setItem('future_onboard_done', '1'); };
    const cards = [
      ['Seed demo members', 'Load 4 synthetic members with goals, injuries, equipment & history.', 'members', 'dashboard'],
      ['Walk me through a scenario', 'Knee-injury member → lower-body session → why-skipped explanation.', 'play', 'demo'],
      ['Open empty & ingest manually', 'Start from a thin graph and add facts yourself.', 'ingest', 'ingest'],
    ];
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'scrim' }),
      React.createElement('div', { className: 'modal' },
        React.createElement('div', { className: 'modal-card wide glow', onClick: e => e.stopPropagation(), style: { padding: 34 } },
          React.createElement('div', { className: 'row gap10 mb8' }, React.createElement('div', { className: 'logo', style: { width: 30, height: 30, borderRadius: 9, background: 'var(--grad)' } }),
            React.createElement('span', { className: 'sec-title' }, 'Welcome to Future Coach Intelligence')),
          React.createElement('h1', { style: { fontSize: 30, maxWidth: 560 } }, 'Injury-aware coaching, ', React.createElement('span', { className: 'grad-text' }, 'explained by the graph.')),
          React.createElement('p', { className: 'page-sub', style: { maxWidth: 540 } }, 'Every recommendation traces back to member facts, graph relationships, and the safety policy that fired. Pick a starting point.'),
          React.createElement('div', { className: 'grid g3 mt24' },
            cards.map((c, i) => React.createElement('button', {
              key: i, className: 'card', onClick: () => { close(); go(c[3]); toast({ title: c[0] + ' →', sev: 'success' }); },
              style: { padding: 18, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-2)' },
            },
              React.createElement('div', { style: { width: 38, height: 38, borderRadius: 11, background: 'var(--grad-soft)', display: 'grid', placeItems: 'center', marginBottom: 12 } }, React.createElement(Icon, { name: c[2], size: 19, style: { color: 'var(--accent-ink)' } })),
              React.createElement('div', { className: 'fw7 fs15 mb4' }, c[0]),
              React.createElement('div', { className: 'fs12 muted' }, c[1])))),
          React.createElement('div', { className: 'row gap16 mt24', style: { color: 'var(--ink-2)', fontSize: 12.5, flexWrap: 'wrap' } },
            'Find your way around:',
            React.createElement('span', { className: 'link', onClick: () => { close(); go('console'); } }, 'Coach Console'),
            React.createElement('span', { className: 'link', onClick: () => { close(); go('graph'); } }, 'Graph Explorer'),
            React.createElement('span', { className: 'link', onClick: () => { close(); go('harness'); } }, 'Comparison Harness'),
            React.createElement('span', { className: 'link', onClick: () => { close(); go('tradeoffs'); } }, 'Tradeoffs')),
          React.createElement('div', { className: 'row between mt20' },
            React.createElement('span', { className: 'fs12 faint' }, 'Synthetic data only · re-open from the help menu anytime'),
            React.createElement(Btn, { variant: 'ghost', onClick: close }, 'Skip for now')))));
  }

  // ---- Router ----
  function Router() {
    const { screen } = useStore();
    const map = {
      dashboard: window.MemberDashboard, console: window.CoachConsole, graph: window.GraphExplorer,
      library: window.ExerciseLibrary, exerciseDetail: window.ExerciseDetail, ingest: window.Ingestion,
      members: window.MembersScreen, contextEditor: window.ContextEditor, recDetail: window.RecommendationDetail,
      weekly: window.WeeklyProgramming, history: window.HistoryTimeline, sessions: window.SessionsScreen,
      eval: window.EvalScreen, harness: window.ComparisonHarness, demo: window.DemoWalkthrough,
      trace: window.SystemTrace, cost: window.CostDashboard, schema: window.SchemaReference,
      prompt: window.PromptInspector, safety: window.SafetyPolicy, api: window.ApiExplorer,
      settings: window.SettingsScreen, tradeoffs: window.Tradeoffs,
      agent: window.AgentConsole, topology: window.StateGraphTopology, memory: window.MemoryInspector, maDemo: window.MaDemo,
    };
    const Comp = map[screen];
    if (!Comp) return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(EmptyState, { icon: 'sparkle', title: TITLES[screen] || screen, sub: 'This screen is being assembled.' })));
    return React.createElement(Comp, { key: screen });
  }

  function App() {
    const { navCollapsed, setNavCollapsed, drawer, modal, setModal, closeDrawer } = useStore();
    useEffect(() => { const f = () => setNavCollapsed(c => !c); window.addEventListener('toggle-nav', f); return () => window.removeEventListener('toggle-nav', f); }, []);
    return React.createElement('div', { className: `app ${navCollapsed ? 'nav-collapsed' : ''}` },
      React.createElement(Sidebar),
      React.createElement('div', { className: 'main' },
        React.createElement('div', { className: 'synthetic-banner' }, React.createElement('span', { className: 'dot' }), 'SYNTHETIC DATA — do not enter real member information'),
        React.createElement(Topbar),
        React.createElement(Router)),
      React.createElement(window.ToastHost),
      React.createElement(CommandPalette),
      React.createElement(Onboarding),
      drawer && window.DrawerRouter && React.createElement(window.DrawerRouter, { drawer, onClose: closeDrawer }),
      modal?.type === 'shortcuts' && React.createElement(ShortcutsModal, { onClose: () => setModal(null) }),
      modal && window.ModalRouter && React.createElement(window.ModalRouter, { modal, onClose: () => setModal(null) }));
  }

  window.FutureApp = App;
})();
