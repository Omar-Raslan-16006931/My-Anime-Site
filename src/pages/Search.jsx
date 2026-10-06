import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import Icon from '../components/Icons'
import { searchAnime } from '../lib/anime'
import { searchMovies, searchTV, getTmdbImage } from '../lib/tmdb'

// Unified search across anime, TV shows and movies. Each section loads and
// fails independently, so one slow/broken API never blanks the whole page.
const EMPTY = { items: [], loading: false, error: false }

export default function Search() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') || '').trim()
  const [input, setInput] = useState(q)
  const [anime, setAnime] = useState(EMPTY)
  const [tv, setTv] = useState(EMPTY)
  const [movies, setMovies] = useState(EMPTY)
  const [nonce, setNonce] = useState(0)

  useEffect(() => { setInput(q) }, [q])

  useEffect(() => {
    if (!q) { setAnime(EMPTY); setTv(EMPTY); setMovies(EMPTY); return }
    let on = true
    const run = (fn, set, map) => {
      set({ items: [], loading: true, error: false })
      fn()
        .then((res) => on && set({ items: map(res), loading: false, error: false }))
        .catch(() => on && set({ items: [], loading: false, error: true }))
    }
    run(() => searchAnime(q), setAnime, (list) => list)
    run(() => searchTV(q), setTv, (d) => (d?.results || []).filter((s) => !s.adult))
    run(() => searchMovies(q), setMovies, (d) => (d?.results || []).filter((m) => !m.adult))
    return () => { on = false }
  }, [q, nonce])

  const submit = useCallback((e) => {
    e.preventDefault()
    const v = input.trim()
    setParams(v ? { q: v } : {})
  }, [input, setParams])

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
            autoFocus={!q}
          />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {!q ? (
        <div className="empty"><div className="emoji">🔍</div><p>Search across anime, TV shows and movies.</p></div>
      ) : nothing ? (
        <div className="empty">
          <div className="emoji">{anyError ? '⚠️' : '🤷'}</div>
          <p>{anyError ? 'Search had trouble reaching some sources.' : `Nothing found for “${q}”.`}</p>
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
