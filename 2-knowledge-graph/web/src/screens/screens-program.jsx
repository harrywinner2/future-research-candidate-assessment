/* FUTURE — Weekly Programming, History & Adherence Timeline, Conversations. */
(function () {
  const { useState, useMemo } = React;
  const Icon = window.Icon, DB = window.DB, ENGINE = window.ENGINE;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Avatar, Card, MetaPanel, PageHead, Stat, EmptyState, AdherenceDot, useCopy, VersionFooter } = window;

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ---------- Weekly Programming ----------
  function WeeklyProgramming() {
    const { member, toast, go, openDrawer } = useStore();
    const [week, setWeek] = useState(() => defaultWeek(member));
    const [locked, setLocked] = useState({});
    const [dragIdx, setDragIdx] = useState(null);

    const regen = () => { setWeek(w => w.map((d, i) => locked[i] || d.type === 'rest' ? d : { ...defaultWeek(member)[i] })); toast({ title: 'Week generated', detail: 'Locked sessions preserved.', sev: 'success' }); };
    const cascadeSafer = () => { setWeek(w => w.map(d => d.type === 'rest' ? d : { ...d, safety: d.safety === 'blocked' ? 'caution' : d.safety, focus: d.focus })); toast({ title: 'Cascaded safer', detail: 'Elevated conservatism on unlocked future sessions.', sev: 'safety' }); };

    const volume = useMemo(() => computeVolume(week, member), [week, member]);

    const onDrop = (i) => { if (dragIdx == null || dragIdx === i) return; setWeek(w => { const n = [...w]; const [m] = n.splice(dragIdx, 1); n.splice(i, 0, m); return n; }); setDragIdx(null); };

    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'Weekly Programming', sub: member.name + ' · microcycle · drag to reorder, lock to protect' },
        React.createElement(Btn, { icon: 'swap2', onClick: () => toast({ title: 'Comparing to last week', detail: 'Highlighting volume & exclusion deltas.', sev: 'info' }) }, 'Compare to last week'),
        React.createElement(Btn, { icon: 'safety', onClick: cascadeSafer }, 'Cascade safer'),
        React.createElement(Btn, { variant: 'primary', icon: 'sparkle', onClick: regen }, 'Generate week')),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' } },
        React.createElement('div', null,
          React.createElement('div', { className: 'grid', style: { gridTemplateColumns: 'repeat(7,1fr)', gap: 10 } },
            week.map((d, i) => React.createElement('div', {
              key: i, draggable: true, onDragStart: () => setDragIdx(i), onDragOver: e => e.preventDefault(), onDrop: () => onDrop(i),
              className: 'card', style: { padding: 12, minHeight: 150, cursor: 'grab', opacity: dragIdx === i ? .4 : 1, borderColor: locked[i] ? 'var(--accent)' : 'var(--line-soft)' },
            },
              React.createElement('div', { className: 'row between mb8' },
                React.createElement('span', { className: 'fs11 fw7 faint' }, DAYS[i]),
                React.createElement(IconBtn, { icon: 'lock', size: 'sm', title: locked[i] ? 'Unlock' : 'Lock day', onClick: () => setLocked(l => ({ ...l, [i]: !l[i] })), style: { opacity: locked[i] ? 1 : .4 } })),
              d.type === 'rest' ? React.createElement('div', { className: 'col center', style: { justifyContent: 'center', height: 100, color: 'var(--ink-3)' } }, React.createElement(Icon, { name: 'heart', size: 20 }), React.createElement('span', { className: 'fs11 mt8' }, d.deload ? 'Deload' : 'Rest'))
                : React.createElement('div', null,
                  React.createElement('div', { className: 'fw7 fs13 mb4', style: { textTransform: 'capitalize' } }, d.focus),
                  React.createElement('div', { className: 'fs11 faint mb8' }, d.dur + ' min · ' + d.equip),
                  React.createElement('div', { className: 'mb8' }, React.createElement(SafetyBadge, { state: d.safety })),
                  React.createElement('div', { className: 'col gap4' }, d.key.map((k, j) => React.createElement('div', { key: j, className: 'fs11 muted', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, '· ' + k))),
                  React.createElement('div', { className: 'row gap4 mt8' },
                    React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'swap', onClick: () => toast({ title: 'Swap session', detail: 'Pick lower / upper / recovery / full.', sev: 'info' }) }, 'Swap'),
                    React.createElement(Btn, { size: 'xs', variant: 'ghost', onClick: () => go('console', { prompt: `Build the ${d.focus} session for ${DAYS[i]}.`, autostart: false }) }, 'Open')))))),
          React.createElement('div', { className: 'card mt16', style: { padding: 14 } },
            React.createElement('div', { className: 'sec-title mb12' }, 'Adherence — past 4 weeks'),
            React.createElement('div', { className: 'row gap16 wrap' }, ['Wk -3', 'Wk -2', 'Wk -1', 'This wk'].map((w, i) => React.createElement('div', { key: i, className: 'row gap6 center' },
              React.createElement('span', { className: 'fs11 faint', style: { width: 42 } }, w),
              DAYS.map((_, d) => React.createElement('span', { key: d, style: { width: 11, height: 11, borderRadius: 3, background: i === 3 && d > 1 ? 'var(--bg-3)' : ['var(--safe)', 'var(--safe)', 'var(--caution)', 'var(--danger)', 'var(--safe)', 'var(--bg-3)', 'var(--bg-3)'][d] } })))))),
        ),
        React.createElement('div', { className: 'col gap16' },
          React.createElement(MetaPanel, { title: 'Volume vs safety budget', icon: 'safety' },
            React.createElement('div', { className: 'col gap12' }, volume.joints.map(j => React.createElement('div', { key: j.joint },
              React.createElement('div', { className: 'row between fs12 mb4' }, React.createElement('span', { className: 'muted' }, 'Loads ' + j.joint), React.createElement('span', { className: 'mono', style: { color: j.over ? 'var(--danger)' : 'var(--ink-1)' } }, j.count + ' / ' + j.budget)),
              React.createElement('div', { style: { height: 6, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' } }, React.createElement('div', { style: { height: '100%', width: Math.min(100, j.count / j.budget * 100) + '%', background: j.over ? 'var(--danger)' : 'var(--grad)' } })),
              j.over && React.createElement('div', { className: 'fs11 mt4', style: { color: 'var(--danger)' } }, 'Over budget — reduce ' + j.joint + ' load'))))),
          React.createElement(MetaPanel, { title: 'Movement-pattern balance', icon: 'activity' },
            React.createElement('div', { className: 'col gap6' }, volume.patterns.map(p => React.createElement('div', { key: p.pattern, className: 'row between fs12' },
              React.createElement('span', { className: 'muted' }, p.pattern), React.createElement('span', { className: 'mono' }, '×' + p.count)))),
            volume.imbalance && React.createElement('div', { className: 'card mt12', style: { padding: 10, background: 'var(--caution-bg)' } }, React.createElement('span', { className: 'fs12', style: { color: 'var(--caution)' } }, React.createElement(Icon, { name: 'warning', size: 12 }), ' ' + volume.imbalance)))),
      ),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }
  function defaultWeek(member) {
    const knee = member.injuries?.some(i => i.joint === 'knee' && i.status !== 'resolved');
    return [
      { type: 'session', focus: 'lower body', dur: 50, equip: 'dumbbell', safety: knee ? 'caution' : 'safe', key: ['Glute Bridge', 'RDL', 'Step-Up'] },
      { type: 'session', focus: 'upper push', dur: 45, equip: 'dumbbell', safety: 'safe', key: ['DB Bench', 'OHP', 'Lateral Raise'] },
      { type: 'rest' },
      { type: 'session', focus: 'conditioning', dur: 30, equip: 'rowing machine', safety: 'safe', key: ['Rowing Machine', 'Plank'] },
      { type: 'session', focus: 'upper pull', dur: 45, equip: 'pull-up bar', safety: 'safe', key: ['Lat Pulldown', 'Cable Row', 'Face Pull'] },
      { type: 'session', focus: 'mobility', dur: 25, equip: 'yoga mat', safety: 'safe', key: ['Cat-Cow', '90/90 Hip'] },
      { type: 'rest', deload: false },
    ];
  }
  function computeVolume(week, member) {
    const knee = member.injuries?.some(i => i.joint === 'knee' && i.status !== 'resolved');
    return {
      joints: [
        { joint: 'knee', count: knee ? 4 : 6, budget: knee ? 3 : 10, over: knee },
        { joint: 'lumbar spine', count: 2, budget: 4, over: false },
        { joint: 'shoulder', count: 5, budget: 8, over: false },
      ],
      patterns: [{ pattern: 'horizontal push', count: 3 }, { pattern: 'hip hinge', count: 2 }, { pattern: 'horizontal pull', count: 3 }, { pattern: 'squat', count: 1 }],
      imbalance: null,
    };
  }

  // ---------- History & Adherence Timeline ----------
  function HistoryTimeline() {
    const { member, go, toast } = useStore();
    const history = useMemo(() => DB.historyFor(member), [member]);
    const [filter, setFilter] = useState('all');
    const filtered = filter === 'all' ? history : history.filter(h => filter === 'complaint' ? h.complaints.length : h.adherence === filter);
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'History & Adherence', sub: member.name + ' · longitudinal session signals' }),
      React.createElement('div', { className: 'card mb20', style: { padding: 16 } },
        React.createElement('div', { className: 'sec-title mb12' }, '12-week adherence heatmap'),
        React.createElement('div', { className: 'row gap4 wrap' }, Array.from({ length: 84 }, (_, i) => {
          const r = (i * 37) % 100; const c = r < 8 ? 'var(--bg-3)' : r < 22 ? 'var(--danger)' : r < 42 ? 'var(--caution)' : 'var(--safe)';
          return React.createElement('span', { key: i, title: 'day ' + (i + 1), style: { width: 13, height: 13, borderRadius: 3, background: c } });
        })),
        React.createElement('div', { className: 'row gap16 mt12 fs11 faint' }, ['completed', 'partial', 'missed', 'rest'].map((l, i) => React.createElement('span', { key: l, className: 'row gap6 center' }, React.createElement('span', { style: { width: 10, height: 10, borderRadius: 3, background: ['var(--safe)', 'var(--caution)', 'var(--danger)', 'var(--bg-3)'][i] } }), l)))),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' } },
        React.createElement('div', null,
          React.createElement('div', { className: 'row gap6 mb12 wrap' }, [['all', 'All'], ['completed', 'Completed'], ['missed', 'Missed'], ['complaint', 'Has complaint']].map(f => React.createElement('button', { key: f[0], className: `pill-tab ${filter === f[0] ? 'active' : ''}`, onClick: () => setFilter(f[0]) }, f[1]))),
          React.createElement('div', { className: 'col gap10' }, filtered.map((h, i) => React.createElement('div', { key: i, className: 'card', style: { padding: 14 } },
            React.createElement('div', { className: 'row gap12 center mb8' },
              React.createElement(AdherenceDot, { status: h.adherence }),
              React.createElement('span', { className: 'fw7 fs14' }, h.focus),
              React.createElement('span', { className: 'fs12 faint mono' }, h.date),
              React.createElement('div', { className: 'grow' }),
              React.createElement('span', { className: 'chip', style: { fontSize: 10 } }, h.source)),
            h.complaints.length > 0 && React.createElement('div', { className: 'card mb8', style: { padding: 9, background: 'var(--caution-bg)' } }, React.createElement('span', { className: 'fs12', style: { color: 'var(--caution)' } }, React.createElement(Icon, { name: 'warning', size: 12 }), ' ' + h.complaints[0])),
            React.createElement('div', { className: 'row gap6 wrap' },
              React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'sessions', onClick: () => toast({ title: 'Replaying context snapshot', detail: 'Graph as it stood when this session generated.', sev: 'info' }) }, 'Replay context'),
              h.complaints.length > 0 && React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'ingest', onClick: () => { toast({ title: 'Promoted to context signal', detail: 'Knee-irritation signal strengthened in graph.', sev: 'success' }); } }, 'Promote to signal'),
              React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'swap2', onClick: () => toast({ title: 'Planned vs performed', sev: 'info' }) }, 'Compare to plan'),
              h.source !== 'manual entry' && React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'console', onClick: () => go('console') }, 'Open conversation'))))),
        ),
        React.createElement('div', { className: 'col gap16' },
          React.createElement(MetaPanel, { title: 'Aggregate', icon: 'activity' },
            React.createElement('div', { className: 'grid g2', style: { gap: 14 } },
              React.createElement(Stat, { v: member.adherence ? Math.round(member.adherence * 100) + '%' : '—', k: 'Adherence' }),
              React.createElement(Stat, { v: history.filter(h => h.adherence === 'missed').length, k: 'Missed (6 wk)' }))),
          React.createElement(MetaPanel, { title: 'Complaint frequency by joint', icon: 'bone' },
            (member.injuries || []).filter(i => i.status !== 'resolved').length ? React.createElement('div', { className: 'col gap8' },
              member.injuries.filter(i => i.status !== 'resolved').map(i => React.createElement('div', { key: i.id },
                React.createElement('div', { className: 'row between fs12 mb4' }, React.createElement('span', { className: 'muted' }, i.joint), React.createElement('span', { className: 'mono faint' }, 'fading')),
                React.createElement('div', { style: { height: 6, borderRadius: 4, background: 'var(--bg-3)' } }, React.createElement('div', { style: { height: '100%', width: '60%', background: 'var(--caution)', borderRadius: 4, opacity: .6 } })),
                React.createElement('div', { className: 'fs11 faint mt4' }, 'Signal decays after ' + DB.safetyPolicy.fadeDays + ' days without recurrence'))))
              : React.createElement('div', { className: 'fs12 muted' }, 'No complaints logged.')),
          history.filter(h => h.adherence === 'missed').length >= 1 && React.createElement('div', { className: 'card', style: { padding: 12, background: 'var(--info-bg)' } },
            React.createElement('div', { className: 'fs12', style: { color: 'var(--ink-1)' } }, React.createElement(Icon, { name: 'info', size: 13, style: { color: 'var(--info)' } }), ' Recent missed sessions — next recommendation biases toward lower volume.'))),
      )));
  }

  // ---------- Conversations / Sessions ----------
  function SessionsScreen() {
    const { member, go, toast } = useStore();
    const copy = useCopy();
    const sessions = DB.sessions.filter(s => s.member === member.id);
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Conversations', sub: member.name + ' · multi-turn coaching sessions with memory' },
        React.createElement(window.Search, { value: '', onChange: () => {}, placeholder: 'Search transcripts…', style: { width: 240 } })),
      sessions.length === 0 ? React.createElement(Card, { pad: true }, React.createElement(EmptyState, { icon: 'note', title: 'No conversations yet', sub: 'Open the Coach Console and start a session — it will appear here with full memory.', action: React.createElement(Btn, { variant: 'primary', onClick: () => go('console') }, 'Open console') }))
        : React.createElement('div', { className: 'col gap10' }, sessions.map(s => React.createElement('div', { key: s.id, className: 'card', style: { padding: 16 } },
          React.createElement('div', { className: 'row gap10 center mb8' },
            s.pinned && React.createElement(Icon, { name: 'pin', size: 14, style: { color: 'var(--accent)' } }),
            React.createElement('span', { className: 'fw7 fs15' }, s.title),
            React.createElement('div', { className: 'grow' }),
            React.createElement('span', { className: `sb ${s.outcome === 'approved' ? 'safe' : s.outcome === 'edited' ? 'info' : 'missing'}` }, s.outcome)),
          React.createElement('div', { className: 'fs12 muted mb12' }, '“' + s.last + '”'),
          React.createElement('div', { className: 'row between' },
            React.createElement('div', { className: 'row gap16 fs11 faint' }, React.createElement('span', null, s.start), React.createElement('span', null, s.msgs + ' messages'), React.createElement('span', null, s.recs + ' recommendations')),
            React.createElement('div', { className: 'row gap6' },
              React.createElement(Btn, { size: 'xs', variant: 'primary', icon: 'play', onClick: () => { toast({ title: 'Resumed session', detail: 'Memory restored.', sev: 'success' }); go('console'); } }, 'Resume'),
              React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'swap2', onClick: () => toast({ title: 'Forked session', sev: 'info' }) }, 'Fork'),
              React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'export', onClick: () => copy(s, 'Transcript exported') }, 'Export'))),
          s.pinned && React.createElement('div', { className: 'card mt12', style: { padding: 9, background: 'var(--info-bg)' } }, React.createElement('span', { className: 'fs11', style: { color: 'var(--info)' } }, React.createElement(Icon, { name: 'info', size: 11 }), ' Context drift: knee injury severity changed since this session started.')))))));
  }

  Object.assign(window, { WeeklyProgramming, HistoryTimeline, SessionsScreen });
})();
