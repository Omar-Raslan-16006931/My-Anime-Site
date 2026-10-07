const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE_URL =
  import.meta.env.VITE_TMDB_BASE_URL || 'https://api.themoviedb.org/3'

export async function tmdbFetch(path, params = {}) {
  if (!TMDB_API_KEY) {
    throw new Error(
      'Missing TMDB API key: set VITE_TMDB_API_KEY in your environment (.env) and restart the dev server.'
    )
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`)

  url.searchParams.set('api_key', TMDB_API_KEY)
  url.searchParams.set('language', 'en-US')

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json'
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`TMDB request failed: ${res.status} - ${text}`)
  }

  return res.json()
}

// ── Adult / hentai filter ────────────────────────────────────────────────────
// TMDB's `adult` flag only marks outright porn; hentai anime is usually NOT
// flagged, so we also check the text. Strong words count anywhere; softer ones
// only on Animation (genre 16), so live-action shows aren't caught by mistake.
const STRONG_ADULT = /\b(hentai|eroge|porn|porno|pornographic|uncensored|nsfw|r-?18|18\+|jav)\b/i
const SOFT_ADULT = /\b(ecchi|erotic|erotica|lewd|nude|nudity)\b/i

export function isAdultTmdb(item) {
  if (!item) return false
  if (item.adult) return true
  const text = [item.name, item.title, item.original_name, item.original_title, item.overview].filter(Boolean).join(' ')
  if (STRONG_ADULT.test(text)) return true
  const genres = item.genre_ids || (item.genres || []).map((g) => g.id)
  return genres.includes(16) && SOFT_ADULT.test(text)
}

// Detail-level check (needs append_to_response=content_ratings,keywords or
// release_dates,keywords): Japan's R18+ rating or a "hentai" keyword.
export function isAdultTmdbDetails(d) {
  if (!d) return false
  if (isAdultTmdb(d)) return true
  const kws = [...(d.keywords?.results || []), ...(d.keywords?.keywords || [])].map((k) => String(k.name || '').toLowerCase())
  if (kws.some((k) => k === 'hentai' || k.includes('hentai') || k === 'eroge' || k === 'pornography')) return true
  const tvRatings = (d.content_ratings?.results || []).map((r) => String(r.rating || ''))
  const movieRatings = (d.release_dates?.results || []).flatMap((r) => (r.release_dates || []).map((x) => String(x.certification || '')))
  return [...tvRatings, ...movieRatings].some((r) => /^r-?18\+?$/i.test(r.trim()))
}

const cleanResults = (data) =>
  data && Array.isArray(data.results) ? { ...data, results: data.results.filter((x) => !isAdultTmdb(x)) } : data

export function getTmdbImage(path, size = 'w500') {
  if (!path) return '/placeholder.jpg'
  return `https://image.tmdb.org/t/p/${size}${path}`
}

export async function getPopularMovies(page = 1) {
  return cleanResults(await tmdbFetch('/movie/popular', { page }))
}

export async function getPopularTV(page = 1) {
  return cleanResults(await tmdbFetch('/tv/popular', { page }))
}

export async function searchMovies(query, page = 1) {
  return cleanResults(await tmdbFetch('/search/movie', {
    query,
    page,
    include_adult: false
  }))
}

export async function searchTV(query, page = 1) {
  return cleanResults(await tmdbFetch('/search/tv', {
    query,
    page,
    include_adult: false
  }))
}

export async function searchMulti(query, page = 1) {
  return cleanResults(await tmdbFetch('/search/multi', {
    query,
    page,
    include_adult: false
  }))
}

export async function getMovieDetails(id) {
  return tmdbFetch(`/movie/${id}`, {
    append_to_response: 'videos,credits,similar'
  })
}

export async function getTVDetails(id) {
  return tmdbFetch(`/tv/${id}`, {
    append_to_response: 'videos,credits,similar'
  })
}

export async function getTVSeasonDetails(id, seasonNumber) {
  return tmdbFetch(`/tv/${id}/season/${seasonNumber}`)
}