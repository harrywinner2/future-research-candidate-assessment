// Entry point. Import order is significant: globals first (exposes window.React),
// then the data layer (creates window.DB), the design system, the engine, the
// graph canvas, every screen, and finally the app shell. Each module is a
// side-effecting IIFE that registers onto `window`. Module evaluation is ordered
// and runs before this file's own body, so by the time we await DB.init() every
// component + window.DB/window.ENGINE exist.
import './globals.js'
import './styles.css'

import './lib/api.js'       // window.API (real backend client)
import './lib/data.js'      // window.DB (+ DB.init async bootstrap from the API)
import './lib/icons.jsx'    // window.Icon
import './components/ui.jsx' // window.StoreProvider, primitives
import './lib/engine.jsx'   // window.ENGINE (real backend + client helpers)
import './app/graph.jsx'    // window.GraphCanvas, window.GraphExplorer

import './screens/screens-core.jsx'
import './screens/screens-console.jsx'
import './screens/screens-library.jsx'
import './screens/screens-ingest.jsx'
import './screens/screens-program.jsx'
import './screens/screens-ops.jsx'
import './screens/screens-config.jsx'
import './screens/screens-agent.jsx'

import './app/app.jsx'      // window.FutureApp

async function boot() {
  const root = window.ReactDOM.createRoot(document.getElementById('root'))
  try {
    await window.DB.init()
  } catch (err) {
    // Render anyway — the app surfaces a degraded banner if the API is unreachable.
    // eslint-disable-next-line no-console
    console.error('DB bootstrap failed:', err)
  }
  root.render(
    window.React.createElement(window.StoreProvider, null,
      window.React.createElement(window.FutureApp))
  )
}

boot()
