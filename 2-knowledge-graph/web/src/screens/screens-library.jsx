/* FUTURE — Exercise Library, Exercise Detail, Modal router. */
(function () {
  const { useState, useMemo } = React;
  const Icon = window.Icon, DB = window.DB, ENGINE = window.ENGINE;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Card, MetaPanel, PageHead, Search, EmptyState, Modal, Field, useCopy, ExChips, VersionFooter } = window;

  function ExerciseLibrary() {
    const { member, go, openDrawer, toast } = useStore();
    const copy = useCopy();
    const [q, setQ] = useState('');
    const [view, setView] = useState('grid');
    const [sort, setSort] = useState('name');
    const [memberAware, setMemberAware] = useState(true);
    const [filters, setFilters] = useState({ muscle: [], joint: [], pattern: [], equip: [] });
    const toggle = (cat, v) => setFilters(f => ({ ...f, [cat]: f[cat].includes(v) ? f[cat].filter(x => x !== v) : [...f[cat], v] }));

    const list = useMemo(() => {
      let l = DB.exercises.filter(e => {
        if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (filters.muscle.length && !filters.muscle.some(m => e.muscle_groups.includes(m))) return false;
        if (filters.joint.length && !filters.joint.some(j => e.joints_loaded.includes(j))) return false;
        if (filters.pattern.length && !filters.pattern.some(p => e.movement_patterns.includes(p))) return false;
        if (filters.equip.length && !filters.equip.some(eq => e.equipment_required.includes(eq))) return false;
        return true;
      });
      if (sort === 'name') l = [...l].sort((a, b) => a.name.localeCompare(b.name));
      if (sort === 'tier') l = [...l].sort((a, b) => a.priority_tier - b.priority_tier);
      if (sort === 'equip') l = [...l].sort((a, b) => a.equipment_required.length - b.equipment_required.length);
      if (sort === 'safety' && memberAware) { const ord = { safe: 0, caution: 1, missing: 2, excluded: 3 }; l = [...l].sort((a, b) => ord[DB.evalExerciseForMember(a, member).state] - ord[DB.evalExerciseForMember(b, member).state]); }
      return l;
    }, [q, filters, sort, member, memberAware]);

    const FilterGroup = ({ label, cat, opts, kind }) => React.createElement('div', { className: 'mb16' },
      React.createElement('div', { className: 'fs11 fw7 faint mb8' }, label),
      React.createElement('div', { className: 'row wrap gap6' }, opts.map(o => React.createElement(Chip, { key: o, kind, onClick: () => toggle(cat, o), active: filters[cat].includes(o) }, o))));

    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad wide' },
      React.createElement(PageHead, { title: 'Exercise Library', sub: DB.exercises.length + ' exercises · safety evaluated for ' + member.name },
        React.createElement('div', { className: 'tabs' }, React.createElement('button', { className: `tab ${view === 'grid' ? 'active' : ''}`, onClick: () => setView('grid') }, React.createElement(Icon, { name: 'grid', size: 14 })),
          React.createElement('button', { className: `tab ${view === 'table' ? 'active' : ''}`, onClick: () => setView('table') }, React.createElement(Icon, { name: 'list', size: 14 })))),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '232px 1fr', gap: 20, alignItems: 'start' } },
        React.createElement('div', { className: 'card', style: { padding: 16, position: 'sticky', top: 16 } },
          React.createElement(Search, { value: q, onChange: setQ, placeholder: 'Search exercises…' }),
          React.createElement('label', { className: 'row between mt16 mb16', style: { cursor: 'pointer' } },
            React.createElement('span', { className: 'fs12 fw6' }, 'Member-aware safety'), React.createElement(window.Switch, { on: memberAware, onClick: () => setMemberAware(s => !s) })),
          React.createElement(Field, { label: 'Sort by' }, React.createElement('select', { className: 'select', value: sort, onChange: e => setSort(e.target.value) },
            React.createElement('option', { value: 'name' }, 'Name'), React.createElement('option', { value: 'tier' }, 'Priority tier'), React.createElement('option', { value: 'equip' }, 'Equipment count'), React.createElement('option', { value: 'safety' }, 'Safety for member'))),
          React.createElement('div', { className: 'divider' }),
          React.createElement(FilterGroup, { label: 'MUSCLE GROUPS', cat: 'muscle', opts: DB.muscleList, kind: 'muscle' }),
          React.createElement(FilterGroup, { label: 'JOINTS LOADED', cat: 'joint', opts: DB.jointList, kind: 'joint' }),
          React.createElement(FilterGroup, { label: 'MOVEMENT PATTERNS', cat: 'pattern', opts: DB.patternList, kind: 'pattern' }),
          React.createElement(FilterGroup, { label: 'EQUIPMENT', cat: 'equip', opts: DB.equipList, kind: 'equip' })),
        React.createElement('div', null,
          React.createElement('div', { className: 'row between mb12' }, React.createElement('span', { className: 'fs13 muted' }, list.length + ' exercises'),
            (filters.muscle.length || filters.joint.length || filters.pattern.length || filters.equip.length) ? React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'close', onClick: () => setFilters({ muscle: [], joint: [], pattern: [], equip: [] }) }, 'Clear filters') : null),
          list.length === 0 ? React.createElement(Card, { pad: true }, React.createElement(EmptyState, { icon: 'search', title: 'No exercises match', sub: 'No exercises match these filters. Relax a filter to see more results.', action: React.createElement(Btn, { size: 'sm', onClick: () => setFilters({ muscle: [], joint: [], pattern: [], equip: [] }) }, 'Clear filters') }))
            : view === 'grid' ? React.createElement('div', { className: 'grid g3' }, list.map(e => React.createElement(ExCard, { key: e.id, ex: e, member, memberAware, go, openDrawer, toast })))
              : React.createElement(ExTable, { list, member, memberAware, go })))));
  }

  function ExCard({ ex, member, memberAware, go, openDrawer, toast }) {
    const ev = memberAware ? DB.evalExerciseForMember(ex, member) : null;
    const missing = ex.joints_loaded.length === 0 && !ex.movement_patterns.includes('rotation') && !ex.movement_patterns.includes('isometric') && !ex.movement_patterns.includes('mobility');
    return React.createElement('div', { className: 'card', style: { padding: 14, cursor: 'pointer' }, onClick: () => go('exerciseDetail', { id: ex.id }) },
      React.createElement('div', { className: 'row between mb8', style: { alignItems: 'flex-start' } },
        React.createElement('div', { className: 'grow' }, React.createElement('div', { className: 'fw7 fs14', style: { color: 'var(--ink-0)' } }, ex.name),
          React.createElement('div', { className: 'fs11 faint mono mt4' }, ex.id + ' · tier ' + ex.priority_tier)),
        ev && React.createElement(SafetyBadge, { state: missing ? 'missing' : ev.state })),
      React.createElement('div', { className: 'mb8' }, React.createElement(ExChips, { ex, show: ['muscle', 'joint'] })),
      ev && ev.state !== 'safe' && React.createElement('div', { className: 'fs11 mb8', style: { color: ev.state === 'excluded' ? 'var(--danger)' : 'var(--caution)' } }, ev.reasons[0]),
      React.createElement('div', { className: 'row gap6 fs11 faint' },
        ex.supports_weight && React.createElement('span', { className: 'chip', style: { fontSize: 10 } }, 'weighted'),
        ex.is_reps && React.createElement('span', { className: 'chip', style: { fontSize: 10 } }, 'reps'),
        ex.is_duration && React.createElement('span', { className: 'chip', style: { fontSize: 10 } }, 'duration'),
        ex.is_bilateral && React.createElement('span', { className: 'chip', style: { fontSize: 10 } }, ex.side ? 'bilateral · ' + ex.side : 'bilateral')),
      React.createElement('div', { className: 'row gap6 mt12', onClick: e => e.stopPropagation() },
        React.createElement(Btn, { size: 'xs', variant: 'subtle', icon: 'plus', onClick: () => ev && ev.state === 'excluded' ? toast({ title: 'Blocked: ' + ev.reasons[0], sev: 'warning' }) : toast({ title: 'Added to draft workout', sev: 'success' }) }, 'Use'),
        React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'swap', onClick: () => openDrawer('swap', { ex, member }) }, 'Alternatives'),
        React.createElement(Btn, { size: 'xs', variant: 'ghost', icon: 'graph', onClick: () => go('graph') }, 'Graph')));
  }

  function ExTable({ list, member, memberAware, go }) {
    return React.createElement('div', { className: 'card', style: { overflow: 'hidden' } },
      React.createElement('div', { style: { overflowX: 'auto' } },
        React.createElement('table', { className: 'tbl' },
          React.createElement('thead', null, React.createElement('tr', null, ['Name', 'Muscles', 'Joints', 'Equipment', 'Pattern', 'Support', memberAware ? 'Safety' : ''].filter(Boolean).map(h => React.createElement('th', { key: h }, h)))),
          React.createElement('tbody', null, list.map(e => {
            const ev = memberAware ? DB.evalExerciseForMember(e, member) : null;
            return React.createElement('tr', { key: e.id, className: 'clickable', onClick: () => go('exerciseDetail', { id: e.id }) },
              React.createElement('td', null, React.createElement('span', { className: 'name' }, e.name), React.createElement('div', { className: 'fs11 faint mono' }, e.id)),
              React.createElement('td', null, e.muscle_groups.slice(0, 2).join(', ')),
              React.createElement('td', null, e.joints_loaded.join(', ') || React.createElement('span', { className: 'faint' }, '—')),
              React.createElement('td', null, e.equipment_required.join(', ')),
              React.createElement('td', null, e.movement_patterns.join(', ')),
              React.createElement('td', null, React.createElement('span', { className: 'fs11 mono faint' }, [e.supports_weight && 'wt', e.is_reps && 'reps', e.is_duration && 'dur'].filter(Boolean).join(' · '))),
              memberAware && React.createElement('td', null, React.createElement(SafetyBadge, { state: ev.state })));
          })))));
  }

  // ---------- Exercise Detail ----------
  function ExerciseDetail() {
    const { route, member, go, openDrawer, toast } = useStore();
    const copy = useCopy();
    const ex = DB.exById[route.exerciseDetail?.id] || DB.exercises[0];
    const ev = DB.evalExerciseForMember(ex, member);
    const pair = ex.bilateral_pair_id ? DB.exById[ex.bilateral_pair_id] : null;
    const related = useMemo(() => DB.exercises.filter(e => e.id !== ex.id && (e.muscle_groups.some(m => ex.muscle_groups.includes(m)) || e.movement_patterns.some(p => ex.movement_patterns.includes(p)))).slice(0, 6), [ex]);
    const repSec = ex.est_rep_seconds;
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement('div', { className: 'row gap8 center mb20' },
        React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'chevLeft', onClick: () => go('library') }, 'Library'),
        React.createElement('h1', { className: 'page-title' }, ex.name),
        React.createElement('span', { className: 'mono fs12 faint' }, ex.id),
        React.createElement(SafetyBadge, { state: ev.state })),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' } },
        React.createElement('div', { className: 'col gap20' },
          React.createElement(MetaPanel, { title: 'Classification', icon: 'library' },
            React.createElement('div', { className: 'grid g2', style: { gap: 16 } },
              React.createElement(DetailRow, { k: 'Muscles trained', node: React.createElement('div', { className: 'row wrap gap6' }, ex.muscle_groups.map(m => React.createElement(Chip, { key: m, kind: 'muscle' }, m))) }),
              React.createElement(DetailRow, { k: 'Joints loaded', node: ex.joints_loaded.length ? React.createElement('div', { className: 'row wrap gap6' }, ex.joints_loaded.map(j => React.createElement(Chip, { key: j, kind: 'joint', icon: 'bone' }, j))) : React.createElement(SafetyBadge, { state: 'missing' }) }),
              React.createElement(DetailRow, { k: 'Movement patterns', node: React.createElement('div', { className: 'row wrap gap6' }, ex.movement_patterns.map(p => React.createElement(Chip, { key: p, kind: 'pattern' }, p))) }),
              React.createElement(DetailRow, { k: 'Equipment', node: React.createElement('div', { className: 'row wrap gap6' }, ex.equipment_required.map(e => React.createElement(Chip, { key: e, kind: 'equip' }, e))) }))),
          React.createElement(MetaPanel, { title: 'Programming support', icon: 'bolt' },
            React.createElement('div', { className: 'grid g4', style: { gap: 12 } },
              React.createElement(SupportBox, { on: ex.supports_weight, label: 'Weight' }),
              React.createElement(SupportBox, { on: ex.is_reps, label: 'Reps' }),
              React.createElement(SupportBox, { on: ex.is_duration, label: 'Duration' }),
              React.createElement(SupportBox, { on: ex.is_bilateral, label: 'Bilateral' })),
            React.createElement('div', { className: 'divider' }),
            React.createElement('div', { className: 'row gap24 fs13' },
              React.createElement('div', null, React.createElement('span', { className: 'faint' }, 'Priority tier · '), 'Tier ' + ex.priority_tier),
              repSec && React.createElement('div', null, React.createElement('span', { className: 'faint' }, 'Est. rep duration · '), repSec + 's'),
              ex.side && React.createElement('div', null, React.createElement('span', { className: 'faint' }, 'Side · '), ex.side))),
          React.createElement(MetaPanel, { title: 'Related exercises', icon: 'grid' },
            React.createElement('div', { className: 'grid g2', style: { gap: 10 } }, related.map(r => React.createElement('button', { key: r.id, className: 'card', style: { padding: 10, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-2)' }, onClick: () => go('exerciseDetail', { id: r.id }) },
              React.createElement('div', { className: 'row between' }, React.createElement('span', { className: 'fw6 fs13' }, r.name), React.createElement(SafetyBadge, { state: DB.evalExerciseForMember(r, member).state })),
              React.createElement('div', { className: 'fs11 faint mt4' }, r.muscle_groups.slice(0, 2).join(', '))))))),
        React.createElement('div', { className: 'col gap16' },
          React.createElement(MetaPanel, { title: 'Safety for ' + member.name.split(' ')[0], icon: 'safety' },
            React.createElement('div', { className: 'mb8' }, React.createElement(SafetyBadge, { state: ev.state })),
            ev.reasons.length ? React.createElement('div', { className: 'col gap6' }, ev.reasons.map((r, i) => React.createElement('div', { key: i, className: 'fs12', style: { color: ev.state === 'excluded' ? 'var(--danger)' : 'var(--caution)' } }, '· ' + r)))
              : React.createElement('div', { className: 'fs12 muted' }, 'No conflicts with member injuries or equipment.'),
            ev.state !== 'safe' && React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'why', className: 'mt12', onClick: () => openDrawer('why', { kind: 'skipped', ex, member }) }, 'Why excluded')),
          React.createElement(MetaPanel, { title: 'Actions', icon: 'bolt' },
            React.createElement('div', { className: 'col gap8' },
              React.createElement(Btn, { variant: ev.state === 'excluded' ? '' : 'primary', icon: 'plus', disabled: false, onClick: () => ev.state === 'excluded' ? toast({ title: 'Confirm needed: contraindicated for member', sev: 'warning' }) : toast({ title: 'Added to draft workout', sev: 'success' }) }, ev.state === 'excluded' ? 'Add (needs confirm)' : 'Add to draft workout'),
              pair && React.createElement(Btn, { size: 'sm', icon: 'swap2', onClick: () => go('exerciseDetail', { id: pair.id }) }, 'Find pair → ' + pair.side),
              ex.is_bilateral && !pair && React.createElement('div', { className: 'card', style: { padding: 10, background: 'var(--caution-bg)' } }, React.createElement('span', { className: 'fs12', style: { color: 'var(--caution)' } }, 'Bilateral, but pair not found in dataset')),
              React.createElement(Btn, { size: 'sm', icon: 'swap', onClick: () => openDrawer('swap', { ex, member }) }, 'Find alternatives'),
              React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'graph', onClick: () => go('graph') }, 'Open graph node'),
              React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', onClick: () => copy(ex.id, 'Exercise ID copied') }, 'Copy exercise ID')))),
      ),
      React.createElement('div', { className: 'mt20' }, React.createElement(VersionFooter, { onClick: go }))));
  }
  function DetailRow({ k, node }) { return React.createElement('div', null, React.createElement('div', { className: 'fs11 faint mb6' }, k), node); }
  function SupportBox({ on, label }) {
    return React.createElement('div', { className: 'card', style: { padding: '12px 10px', textAlign: 'center', background: on ? 'var(--safe-bg)' : 'var(--bg-2)' } },
      React.createElement(Icon, { name: on ? 'check' : 'minus', size: 16, style: { color: on ? 'var(--safe)' : 'var(--ink-3)' } }),
      React.createElement('div', { className: 'fs12 fw6 mt4', style: { color: on ? 'var(--ink-0)' : 'var(--ink-3)' } }, label));
  }

  // ---------- Modal router (new member) ----------
  function ModalRouter({ modal, onClose }) {
    const { toast, go, selectMember } = useStore();
    if (modal.type === 'newMember') return React.createElement(Modal, { title: 'New synthetic member', sub: 'Synthetic data only — do not enter real member information', onClose,
      foot: React.createElement(React.Fragment, null, React.createElement(Btn, { variant: 'ghost', onClick: onClose }, 'Cancel'),
        React.createElement(Btn, { variant: 'primary', icon: 'check', onClick: () => { onClose(); toast({ title: 'Synthetic member created', detail: 'Seeded with a thin graph — ingest context next.', sev: 'success' }); go('ingest'); } }, 'Create member')) },
      React.createElement('div', { className: 'grid g2', style: { gap: 14 } },
        React.createElement(Field, { label: 'Member label (synthetic)' }, React.createElement('input', { className: 'input', placeholder: 'e.g. Member-05' })),
        React.createElement(Field, { label: 'Persona' }, React.createElement('input', { className: 'input', placeholder: 'e.g. New runner · 20s' })),
        React.createElement(Field, { label: 'Primary goal' }, React.createElement('input', { className: 'input', placeholder: 'e.g. Build strength' })),
        React.createElement(Field, { label: 'Training frequency' }, React.createElement('select', { className: 'select' }, ['2 days/week', '3 days/week', '4 days/week', '5 days/week'].map(o => React.createElement('option', { key: o }, o))))),
      React.createElement('div', { className: 'card', style: { padding: 12, background: 'var(--caution-bg)', marginTop: 4 } },
        React.createElement('div', { className: 'row gap8 fs12', style: { color: 'var(--caution)' } }, React.createElement(Icon, { name: 'warning', size: 14 }), 'Inputs matching real PII patterns (emails, phone numbers, SSNs) are rejected.')));
    return null;
  }

  Object.assign(window, { ExerciseLibrary, ExerciseDetail, ModalRouter });
})();
