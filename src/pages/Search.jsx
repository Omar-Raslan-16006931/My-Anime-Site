import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import Icon from '../components/Icons'
import { searchAnimeFiltered } from '../lib/anime'
import { searchMovies, searchTV, discoverMovies, discoverTV, getTmdbImage } from '../lib/tmdb'
import { CATEGORIES, TMDB_MOVIE_GENRE, TMDB_TV_GENRE } from '../lib/categories'

// Unified search across anime, TV shows and movies, with optional category
// filters (pick one or several — a title must match all of them), a type
// filter and a minimum rating. Each section loads and fails independently.
const EMPTY = { items: [], loading: false, error: false }
const TYPES = [['all', 'All'], ['anime', 'Anime'], ['tv', 'TV Shows'], ['movie', 'Movies']]
const RATINGS = [[0, 'Any'], [6, '6+'], [7, '7+'], [8, '8+']]

const idsFor = (map, genres) => [...new Set(genres.map((g) => map[g]))]

export default function Search() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') || '').trim()
  const genres = useMemo(() => (params.get('g') || '').split(',').filter((g) => CATEGORIES.includes(g)), [params])
  const type = TYPES.some(([k]) => k === params.get('t')) ? params.get('t') : 'all'
  const minScore = Number(params.get('r')) || 0

  const [input, setInput] = useState(q)
  const [showFilters, setShowFilters] = useState(params.get('f') === '1')
  const [anime, setAnime] = useState(EMPTY)
  const [tv, setTv] = useState(EMPTY)
  const [movies, setMovies] = useState(EMPTY)
  const [nonce, setNonce] = useState(0)

  useEffect(() => { setInput(q) }, [q])

  const update = useCallback((patch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v == null || v === 0 || v === 'all') next.delete(k); else next.set(k, String(v))
    }
    setParams(next, { replace: true })
  }, [params, setParams])

  const toggleGenre = (g) => update({ g: (genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g]).join(',') })
  const active = !!q || genres.length > 0
  const clearFilters = () => update({ g: '', t: '', r: 0 })
  const filterCount = genres.length + (type !== 'all' ? 1 : 0) + (minScore ? 1 : 0)

  useEffect(() => {
    if (!active) { setAnime(EMPTY); setTv(EMPTY); setMovies(EMPTY); return }
    let on = true
    const run = (enabled, fn, set) => {
      if (!enabled) { set(EMPTY); return }
      set({ items: [], loading: true, error: false })
      fn()
        .then((items) => on && set({ items, loading: false, error: false }))
        .catch(() => on && set({ items: [], loading: false, error: true }))
    }
    const hasAll = (ids, map) => genres.every((g) => ids?.includes(map[g]))
    const rated = (x) => !minScore || (x.vote_average || 0) >= minScore

    run(type === 'all' || type === 'anime', () => searchAnimeFiltered({ q, genres, minScore }), setAnime)

    // TMDB only knows some of our categories; if any picked one is unknown, that source has nothing.
    const tvOk = genres.every((g) => TMDB_TV_GENRE[g])
    const mvOk = genres.every((g) => TMDB_MOVIE_GENRE[g])
    run((type === 'all' || type === 'tv') && tvOk, async () => {
      const d = q ? await searchTV(q) : await discoverTV(idsFor(TMDB_TV_GENRE, genres).join(','))
      return (d?.results || []).filter((s) => !s.adult && s.poster_path && rated(s) && (!q || !genres.length || hasAll(s.genre_ids, TMDB_TV_GENRE)))
    }, setTv)
    run((type === 'all' || type === 'movie') && mvOk, async () => {
      const d = q ? await searchMovies(q) : await discoverMovies(idsFor(TMDB_MOVIE_GENRE, genres).join(','))
      return (d?.results || []).filter((m) => !m.adult && m.poster_path && rated(m) && (!q || !genres.length || hasAll(m.genre_ids, TMDB_MOVIE_GENRE)))
    }, setMovies)
    return () => { on = false }
  }, [q, genres, type, minScore, active, nonce])

  const submit = useCallback((e) => {
    e.preventDefault()
    update({ q: input.trim() })
    document.activeElement?.blur?.()
  }, [input, update])

  const retry = () => setNonce((n) => n + 1)
  const allDone = !anime.loading && !tv.loading && !movies.loading
  const nothing = allDone && !anime.items.length && !tv.items.length && !movies.items.length
  const anyError = anime.error || tv.error || movies.error

  return (
    <div className="page">
      <h1 className="section-title" style={{ marginBottom: 14 }}>Search</h1>

      <form onSubmit={submit} className="search-form">
        <div className="topbar-search search-field">
          <Icon.search width="16" height="16" />
          <input
            type="search"
            enterKeyHint="search"
            placeholder="Anime, shows, movies…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus={!active}
          />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <div className="sf">
        <button type="button" className={'sf-toggle' + (showFilters ? ' open' : '')} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Filters{filterCount ? <span className="sf-badge">{filterCount}</span> : null}
          <svg className="sf-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {filterCount > 0 && <button type="button" className="sf-clear" onClick={clearFilters}>Clear all</button>}

        <div className={'sf-panel' + (showFilters ? ' open' : '')}>
          <div className="sf-inner">
            <div className="sf-label">Categories <span>pick one or more</span></div>
            <div className="sf-chips">
              {CATEGORIES.map((g) => (
                <button key={g} type="button" className={'sf-chip' + (genres.includes(g) ? ' on' : '')} aria-pressed={genres.includes(g)} onClick={() => toggleGenre(g)}>
                  {genres.includes(g) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                  {g}
                </button>
              ))}
            </div>
            <div className="sf-row">
              <div>
                <div className="sf-label">Type</div>
                <div className="fu-seg">
                  {TYPES.map(([k, l]) => <button key={k} type="button" className={'fu-seg-btn' + (type === k ? ' on' : '')} onClick={() => update({ t: k })}>{l}</button>)}
                </div>
              </div>
              <div>
                <div className="sf-label">Min rating</div>
                <div className="fu-seg">
                  {RATINGS.map(([k, l]) => <button key={k} type="button" className={'fu-seg-btn' + (minScore === k ? ' on' : '')} onClick={() => update({ r: k })}>{l}</button>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!active ? (
        <div className="empty"><div className="emoji">🔍</div><p>Search by name, or pick categories above to browse.</p></div>
      ) : nothing ? (
        <div className="empty">
          <div className="emoji">{anyError ? '⚠️' : '🤷'}</div>
          <p>{anyError ? 'Search had trouble reaching some sources.' : 'Nothing matches those filters.'}</p>
          {anyError && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={retry}>Try again</button>}
        </div>
      ) : (
        <>
          <Section title="Anime" state={anime} onRetry={retry}>
            {anime.items.map((a) => (
              <MediaCard key={'a' + a.mal_id} item={{
                href: `/anime/${a.mal_id}`,
                poster: a.images?.jpg?.large_image_url,
                title: a.title_english || a.title,
                score: a.score,
                kind: a.type,
              }} />
            ))}
          </Section>

          <Section title="TV Shows" state={tv} onRetry={retry}>
            {tv.items.map((s) => (
              <MediaCard key={'t' + s.id} item={{
                href: `/tv/${s.id}`, poster: s.poster_path ? getTmdbImage(s.poster_path) : null,
                title: s.name, score: s.vote_average, sub: s.first_air_date?.slice(0, 4),
              }} />
            ))}
          </Section>

          <Section title="Movies" state={movies} onRetry={retry}>
            {movies.items.map((m) => (
              <MediaCard key={'m' + m.id} item={{
                href: `/movie/${m.id}`, poster: m.poster_path ? getTmdbImage(m.poster_path) : null,
                title: m.title, score: m.vote_average, sub: m.release_date?.slice(0, 4),
              }} />
            ))}
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, state, onRetry, children }) {
  if (!state.loading && !state.error && !state.items.length) return null
  return (
    <section className="search-section">
      <h2 className="section-title search-h">
        {title}
        {!state.loading && state.items.length > 0 && <span className="search-count">{state.items.length}</span>}
      </h2>
      {state.loading ? (
        <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel skel-poster" />)}</div>
      ) : state.error ? (
        <div className="search-err">
          Couldn’t load {title.toLowerCase()} right now.
          <button className="btn btn-ghost btn-sm" onClick={onRetry}>Retry</button>
        </div>
      ) : (
        <div className="grid">{children}</div>
      )}
    </section>
  )
}
