// Vercel serverless function: /api/allanime
// Proxies AllManga (allmanga.to / api.allanime.day) requests that require a
// server-set Referer header.  Query: ?action=search|resolve&...
import { handleAllanime } from './_allanime.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')

  try {
    const { action = 'search', ...params } = req.query || {}
    if (params.episode != null) params.episode = String(params.episode)
    const out = await handleAllanime(action, params)
    res.status(200).json(out)
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Internal error' })
  }
}
