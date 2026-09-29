import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Assets are addressed from the root of whatever host serves `dist/` — a Render static site, a
  // subdomain, or `npm run preview` here. Explicit, so a deploy never inherits a relative base.
  base: '/',
  server: {
    // Bind to all interfaces so the app is reachable through the dev preview proxy.
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The sandbox preview is served from a generated *.e2b.app host; Vite rejects unknown
    // Host headers by default, which would leave the preview showing HTTP 403.
    allowedHosts: ['.e2b.app'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
