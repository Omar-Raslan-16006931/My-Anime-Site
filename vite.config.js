import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only middleware that mirrors the Vercel /api functions so they work with
// `npm run dev` (no `vercel dev` required).
function devApi(env) {
  return {
    name: 'dev-api',
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

      // AI recommendations (Gemini). Needs GEMINI_API_KEY in your local .env file.
      server.middlewares.use('/api/recommend', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'GET') {
          const { status } = await server.ssrLoadModule('/api/_recommend.js')
          res.end(JSON.stringify(status(env.GEMINI_API_KEY, env.GEMINI_MODEL))); return
        }
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"method"}'); return }
        try {
          const chunks = []
          for await (const c of req) chunks.push(c)
          const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
          const { recommend } = await server.ssrLoadModule('/api/_recommend.js')
          const out = await recommend(body, env.GEMINI_API_KEY, env.GEMINI_MODEL)
          res.statusCode = out.status
          res.end(JSON.stringify(out.json))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'server', message: 'Something went wrong. Try again.' }))
        }
      })

      // English subtitles (Wyzie). Needs WYZIE_API_KEY in your local .env file.
      server.middlewares.use('/api/subs', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        try {
          const { fetchSubtitle, safeFileName } = await server.ssrLoadModule('/api/_subs.js')
          const url = new URL(req.url, 'http://localhost')
          const q = Object.fromEntries(url.searchParams.entries())
          const out = await fetchSubtitle(q, env.WYZIE_API_KEY)
          if (out.body != null) {
            res.setHeader('Content-Type', out.type)
            if (q.dl) res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(q.name)}.en.${out.ext}"`)
            res.end(out.body)
            return
          }
          res.statusCode = out.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(out.json))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e?.message || 'error' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL vars from .env (not just VITE_*) for the dev API only. Server-side
  // secrets like WYZIE_API_KEY are never exposed to the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApi(env)],
  }
})
