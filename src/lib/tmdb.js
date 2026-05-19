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

export function getTmdbImage(path, size = 'w500') {
  if (!path) return '/placeholder.jpg'
  return `https://image.tmdb.org/t/p/${size}${path}`
}

export async function getPopularMovies(page = 1) {
  return tmdbFetch('/movie/popular', { page })
}

export async function getPopularTV(page = 1) {
  return tmdbFetch('/tv/popular', { page })
}

export async function searchMovies(query, page = 1) {
  return tmdbFetch('/search/movie', {
    query,
    page,
    include_adult: false
  })
}

export async function searchTV(query, page = 1) {
  return tmdbFetch('/search/tv', {
    query,
    page,
    include_adult: false
  })
}

export async function searchMulti(query, page = 1) {
  return tmdbFetch('/search/multi', {
    query,
    page,
    include_adult: false
  })
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