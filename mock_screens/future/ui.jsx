/* FUTURE — shared UI primitives + global store. Exports to window. */
(function () {
  const { useState, useEffect, useRef, createContext, useContext, useCallback } = React;
  const Icon = window.Icon;

  // ---------- Global store ----------
  const StoreCtx = createContext(null);
  const useStore = () => useContext(StoreCtx);

  function StoreProvider({ children }) {
    const [screen, setScreen] = useState('dashboard');
    const [memberId, setMemberId] = useState('mbr_alex');
    const [toasts, setToasts] = useState([]);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [navCollapsed, setNavCollapsed] = useState(false);
    const [drawer, setDrawer] = useState(null);   // {type, data}
    const [modal, setModal] = useState(null);
    const [onboard, setOnboard] = useState(() => localStorage.getItem('future_onboard_done') !== '1');
    const [route, setRoute] = useState({});        // per-screen routing payload
    const [recommendations, setRecommendations] = useState([]); // generated recs store

    const member = window.DB.memberById[memberId];

    const toast = useCallback((t, opts = {}) => {
      const id = Math.random().toString(36).slice(2);
      const item = Object.assign({ id, sev: 'info', sticky: false }, typeof t === 'string' ? { title: t } : t, opts);
      setToasts(ts => [...ts, item]);
      if (!item.sticky) setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), item.duration || 3800);
      return id;
    }, []);
    const dismissToast = id => setToasts(ts => ts.filter(x => x.id !== id));

    const go = useCallback((s, payload) => { setScreen(s); if (payload) setRoute(r => ({ ...r, [s]: payload })); window.scrollTo?.(0, 0); }, []);
    const selectMember = useCallback(id => { setMemberId(id); }, []);

    const openDrawer = (type, data) => setDrawer({ type, data });
    const closeDrawer = () => setDrawer(null);

    // keyboard shortcuts
    useEffect(() => {
      let gPending = false, gTimer = null;
      const onKey = (e) => {
        const tag = (e.target.tagName || '').toLowerCase();
        const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen(o => !o); return; }
        if (e.key === 'Escape') { setPaletteOpen(false); setNotifOpen(false); setDrawer(null); setModal(null); return; }
        if (typing) return;
        if (e.key === '?') { setModal({ type: 'shortcuts' }); return; }
        if (e.key === '/') { e.preventDefault(); document.querySelector('[data-composer]')?.focus(); return; }
        if (e.key === 'g') { gPending = true; clearTimeout(gTimer); gTimer = setTimeout(() => gPending = false, 800); return; }
        if (gPending) {
          gPending = false;
          if (e.key === 'm') go('members');
          else if (e.key === 'c') go('console');
          else if (e.key === 'g') go('graph');
          else if (e.key === 'd') go('dashboard');
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [go]);

    const value = {
      screen, setScreen: go, go, memberId, member, selectMember, members: window.DB.members,
      toasts, toast, dismissToast, paletteOpen, setPaletteOpen, notifOpen, setNotifOpen,
      navCollapsed, setNavCollapsed, drawer, openDrawer, closeDrawer, modal, setModal,
      onboard, setOnboard, route, recommendations, setRecommendations,
    };
    return React.createElement(StoreCtx.Provider, { value }, children);
  }

  // ---------- Primitives ----------
  function Btn({ children, icon, variant = '', size = '', className = '', ...rest }) {
    return React.createElement('button', { className: `btn ${variant} ${size} ${className}`, ...rest },
      icon && React.createElement(Icon, { name: icon, size: size === 'xs' ? 13 : size === 'sm' ? 14 : 15 }),
      children);
  }
  function IconBtn({ icon, size = '', title, ...rest }) {
    return React.createElement('button', { className: `btn icon ${size}`, title, 'aria-label': title, ...rest },
      React.createElement(Icon, { name: icon, size: size === 'sm' ? 15 : 17 }));
  }

  function Chip({ children, kind = '', icon, onClick, active, className = '' }) {
    return React.createElement('span', {
      className: `chip ${kind} ${onClick ? 'clickable' : ''} ${active ? 'active-toggle' : ''} ${className}`, onClick,
    }, icon && React.createElement(Icon, { name: icon, size: 12 }), children);
  }

  const SB_LABEL = { safe: 'Safe', caution: 'Caution', excluded: 'Excluded', blocked: 'Blocked', missing: 'Joint data missing', info: 'Info' };
  const SB_ICON = { safe: 'check', caution: 'warning', excluded: 'close', blocked: 'lock', missing: 'why', info: 'info' };
  function SafetyBadge({ state, label, size }) {
    return React.createElement('span', { className: `sb ${state}` },
      React.createElement(Icon, { name: SB_ICON[state] || 'info', size: size || 12, className: 'glyph' }),
      label || SB_LABEL[state] || state);
  }

  function Avatar({ member, size = 34, sq = false, className = '' }) {
    const m = member || {};
    const hue = m.hue ?? 280;
    const bg = `linear-gradient(135deg, oklch(0.62 0.2 ${hue}), oklch(0.6 0.21 ${(hue + 60) % 360}))`;
    return React.createElement('div', {
      className: `avatar ${sq ? 'sq' : ''} ${className}`,
      style: { width: size, height: size, background: bg, fontSize: size * 0.38 },
    }, m.initials || '?');
  }

  function Card({ children, className = '', pad = false, ...rest }) {
    return React.createElement('div', { className: `card ${className}`, ...rest },
      pad ? React.createElement('div', { className: 'card-pad' }, children) : children);
  }

  function Placeholder({ label, h = 160, className = '', style = {} }) {
    return React.createElement('div', { className: `ph ${className}`, style: { height: h, ...style } }, label);
  }

  function Stat({ v, k, delta, deltaDir }) {
    return React.createElement('div', { className: 'stat' },
      React.createElement('div', { className: 'v' }, v),
      React.createElement('div', { className: 'k' }, k),
      delta != null && React.createElement('div', { className: `delta ${deltaDir || 'up'}` }, delta));
  }

  function Switch({ on, onClick }) {
    return React.createElement('button', { className: `switch ${on ? 'on' : ''}`, onClick, role: 'switch', 'aria-checked': on });
  }

  function Tabs({ tabs, value, onChange, underline = false }) {
    return React.createElement('div', { className: underline ? 'tab-underline' : 'tabs' },
      tabs.map(t => {
        const id = t.id || t; const label = t.label || t;
        return React.createElement('button', {
          key: id, className: `tab ${value === id ? 'active' : ''}`, onClick: () => onChange(id),
        }, label, t.count != null && React.createElement('span', { className: 'badge-count', style: { marginLeft: 6 } }, t.count));
      }));
  }

  function Search({ value, onChange, placeholder = 'Search…', autoFocus, style }) {
    return React.createElement('div', { className: 'search', style },
      React.createElement(Icon, { name: 'search', size: 15 }),
      React.createElement('input', { className: 'input', value, autoFocus,
        onChange: e => onChange(e.target.value), placeholder }));
  }

  function Field({ label, children, hint }) {
    return React.createElement('div', { className: 'field' },
      label && React.createElement('label', { className: 'field-label' }, label),
      children,
      hint && React.createElement('div', { className: 'fs11 faint mt4' }, hint));
  }

  function Stages({ stages, current }) {
    return React.createElement('div', { className: 'stages' },
      stages.map((s, i) => {
        const st = i < current ? 'done' : i === current ? 'active' : '';
        return React.createElement('div', { key: i, className: `stage ${st}` },
          React.createElement('div', { className: 'knob' }, i < current && React.createElement(Icon, { name: 'check', size: 11 })),
          s);
      }));
  }

  function VersionFooter({ v = window.DB.versions, onClick }) {
    const item = (label, val, screen) => React.createElement('span', { className: 'vlink', onClick: onClick ? () => onClick(screen) : undefined },
      React.createElement('b', null, label + ' '), val);
    return React.createElement('div', { className: 'vfoot' },
      item('model', v.model, 'settings'),
      item('prompt', v.prompt, 'prompt'),
      item('retrieval', v.retrieval, 'settings'),
      item('safety', v.safety, 'safety'),
      item('schema', v.schema, 'schema'));
  }

  function EmptyState({ icon = 'sparkle', title, sub, action }) {
    return React.createElement('div', { className: 'empty' },
      React.createElement('div', { className: 'ico-circle' }, React.createElement(Icon, { name: icon, size: 24 })),
      React.createElement('div', { className: 'fw7 fs15', style: { color: 'var(--ink-0)' } }, title),
      sub && React.createElement('div', { className: 'fs13', style: { maxWidth: 380 } }, sub),
      action);
  }

  // ---------- Drawer / Modal shells ----------
  function Drawer({ title, sub, onClose, children, foot, width }) {
    useEffect(() => { const f = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose]);
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'scrim', onClick: onClose }),
      React.createElement('div', { className: 'drawer', style: width ? { width } : undefined },
        React.createElement('div', { className: 'drawer-head' },
          React.createElement('div', { className: 'grow' },
            React.createElement('h3', { style: { fontSize: 16 } }, title),
            sub && React.createElement('div', { className: 'fs12 muted mt4' }, sub)),
          React.createElement(IconBtn, { icon: 'close', size: 'sm', onClick: onClose, title: 'Close' })),
        React.createElement('div', { className: 'drawer-body' }, children),
        foot && React.createElement('div', { style: { padding: 14, borderTop: '1px solid var(--line-soft)' } }, foot)));
  }

  function Modal({ title, sub, onClose, children, foot, wide }) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'scrim', onClick: onClose }),
      React.createElement('div', { className: 'modal' },
        React.createElement('div', { className: `modal-card ${wide ? 'wide' : ''}`, onClick: e => e.stopPropagation() },
          (title || onClose) && React.createElement('div', { className: 'panel-head' },
            React.createElement('div', { className: 'grow' },
              React.createElement('h3', null, title), sub && React.createElement('div', { className: 'sub mt4' }, sub)),
            React.createElement(IconBtn, { icon: 'close', size: 'sm', onClick: onClose, title: 'Close' })),
          React.createElement('div', { style: { padding: 18, overflowY: 'auto' } }, children),
          foot && React.createElement('div', { style: { padding: 14, borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 8, justifyContent: 'flex-end' } }, foot))));
  }

  // ---------- Toasts ----------
  function ToastHost() {
    const { toasts, dismissToast } = useStore();
    return React.createElement('div', { className: 'toast-wrap' },
      toasts.map(t => React.createElement('div', { key: t.id, className: `toast ${t.sev}` },
        React.createElement('div', { className: 'bar' }),
        React.createElement('div', { className: 'grow' },
          React.createElement('div', { className: 't' }, t.title),
          t.detail && React.createElement('div', { className: 'd' }, t.detail)),
        React.createElement('button', { className: 'btn icon sm ghost', onClick: () => dismissToast(t.id), 'aria-label': 'Dismiss' },
          React.createElement(Icon, { name: 'close', size: 13 })))));
  }

  // ---------- Copy helper ----------
  function useCopy() {
    const { toast } = useStore();
    return (text, label = 'Copied to clipboard') => {
      try { navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2)); } catch (e) {}
      toast({ title: label, sev: 'success' });
    };
  }

  // ---------- small util: section header ----------
  function PageHead({ title, sub, children }) {
    return React.createElement('div', { className: 'row between', style: { alignItems: 'flex-end', marginBottom: 20, gap: 16, flexWrap: 'wrap' } },
      React.createElement('div', null,
        React.createElement('div', { className: 'page-title' }, title),
        sub && React.createElement('div', { className: 'page-sub' }, sub)),
      children && React.createElement('div', { className: 'row gap8' }, children));
  }

  function MetaPanel({ title, icon, right, children, className = '' }) {
    return React.createElement('div', { className: `card ${className}` },
      React.createElement('div', { className: 'panel-head' },
        icon && React.createElement(Icon, { name: icon, size: 16, style: { color: 'var(--ink-2)' } }),
        React.createElement('h3', { className: 'grow' }, title),
        right),
      React.createElement('div', { className: 'card-pad' }, children));
  }

  Object.assign(window, {
    StoreProvider, useStore, Btn, IconBtn, Chip, SafetyBadge, Avatar, Card, Placeholder, Stat,
    Switch, Tabs, Search, Field, Stages, VersionFooter, EmptyState, Drawer, Modal, ToastHost,
    useCopy, PageHead, MetaPanel,
  });
})();
