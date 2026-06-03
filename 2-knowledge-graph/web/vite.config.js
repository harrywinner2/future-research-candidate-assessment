import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The mock authored every component with React.createElement against a global
// `React`, registering each component on `window`. We preserve that pattern
// (see src/globals.js) so the finished design ports verbatim; the data/engine
// layers are swapped for the real backend API. classic runtime keeps JSX (only
// used by no remaining files) compiling to React.createElement.
export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
