/* FUTURE — Ingestion screen. */
(function () {
  const { useState } = React;
  const Icon = window.Icon, DB = window.DB;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Card, MetaPanel, PageHead, Field, Tabs, useCopy, VersionFooter } = window;

  const TABS = [{ id: 'profile', label: 'Profile' }, { id: 'injury', label: 'Injury / condition' }, { id: 'history', label: 'Workout history' }, { id: 'signal', label: 'Chat / context signal' }, { id: 'bulk', label: 'Bulk seed' }];

  const PII = [/\b\d{3}-\d{2}-\d{4}\b/, /\b[\w.]+@(gmail|yahoo|outlook|hotmail)\.com\b/i, /\b\d{3}[-.]\d{3}[-.]\d{4}\b/];

  function Ingestion() {
    const { member, toast, go } = useStore();
    const [tab, setTab] = useState('signal');
    return React.createElement('div', { className: 'screen' }, React.createElement('div', { className: 'screen-pad' },
      React.createElement(PageHead, { title: 'Ingestion', sub: 'Turn synthetic context into graph nodes & relationships · ' + member.name + ' preselected' }),
      React.createElement('div', { style: { maxWidth: 760, marginBottom: 18 } }, React.createElement('div', { className: 'tab-underline' },
        TABS.map(t => React.createElement('button', { key: t.id, className: `tab ${tab === t.id ? 'active' : ''}`, onClick: () => setTab(t.id) }, t.label)))),
      tab === 'signal' ? React.createElement(SignalForm, { member, toast, go })
        : tab === 'injury' ? React.createElement(InjuryForm, { member, toast })
          : tab === 'bulk' ? React.createElement(BulkSeed, { toast })
            : React.createElement(SimpleForm, { tab, member, toast }),
      React.createElement('div', { className: 'mt24' }, React.createElement(VersionFooter, { onClick: go }))));
  }

  function SignalForm({ member, toast, go }) {
    const copy = useCopy();
    const [text, setText] = useState('My knee felt irritated after lunges last week, especially going downstairs.');
    const [type, setType] = useState('chat');
    const [extracted, setExtracted] = useState(null);
    const [busy, setBusy] = useState(false);
    const piiHit = PII.some(re => re.test(text));

    const extract = async () => {
      if (piiHit) { toast({ title: 'Possible real PII detected', detail: 'Use synthetic labels only. Ingestion blocked.', sev: 'error' }); return; }
      setBusy(true); setExtracted(null); await new Promise(r => setTimeout(r, 900));
      setExtracted([
        { kind: 'node', type: 'ContextSignal', label: '“' + text.slice(0, 40) + '…”', conf: 0.99, accepted: true },
        { kind: 'node', type: 'Injury', label: 'Knee irritation', conf: 0.86, accepted: true },
        { kind: 'edge', label: 'Member → HAS_INJURY → Knee irritation', conf: 0.86, accepted: true },
        { kind: 'node', type: 'Joint', label: 'knee', conf: 0.93, accepted: true },
        { kind: 'edge', label: 'Knee irritation → AFFECTS_JOINT → knee', conf: 0.91, accepted: true },
        { kind: 'edge', label: 'Knee irritation → CONTRAINDICATES → lunge pattern', conf: 0.64, accepted: false },
      ]);
      setBusy(false);
    };
    const toggle = i => setExtracted(ex => ex.map((f, j) => j === i ? { ...f, accepted: !f.accepted } : f));

    return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start', maxWidth: 1000 } },
      React.createElement(Card, { pad: true },
        React.createElement(Field, { label: 'Raw synthetic note', hint: 'e.g. "Lower back tight after deadlifts."' },
          React.createElement('textarea', { className: 'textarea', value: text, onChange: e => setText(e.target.value), style: { minHeight: 120 } })),
        piiHit && React.createElement('div', { className: 'card mb16', style: { padding: 10, background: 'var(--danger-bg)' } }, React.createElement('span', { className: 'fs12', style: { color: 'var(--danger)' } }, React.createElement(Icon, { name: 'warning', size: 13 }), ' Looks like real personal data — replace with synthetic content.')),
        React.createElement(Field, { label: 'Signal type' }, React.createElement('select', { className: 'select', value: type, onChange: e => setType(e.target.value) }, ['chat', 'transcript', 'coach note', 'biometric summary'].map(o => React.createElement('option', { key: o }, o)))),
        React.createElement('div', { className: 'row gap8' },
          React.createElement(Btn, { variant: 'primary', icon: 'sparkle', onClick: extract, disabled: busy }, busy ? 'Extracting…' : 'Extract structure'),
          React.createElement(Btn, { variant: 'ghost', icon: 'copy', onClick: () => copy(text) }, 'Copy'))),
      React.createElement(Card, null,
        React.createElement('div', { className: 'panel-head' }, React.createElement('h3', { className: 'grow' }, 'Extraction preview'), extracted && React.createElement('span', { className: 'fs11 faint' }, extracted.filter(f => f.accepted).length + ' / ' + extracted.length + ' accepted')),
        React.createElement('div', { className: 'card-pad' },
          !extracted ? React.createElement('div', { className: 'fs13 faint', style: { padding: '30px 0', textAlign: 'center' } }, 'Run “Extract structure” to preview proposed nodes & edges before saving.')
            : React.createElement('div', null,
              React.createElement('div', { className: 'col gap8 mb16' }, extracted.map((f, i) => React.createElement('div', { key: i, className: 'row gap10 center', style: { padding: '9px 11px', borderRadius: 9, background: f.accepted ? 'var(--bg-2)' : 'var(--bg-1)', border: '1px solid var(--line-soft)', opacity: f.accepted ? 1 : .55 } },
                React.createElement('input', { type: 'checkbox', checked: f.accepted, onChange: () => toggle(i) }),
                React.createElement('span', { className: 'chip', style: { fontSize: 10, background: f.kind === 'edge' ? 'rgba(192,106,242,.15)' : 'var(--bg-4)' } }, f.kind === 'edge' ? 'EDGE' : f.type),
                React.createElement('span', { className: 'grow fs12', style: { color: 'var(--ink-1)' } }, f.label),
                React.createElement('span', { className: `sb ${f.conf > 0.8 ? 'safe' : f.conf > 0.6 ? 'caution' : 'excluded'}`, title: 'confidence' }, Math.round(f.conf * 100) + '%')))),
              extracted.some(f => f.conf < 0.7 && f.accepted) && React.createElement('div', { className: 'card mb16', style: { padding: 10, background: 'var(--caution-bg)' } }, React.createElement('span', { className: 'fs12', style: { color: 'var(--caution)' } }, React.createElement(Icon, { name: 'warning', size: 13 }), ' Low-confidence facts require confirmation before they create relationships.')),
              React.createElement('div', { className: 'row gap8' },
                React.createElement(Btn, { variant: 'primary', icon: 'ingest', onClick: () => { toast({ title: 'Ingested ' + extracted.filter(f => f.accepted).length + ' facts into graph', detail: 'Graph Explorer refreshed.', sev: 'success' }); go('graph'); } }, 'Ingest into graph'),
                React.createElement(Btn, { variant: 'ghost', onClick: () => setExtracted(null) }, 'Discard'))))));
  }

  function InjuryForm({ member, toast }) {
    const [joint, setJoint] = useState('');
    return React.createElement('div', { style: { maxWidth: 640 } }, React.createElement(Card, { pad: true },
      React.createElement('div', { className: 'grid g2', style: { gap: 14 } },
        React.createElement(Field, { label: 'Condition label' }, React.createElement('input', { className: 'input', placeholder: 'e.g. Patellofemoral pain' })),
        React.createElement(Field, { label: 'Affected joint / body area', hint: 'Required for active injuries that constrain selection' }, React.createElement('select', { className: 'select', value: joint, onChange: e => setJoint(e.target.value) }, React.createElement('option', { value: '' }, 'Select…'), DB.jointList.map(j => React.createElement('option', { key: j }, j)))),
        React.createElement(Field, { label: 'Severity' }, React.createElement('select', { className: 'select' }, ['mild', 'moderate', 'severe'].map(o => React.createElement('option', { key: o }, o)))),
        React.createElement(Field, { label: 'Status' }, React.createElement('select', { className: 'select' }, ['active', 'improving', 'resolved'].map(o => React.createElement('option', { key: o }, o))))),
      React.createElement(Field, { label: 'Contraindicated movement patterns' }, React.createElement('div', { className: 'row wrap gap6' }, DB.patternList.map(p => React.createElement(Chip, { key: p, kind: 'pattern', onClick: () => {} }, p)))),
      React.createElement(Field, { label: 'Source note' }, React.createElement('textarea', { className: 'textarea', placeholder: 'Synthetic source note…' })),
      !joint && React.createElement('div', { className: 'card mb16', style: { padding: 10, background: 'var(--caution-bg)' } }, React.createElement('span', { className: 'fs12', style: { color: 'var(--caution)' } }, React.createElement(Icon, { name: 'warning', size: 13 }), ' No mapped joint — safety filtering will be weak for this injury.')),
      React.createElement(Btn, { variant: 'primary', icon: 'ingest', onClick: () => toast({ title: 'Injury ingested', sev: 'success' }) }, 'Ingest into graph')));
  }

  function SimpleForm({ tab, member, toast }) {
    const fields = { profile: ['Member name (synthetic)', 'Goals', 'Preferences', 'Available equipment', 'Training days', 'Skill level', 'Notes'],
      history: ['Date', 'Exercises performed', 'Sets / reps / weight / duration', 'Adherence', 'Notes'] }[tab] || [];
    return React.createElement('div', { style: { maxWidth: 640 } }, React.createElement(Card, { pad: true },
      fields.map((f, i) => React.createElement(Field, { key: i, label: f }, f.includes('Notes') ? React.createElement('textarea', { className: 'textarea' }) : React.createElement('input', { className: 'input' }))),
      React.createElement(Btn, { variant: 'primary', icon: 'ingest', onClick: () => toast({ title: 'Ingested into graph', sev: 'success' }) }, 'Ingest into graph')));
  }

  function BulkSeed({ toast }) {
    return React.createElement('div', { style: { maxWidth: 640 } }, React.createElement(Card, { pad: true },
      React.createElement(Field, { label: 'Paste synthetic seed JSON', hint: 'Members, injuries, equipment, history' },
        React.createElement('textarea', { className: 'textarea mono', style: { minHeight: 200, fontSize: 12 }, defaultValue: '{\n  "members": [ { "label": "Member-05", "goal": "general fitness", "equipment": ["bodyweight"] } ],\n  "injuries": [ { "member": "Member-05", "joint": "ankle", "severity": "mild" } ]\n}' })),
      React.createElement('div', { className: 'row gap8' },
        React.createElement(Btn, { variant: 'primary', icon: 'ingest', onClick: () => toast({ title: 'Seeded 4 members + 6 injuries', detail: 'Graph rebuilt.', sev: 'success' }) }, 'Seed into graph'),
        React.createElement(Btn, { variant: 'ghost', icon: 'sparkle', onClick: () => toast({ title: 'Loaded demo seed', sev: 'info' }) }, 'Load demo seed'))));
  }

  Object.assign(window, { Ingestion });
})();
