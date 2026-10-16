import { searchAnimeFiltered } from './anime'
import { searchMovies, searchTV, getTmdbImage } from './tmdb'

// Ask the server for picks → { picks: [{ title, type, year, reason }], provider, model, note }.
export async function fetchPicks({ prompt, kind, watched }) {
  const res = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, kind, watched }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.message || 'Could not get recommendations.')
    err.code = data?.error
    throw err
  }
  return { picks: data.picks || [], provider: data.provider, model: data.model, note: data.note }
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// Turn one pick into a card (real poster, link and rating) via our own sources.
export async function resolvePick(p) {
  try {
    if (p.type === 'anime') {
      const list = await searchAnimeFiltered({ q: p.title })
      const a = list.find((x) => norm(x.title_english) === norm(p.title) || norm(x.title) === norm(p.title)) || list[0]
      if (!a || !a.mal_id) return null
      return { ...p, href: `/anime/${a.mal_id}`, poster: a.images?.jpg?.large_image_url, score: a.score, kind: a.type, name: a.title_english || a.title }
    }
    if (p.type === 'movie') {
      const r = (await searchMovies(p.title))?.results || []
      const m = r.find((x) => x.poster_path && norm(x.title) === norm(p.title)) || r.find((x) => x.poster_path)
      if (!m) return null
      return { ...p, href: `/movie/${m.id}`, poster: getTmdbImage(m.poster_path), score: m.vote_average, kind: 'Movie', name: m.title }
    }
    const r = (await searchTV(p.title))?.results || []
    const s = r.find((x) => x.poster_path && norm(x.name) === norm(p.title)) || r.find((x) => x.poster_path)
    if (!s) return null
    return { ...p, href: `/tv/${s.id}`, poster: getTmdbImage(s.poster_path), score: s.vote_average, kind: 'TV', name: s.name }
  } catch { return null }
}
