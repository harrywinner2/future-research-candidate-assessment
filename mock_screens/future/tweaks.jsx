/* FUTURE — Tweaks panel. Applies design tokens live via CSS variables. */
(function () {
  const { useEffect } = React;
  const { useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakRadio, TweakColor, TweakToggle } = window;

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "accent": "#C06AF2",
    "spectrum": ["#FF7A45", "#FF4D6D", "#B14DF0", "#4D8DF0"],
    "density": "regular",
    "fontScale": 14,
    "radius": 11,
    "graphSafety": true
  }/*EDITMODE-END*/;

  function FutureTweaks() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    useEffect(() => {
      const r = document.documentElement.style;
      r.setProperty('--accent', t.accent);
      const s = t.spectrum || TWEAK_DEFAULTS.spectrum;
      const grad = `linear-gradient(100deg, ${s[0]} 0%, ${s[1]} 32%, ${s[2]} 66%, ${s[3]} 100%)`;
      r.setProperty('--grad', grad);
      r.setProperty('--grad-text', `linear-gradient(100deg, ${s[0]}, ${s[1]} 40%, ${s[2]} 70%, ${s[3]})`);
      r.setProperty('--spectrum-1', s[0]); r.setProperty('--spectrum-2', s[1]);
      r.setProperty('--spectrum-3', s[2]); r.setProperty('--spectrum-4', s[3]);
      const dens = { compact: 12.5, regular: 14, comfy: 15.5 }[t.density] || 14;
      document.body.style.fontSize = (t.fontScale || dens) + 'px';
      ['--r-sm', '--r-md', '--r-lg'].forEach((v, i) => r.setProperty(v, (t.radius - 4 + i * 5) + 'px'));
    }, [t]);

    return React.createElement(TweaksPanel, null,
      React.createElement(TweakSection, { label: 'Brand' }),
      React.createElement(TweakColor, { label: 'Accent', value: t.accent, options: ['#C06AF2', '#4D8DF0', '#FF4D6D', '#5BD08A'], onChange: v => setTweak('accent', v) }),
      React.createElement(TweakColor, { label: 'Spectrum gradient', value: t.spectrum, options: [
        ['#FF7A45', '#FF4D6D', '#B14DF0', '#4D8DF0'],
        ['#FFB347', '#FF6B6B', '#845EC2', '#2C73D2'],
        ['#43E97B', '#38F9D7', '#4D8DF0', '#B14DF0'],
        ['#FF9A8B', '#FF6A88', '#FF99AC', '#C06AF2'],
      ], onChange: v => setTweak('spectrum', v) }),
      React.createElement(TweakSection, { label: 'Density & type' }),
      React.createElement(TweakRadio, { label: 'Density', value: t.density, options: ['compact', 'regular', 'comfy'], onChange: v => setTweak('density', v) }),
      React.createElement(TweakSlider, { label: 'Base font', value: t.fontScale, min: 12, max: 17, step: 0.5, unit: 'px', onChange: v => setTweak('fontScale', v) }),
      React.createElement(TweakSlider, { label: 'Corner radius', value: t.radius, min: 4, max: 18, unit: 'px', onChange: v => setTweak('radius', v) }));
  }
  window.FutureTweaks = FutureTweaks;
})();
