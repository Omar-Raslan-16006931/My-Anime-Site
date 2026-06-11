import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only middleware that mirrors the Vercel /api/allanime function so the
// AllManga source works with `npm run dev` (no `vercel dev` required).
function allanimeDevApi() {
  return {
    name: 'allanime-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/allanime', async (req, res) => {
        try {
          const { handleAllanime } = await server.ssrLoadModule('/api/_allanime.js')
          const url = new URL(req.url, 'http://localhost')
          const params = Object.fromEntries(url.searchParams.entries())
          const action = params.action || 'search'
          const out = await handleAllanime(action, params)
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify(out))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: e?.message || 'error' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), allanimeDevApi()],
})
