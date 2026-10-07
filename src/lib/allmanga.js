// Client wrapper around the /api/allanime proxy.
import { apiUrl } from './native'

const API = apiUrl('/api/allanime')

// GET + JSON that tells "server unreachable" apart from "no results".
async function getJson(url) {
  try {
    const r = await fetch(url)
    const text = await r.text()
    try {
      return JSON.parse(text)
    } catch {
      return { ok: false, unreachable: true, error: `AniWave server answered ${r.status} without data` }
    }
  } catch (e) {
    return { ok: false, unreachable: true, error: e?.message || 'Network error' }
  }
}

export async function allmangaSearch(query, translationType = 'sub') {
  const d = await getJson(`${API}?action=search&query=${encodeURIComponent(query)}&translationType=${translationType}`)
  return d.results || []
}

// Resolve playable streams for a title + episode.
// `alt` = other names for the show (romaji, synonyms) — AllManga often lists
// anime under the Japanese title, so searching only the English one misses.
// Returns { ok, streams:[{sourceName,url,quality,type}], matched }
//      or { ok:false, error, unreachable? }.
export async function allmangaResolve({ title, alt = [], showId, episode = 1, translationType = 'sub' }) {
  const params = new URLSearchParams({ action: 'resolve', episode: String(episode), translationType })
  if (title) params.set('title', title)
  const alts = [...new Set((alt || []).filter((t) => t && t !== title))].slice(0, 4)
  if (alts.length) params.set('alt', alts.join('|'))
  if (showId) params.set('showId', showId)
  return getJson(`${API}?${params.toString()}`)
}
