// Client wrapper around the /api/allanime proxy.
import { apiUrl } from './native'

const API = apiUrl('/api/allanime')

export async function allmangaSearch(query, translationType = 'sub') {
  const url = `${API}?action=search&query=${encodeURIComponent(query)}&translationType=${translationType}`
  const r = await fetch(url)
  if (!r.ok) return []
  const d = await r.json()
  return d.results || []
}

// Resolve playable streams for a title + episode.
// Returns { ok, streams:[{sourceName,url,quality,type}], matched } or { ok:false, error }.
export async function allmangaResolve({ title, showId, episode = 1, translationType = 'sub' }) {
  const params = new URLSearchParams({ action: 'resolve', episode: String(episode), translationType })
  if (title) params.set('title', title)
  if (showId) params.set('showId', showId)

  try {
    const r = await fetch(`${API}?${params.toString()}`)
    const d = await r.json()
    return d
  } catch (e) {
    return { ok: false, error: e?.message || 'request failed' }
  }
}
