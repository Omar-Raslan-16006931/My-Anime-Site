// Shared catalogue fetching for the Browse and Category pages.
import { animeByGenre, animeList } from './anime'
import { discoverMovies, discoverTV, getPopularMovies, getPopularTV, getTmdbImage } from './tmdb'
import { TMDB_MOVIE_GENRE, TMDB_TV_GENRE } from './categories'

export const animeCard = (a) => ({
  href: `/anime/${a.mal_id}`,
  poster: a.images?.jpg?.large_image_url,
  title: a.title_english || a.title,
  score: a.score,
  kind: a.type,
})
export const movieCard = (m) => ({ href: `/movie/${m.id}`, poster: getTmdbImage(m.poster_path), title: m.title, score: m.vote_average, sub: m.release_date?.slice(0, 4) })
export const tvCard = (s) => ({ href: `/tv/${s.id}`, poster: getTmdbImage(s.poster_path), title: s.name, score: s.vote_average, sub: s.first_air_date?.slice(0, 4) })

// One page of a category. tab = 'anime' | 'movie' | 'tv'.
export async function fetchPage(tab, name, page) {
  // Tab state can lag a category change by one render; never query TMDB without a genre.
  if (tab === 'movie' && !TMDB_MOVIE_GENRE[name]) tab = 'anime'
  if (tab === 'tv' && !TMDB_TV_GENRE[name]) tab = 'anime'
  if (tab === 'movie') {
    const d = await discoverMovies(TMDB_MOVIE_GENRE[name], page)
    return { items: (d.results || []).filter((m) => m.poster_path).map(movieCard), hasNext: page < Math.min(d.total_pages || 1, 20) }
  }
  if (tab === 'tv') {
    const d = await discoverTV(TMDB_TV_GENRE[name], page)
    return { items: (d.results || []).filter((s) => s.poster_path).map(tvCard), hasNext: page < Math.min(d.total_pages || 1, 20) }
  }
  const r = await animeByGenre(name, page, 30)
  return { items: r.list.map(animeCard), hasNext: r.hasNext, failed: r.failed }
}

// The three top-level groups on the Browse page (no genre).
export async function fetchGroup(group, page) {
  if (group === 'Movies') {
    const d = await getPopularMovies(page)
    return { items: (d.results || []).filter((m) => m.poster_path).map(movieCard), hasNext: page < Math.min(d.total_pages || 1, 20) }
  }
  if (group === 'TV') {
    const d = await getPopularTV(page)
    return { items: (d.results || []).filter((s) => s.poster_path).map(tvCard), hasNext: page < Math.min(d.total_pages || 1, 20) }
  }
  // Anime: AniList lists aren't paged here, so ask for a big first page.
  const l = await animeList('popular', 48)
  return { items: (l || []).map(animeCard), hasNext: false }
}
