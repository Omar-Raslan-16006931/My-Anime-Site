// Vercel serverless function: /api/subs
// GET /api/subs?id=<tmdb|tt-imdb>[&season=1&episode=2][&to=vtt|srt][&dl=1&name=Title]
// Returns an English subtitle file. CORS-open so embed players (VidLink) can
// load it via their sub_file option. Cached at the edge for a week, so each
// episode only spends Wyzie quota once no matter how many people watch it.
import { fetchSubtitle, safeFileName } from './_subs.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const q = req.query || {}
  const out = await fetchSubtitle(q, process.env.WYZIE_API_KEY)

  if (out.body != null) {
    res.setHeader('Content-Type', out.type)
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400')
    if (q.dl) res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(q.name)}.en.${out.ext}"`)
    return res.status(200).send(out.body)
  }

  // Cache "not found" briefly too, so repeated misses don't burn quota.
  res.setHeader('Cache-Control', out.status === 404 ? 'public, s-maxage=1800' : 'no-store')
  return res.status(out.status).json(out.json)
}
