// Vercel serverless function: POST /api/recommend
// Body: { prompt, kind: 'all'|'anime'|'movie'|'tv', watched: string[] }
import { recommend, rateLimited } from './_recommend.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate', message: 'Slow down a little and try again in a few minutes.' })
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const out = await recommend(body, process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL)
    return res.status(out.status).json(out.json)
  } catch (e) {
    return res.status(500).json({ error: 'server', message: 'Something went wrong. Try again.' })
  }
}
