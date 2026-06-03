/* FUTURE — force-directed graph engine (canvas) + Graph Explorer screen. */
(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;
  const Icon = window.Icon, DB = window.DB;
  const { useStore, Btn, IconBtn, Chip, SafetyBadge, Search, EmptyState, useCopy } = window;
  const _GRAPH_MEMBER = { value: null };

  const TYPE_COLORS = {
    Member: '#FFFFFF', Goal: '#6AA0F2', Preference: '#4FD1C5', Equipment: '#4D8DF0',
    Injury: '#FF5A5A', Joint: '#FF8A4D', Exercise: '#C06AF2', MuscleGroup: '#F77FB0',
    MovementPattern: '#F2C14E', Workout: '#5BD08A', WorkoutLog: '#5BD08A', ContextSignal: '#9aa0ad',
  };
  const TYPE_R = { Member: 16, Injury: 11, Joint: 10, Exercise: 8.5, Goal: 9, ContextSignal: 8 };
  const NODE_TYPES = Object.keys(TYPE_COLORS);
  const EDGE_TYPES = ['HAS_GOAL','PREFERS','HAS_EQUIPMENT','HAS_INJURY','AFFECTS_JOINT','LOADS_JOINT','TRAINS_MUSCLE','HAS_MOVEMENT_PATTERN','CONTRAINDICATES','COMPLETED_WORKOUT','MENTIONED_IN'];

  function GraphCanvas({ graph, nodeFilter, edgeFilter, highlight, safetyMode, onSelectNode, onSelectEdge, selectedId, focusId }) {
    const canvasRef = useRef(null);
    const sim = useRef({ nodes: [], edges: [], hover: null, drag: null, raf: null, t: 0 });
    const dpr = window.devicePixelRatio || 1;

    // (re)build sim when graph changes
    useEffect(() => {
      const W = canvasRef.current?.clientWidth || 800, H = canvasRef.current?.clientHeight || 600;
      const prev = Object.fromEntries(sim.current.nodes.map(n => [n.id, n]));
      sim.current.nodes = graph.nodes.map((n, i) => {
        const p = prev[n.id];
        const angle = (i / graph.nodes.length) * Math.PI * 2;
        return { ...n, x: p?.x ?? W / 2 + Math.cos(angle) * 160 + (Math.random() - .5) * 40,
          y: p?.y ?? H / 2 + Math.sin(angle) * 160 + (Math.random() - .5) * 40, vx: 0, vy: 0,
          r: TYPE_R[n.type] || 8, color: TYPE_COLORS[n.type] || '#888' };
      });
      sim.current.edges = graph.edges.map(e => ({ ...e }));
      sim.current.t = 0;
    }, [graph]);

    const draw = useCallback(() => {
      const cv = canvasRef.current; if (!cv) return;
      const ctx = cv.getContext('2d');
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const S = sim.current;
      const byId = Object.fromEntries(S.nodes.map(n => [n.id, n]));
      const hlSet = highlight;
      // edges
      S.edges.forEach(e => {
        if (!edgeFilter[e.type]) return;
        const a = byId[e.source], b = byId[e.target]; if (!a || !b) return;
        if (!nodeFilter[a.type] || !nodeFilter[b.type]) return;
        const unsafe = e.unsafe && safetyMode;
        const hot = hlSet && (hlSet.has(a.id) && hlSet.has(b.id));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = unsafe ? 'rgba(255,90,90,0.55)' : hot ? 'rgba(192,106,242,0.7)' : 'rgba(255,255,255,0.10)';
        ctx.lineWidth = hot || unsafe ? 1.8 : 1;
        if (unsafe) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
        ctx.stroke(); ctx.setLineDash([]);
      });
      // nodes
      S.nodes.forEach(n => {
        if (!nodeFilter[n.type]) return;
        const dim = hlSet && !hlSet.has(n.id);
        const sel = n.id === selectedId;
        const ev = (safetyMode && n.type === 'Exercise' && n.ex) ? DB.evalExerciseForMember(n.ex, window._GRAPH_MEMBER.value) : null;
        const unsafe = ev && ev.state !== 'safe';
        ctx.globalAlpha = dim ? 0.22 : 1;
        // glow for member/highlight
        if (n.type === 'Member' || (hlSet && hlSet.has(n.id))) {
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 9, 0, Math.PI * 2);
          ctx.fillStyle = n.type === 'Member' ? 'rgba(192,106,242,0.18)' : 'rgba(192,106,242,0.12)'; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color; ctx.fill();
        if (sel) { ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
        else if (unsafe) { ctx.lineWidth = 2; ctx.strokeStyle = '#FF5A5A'; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); }
        else if (n.type === 'Member') { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke(); }
        // label
        if (!dim && (n.r >= 9 || n.id === S.hover || sel || n.type === 'Member')) {
          ctx.globalAlpha = dim ? 0.3 : 0.92;
          ctx.font = (n.type === 'Member' ? '700 ' : '500 ') + '11px Hanken Grotesk, sans-serif';
          ctx.fillStyle = '#E8E8EE'; ctx.textAlign = 'center';
          const label = n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label;
          ctx.fillText(label, n.x, n.y + n.r + 13);
        }
        ctx.globalAlpha = 1;
      });
    }, [nodeFilter, edgeFilter, highlight, safetyMode, selectedId, dpr]);

    // physics tick
    useEffect(() => {
      function tick() {
        const S = sim.current; const cv = canvasRef.current; if (!cv) return;
        const W = cv.clientWidth, H = cv.clientHeight;
        const ns = S.nodes; const byId = Object.fromEntries(ns.map(n => [n.id, n]));
        const cooling = Math.max(0.02, 1 - S.t / 260); S.t++;
        // repulsion
        for (let i = 0; i < ns.length; i++) {
          for (let j = i + 1; j < ns.length; j++) {
            const a = ns[i], b = ns[j]; let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy || 0.01; let d = Math.sqrt(d2);
            const f = (2600) / d2; const fx = (dx / d) * f, fy = (dy / d) * f;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
          }
        }
        // springs
        S.edges.forEach(e => {
          const a = byId[e.source], b = byId[e.target]; if (!a || !b) return;
          let dx = b.x - a.x, dy = b.y - a.y; let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const target = e.type === 'CONTRAINDICATES' ? 70 : 96;
          const f = (d - target) * 0.018; const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        });
        // center gravity + integrate
        ns.forEach(n => {
          n.vx += (W / 2 - n.x) * 0.0016; n.vy += (H / 2 - n.y) * 0.0016;
          if (n.type === 'Member') { n.vx += (W / 2 - n.x) * 0.02; n.vy += (H / 2 - n.y) * 0.02; }
          if (S.drag === n.id) { n.x = S.dragX; n.y = S.dragY; n.vx = 0; n.vy = 0; return; }
          n.vx *= 0.86 * cooling + 0.04; n.vy *= 0.86 * cooling + 0.04;
          n.x += n.vx; n.y += n.vy;
          n.x = Math.max(n.r + 6, Math.min(W - n.r - 6, n.x));
          n.y = Math.max(n.r + 6, Math.min(H - n.r - 6, n.y));
        });
        draw();
        S.raf = requestAnimationFrame(tick);
      }
      sim.current.raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(sim.current.raf);
    }, [draw]);

    // focus: reheat
    useEffect(() => { sim.current.t = 0; }, [focusId, graph]);

    // pointer handlers
    const pick = (e) => {
      const r = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = null, bd = 16;
      sim.current.nodes.forEach(n => { if (!nodeFilter[n.type]) return; const d = Math.hypot(n.x - mx, n.y - my); if (d < n.r + 6 && d < bd) { bd = d; best = n; } });
      return { best, mx, my };
    };
    const onDown = e => { const { best, mx, my } = pick(e); if (best) { sim.current.drag = best.id; sim.current.dragX = mx; sim.current.dragY = my; sim.current.t = 0; } };
    const onMove = e => {
      const r = canvasRef.current.getBoundingClientRect();
      if (sim.current.drag) { sim.current.dragX = e.clientX - r.left; sim.current.dragY = e.clientY - r.top; return; }
      const { best } = pick(e); sim.current.hover = best?.id || null;
      canvasRef.current.style.cursor = best ? 'pointer' : 'grab';
    };
    const onUp = e => {
      const wasDrag = sim.current.drag; const start = sim.current.downPos;
      if (wasDrag) { const { best } = pick(e); sim.current.drag = null;
        if (best && best.id === wasDrag) onSelectNode?.(best); }
    };

    return React.createElement('canvas', {
      ref: canvasRef, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' },
      onMouseDown: e => { onDown(e); }, onMouseMove: onMove, onMouseUp: onUp, onMouseLeave: () => { sim.current.drag = null; },
    });
  }

  // ---------- Graph Explorer screen ----------
  function GraphExplorer() {
    const { member, openDrawer, go, toast } = useStore();
    const copy = useCopy();
    const [nodeFilter, setNodeFilter] = useState(Object.fromEntries(NODE_TYPES.map(t => [t, true])));
    const [edgeFilter, setEdgeFilter] = useState(Object.fromEntries(EDGE_TYPES.map(t => [t, true])));
    const [safetyMode, setSafetyMode] = useState(true);
    const [selected, setSelected] = useState(null);
    const [highlight, setHighlight] = useState(null);
    const [query, setQuery] = useState('');
    const [focusTick, setFocusTick] = useState(0);
    const graph = useMemo(() => DB.buildGraph(member), [member]);

    // inject member so canvas safety eval sees current member
    _GRAPH_MEMBER.value = member;
    useEffect(() => { _GRAPH_MEMBER.value = member; }, [member]);

    const showSafetyNeighborhood = () => {
      const set = new Set();
      graph.nodes.forEach(n => { if (n.type === 'Injury' || n.type === 'Joint') set.add(n.id); });
      graph.edges.forEach(e => { if (e.unsafe) { set.add(e.source); set.add(e.target); } });
      set.add(member.id);
      setHighlight(set); setFocusTick(t => t + 1);
      toast({ title: 'Safety neighborhood highlighted', detail: 'Injury → joint → contraindicated exercises.', sev: 'safety' });
    };
    const showRecContext = () => {
      const set = new Set([member.id]);
      graph.nodes.filter(n => ['Goal', 'Equipment', 'Exercise'].includes(n.type)).slice(0, 10).forEach(n => set.add(n.id));
      setHighlight(set);
      toast({ title: 'Recommendation context highlighted', detail: 'Subgraph retrieved for the latest response.', sev: 'info' });
    };
    const reset = () => { setHighlight(null); setSelected(null); setFocusTick(t => t + 1); };

    const counts = useMemo(() => {
      const c = {}; graph.nodes.forEach(n => c[n.type] = (c[n.type] || 0) + 1); return c;
    }, [graph]);

    const selNode = selected;
    const connectedEdges = selNode ? graph.edges.filter(e => e.source === selNode.id || e.target === selNode.id) : [];

    return React.createElement('div', { className: 'screen' },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '224px 1fr 300px', gridTemplateRows: '1fr', height: '100%', minHeight: 0, overflow: 'hidden' } },
        // left rail
        React.createElement('div', { style: { borderRight: '1px solid var(--line-soft)', overflowY: 'auto', padding: 16, background: 'var(--bg-1)' } },
          React.createElement('div', { className: 'sec-title mb12' }, 'Filters'),
          React.createElement(Search, { value: query, onChange: setQuery, placeholder: 'Find node…' }),
          React.createElement('div', { className: 'mt16' },
            React.createElement('div', { className: 'fs11 fw7 faint mb8' }, 'NODE TYPES'),
            React.createElement('div', { className: 'col gap4' },
              NODE_TYPES.filter(t => counts[t]).map(t => React.createElement('label', { key: t, className: 'row gap8', style: { cursor: 'pointer', fontSize: 12.5 } },
                React.createElement('input', { type: 'checkbox', checked: nodeFilter[t], onChange: () => setNodeFilter(f => ({ ...f, [t]: !f[t] })) }),
                React.createElement('span', { style: { width: 9, height: 9, borderRadius: '50%', background: TYPE_COLORS[t], flex: 'none' } }),
                React.createElement('span', { className: 'grow' }, t),
                React.createElement('span', { className: 'faint' }, counts[t]))))),
          React.createElement('div', { className: 'mt16' },
            React.createElement('div', { className: 'fs11 fw7 faint mb8' }, 'EDGE TYPES'),
            React.createElement('div', { className: 'col gap4' },
              EDGE_TYPES.map(t => React.createElement('label', { key: t, className: 'row gap8', style: { cursor: 'pointer', fontSize: 11.5 } },
                React.createElement('input', { type: 'checkbox', checked: edgeFilter[t], onChange: () => setEdgeFilter(f => ({ ...f, [t]: !f[t] })) }),
                React.createElement('span', { className: 'grow mono', style: { fontSize: 10.5 } }, t))))),
          React.createElement('div', { className: 'divider' }),
          React.createElement('label', { className: 'row between', style: { cursor: 'pointer' } },
            React.createElement('span', { className: 'fs12 fw6' }, 'Safety mode'),
            React.createElement(window.Switch, { on: safetyMode, onClick: () => setSafetyMode(s => !s) }))),
        // canvas
        React.createElement('div', { style: { position: 'relative', minWidth: 0, minHeight: 0, overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, var(--bg-1), var(--bg-0))' } },
          React.createElement('div', { style: { position: 'absolute', top: 14, left: 14, right: 14, zIndex: 2, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            React.createElement(Btn, { size: 'sm', icon: 'safety', onClick: showSafetyNeighborhood }, 'Show safety neighborhood'),
            React.createElement(Btn, { size: 'sm', icon: 'sparkle', onClick: showRecContext }, 'Show recommendation context'),
            React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'refresh', onClick: reset }, 'Reset view')),
          React.createElement(GraphCanvas, { graph, nodeFilter, edgeFilter, highlight, safetyMode, selectedId: selNode?.id, focusId: focusTick, query,
            onSelectNode: n => setSelected(n) }),
          React.createElement('div', { style: { position: 'absolute', bottom: 14, left: 14, zIndex: 2, display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: '70%' } },
            Object.entries(TYPE_COLORS).filter(([t]) => counts[t]).map(([t, c]) =>
              React.createElement('span', { key: t, className: 'chip', style: { fontSize: 10.5, background: 'var(--bg-1)', border: '1px solid var(--line-soft)' } },
                React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: c } }), t)))),
        // inspector
        React.createElement('div', { style: { borderLeft: '1px solid var(--line-soft)', overflowY: 'auto', background: 'var(--bg-1)' } },
          React.createElement('div', { className: 'panel-head' }, React.createElement('h3', { className: 'grow' }, 'Inspector')),
          React.createElement('div', { style: { padding: 16 } },
            !selNode ? React.createElement(EmptyState, { icon: 'graph', title: 'Nothing selected', sub: 'Click a node to inspect its properties and edges. Drag to rearrange.' })
              : React.createElement(NodeInspector, { node: selNode, edges: connectedEdges, graph, member, openDrawer, go, copy }))),
      ));
  }

  // ---------- Node inspector ----------
  function NodeInspector({ node, edges, graph, member, openDrawer, go, copy }) {
    const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
    const ev = node.type === 'Exercise' && node.ex ? DB.evalExerciseForMember(node.ex, member) : null;
    return React.createElement('div', null,
      React.createElement('div', { className: 'row gap8 mb12' },
        React.createElement('span', { style: { width: 12, height: 12, borderRadius: '50%', background: TYPE_COLORS[node.type] } }),
        React.createElement('span', { className: 'sec-title' }, node.type)),
      React.createElement('h3', { style: { fontSize: 17 } }, node.label),
      React.createElement('div', { className: 'mono fs11 faint mt4' }, node.id),
      ev && React.createElement('div', { className: 'mt12' }, React.createElement(SafetyBadge, { state: ev.state }),
        ev.reasons.map((r, i) => React.createElement('div', { key: i, className: 'fs12 muted mt4' }, '· ' + r))),
      node.type === 'Exercise' && node.ex && React.createElement('div', { className: 'mt12 col gap6' },
        React.createElement('div', { className: 'row wrap gap6' }, node.ex.muscle_groups.map(m => React.createElement(Chip, { key: m, kind: 'muscle' }, m))),
        React.createElement('div', { className: 'row wrap gap6' }, node.ex.joints_loaded.map(j => React.createElement(Chip, { key: j, kind: 'joint' }, j))),
        React.createElement('div', { className: 'row wrap gap6' }, node.ex.equipment_required.map(e => React.createElement(Chip, { key: e, kind: 'equip' }, e)))),
      React.createElement('div', { className: 'divider' }),
      React.createElement('div', { className: 'fs11 fw7 faint mb8' }, 'CONNECTED EDGES (' + edges.length + ')'),
      React.createElement('div', { className: 'col gap6' },
        edges.map((e, i) => {
          const other = e.source === node.id ? byId[e.target] : byId[e.source];
          const dir = e.source === node.id ? '→' : '←';
          return React.createElement('div', { key: i, className: 'row gap8 fs12', style: { padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 7 } },
            React.createElement('span', { className: 'mono', style: { fontSize: 10, color: e.unsafe ? 'var(--danger)' : 'var(--accent)' } }, e.type),
            React.createElement('span', { className: 'faint' }, dir),
            React.createElement('span', { className: 'grow', style: { color: 'var(--ink-1)' } }, other?.label || e.target));
        })),
      React.createElement('div', { className: 'row gap8 mt16' },
        node.type === 'Exercise' && node.ex && React.createElement(Btn, { size: 'sm', icon: 'eye', onClick: () => go('exerciseDetail', { id: node.ex.id }) }, 'View exercise'),
        node.type === 'Injury' && React.createElement(Btn, { size: 'sm', icon: 'why', onClick: () => openDrawer('why', { kind: 'injury', node }) }, 'Why it matters'),
        React.createElement(Btn, { size: 'sm', variant: 'ghost', icon: 'copy', onClick: () => copy(node.id, 'Node ID copied') }, 'Copy ID')));
  }

  // patch GraphCanvas to read member from _GRAPH_MEMBER
  window.GraphExplorer = GraphExplorer;
  window.GraphCanvas = GraphCanvas;
  window.GRAPH_TYPE_COLORS = TYPE_COLORS;
  window._GRAPH_MEMBER = _GRAPH_MEMBER;
})();
