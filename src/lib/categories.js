// Site-wide categories (genres).
//
// Order matters: the first nine are the ones the home page and the menu lead
// with. Genres in HIDDEN_GENRES are removed from the whole site: not in the
// menu, not shown on show pages, and anime tagged with them is left out of
// lists and search results.

export const HIDDEN_GENRES = ['Mahou Shoujo']

export const PRIORITY_CATEGORIES = [
  'Action', 'Horror', 'Psychological', 'Supernatural', 'Adventure',
  'Thriller', 'Drama', 'Fantasy', 'Mystery',
]

export const CATEGORIES = [
  ...PRIORITY_CATEGORIES,
  'Comedy', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Mecha', 'Music',
]

const hidden = new Set(HIDDEN_GENRES.map((g) => g.toLowerCase()))
export const isHiddenGenre = (name) => hidden.has(String(name || '').toLowerCase())

// TMDB genre names → our category names (some TMDB genres cover two).
const TMDB_ALIASES = {
  'science fiction': ['Sci-Fi'],
  'sci-fi & fantasy': ['Sci-Fi', 'Fantasy'],
  'action & adventure': ['Action', 'Adventure'],
}

// Any list of genre names (AniList or TMDB) → unique, visible category names.
export function normalizeGenres(names = []) {
  const out = []
  for (const raw of names || []) {
    const n = typeof raw === 'string' ? raw : raw?.name
    if (!n) continue
    const mapped = TMDB_ALIASES[n.toLowerCase()] || [n]
    for (const g of mapped) {
      if (isHiddenGenre(g) || out.includes(g)) continue
      out.push(g)
    }
  }
  return out
}

// Which TMDB genre ids back each category (anime is always available).
export const TMDB_MOVIE_GENRE = {
  Action: 28, Adventure: 12, Horror: 27, Thriller: 53, Drama: 18, Fantasy: 14,
  Mystery: 9648, Comedy: 35, Romance: 10749, 'Sci-Fi': 878, Music: 10402,
}
export const TMDB_TV_GENRE = {
  Action: 10759, Adventure: 10759, Drama: 18, Fantasy: 10765, Mystery: 9648,
  Comedy: 35, 'Sci-Fi': 10765,
}

export const categoryPath = (name) => `/category/${encodeURIComponent(name)}`
