import { useEffect, useState } from 'react'
import { getPopularMovies, searchMovies, getTmdbImage } from '../lib/tmdb'
import MediaCard from '../components/MediaCard'
import Icon from '../components/Icons'

export default function Movies() {
  const [movies, setMovies] = useState([])
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const data = query ? await searchMovies(query) : await getPopularMovies()
        if (active) setMovies(data?.results || [])
      } catch { if (active) setMovies([]) }
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [query])

  return (
    <div className="page">
      <h1 className="section-title" style={{ marginBottom: 16 }}>Movies</h1>

      <form onSubmit={(e) => { e.preventDefault(); setQuery(input.trim()) }}
        style={{ display: 'flex', gap: 10, marginBottom: 22, maxWidth: 560 }}>
        <div className="topbar-search" style={{ flex: 1, width: 'auto' }}>
          <Icon.search width="16" height="16" />
          <input placeholder="Search movies…" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <h2 className="section-title" style={{ fontSize: 18, marginBottom: 14 }}>
        {query ? `Results for “${query}”` : 'Popular Movies'}
      </h2>

      {loading ? (
        <div className="grid">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="skel skel-poster" />)}</div>
      ) : movies.length === 0 ? (
        <div className="empty"><div className="emoji">🎬</div><p>No movies found.</p></div>
      ) : (
        <div className="grid">
          {movies.map((m) => (
            <MediaCard key={m.id} item={{
              href: `/movie/${m.id}`,
              poster: getTmdbImage(m.poster_path),
              title: m.title,
              score: m.vote_average,
              sub: m.release_date?.slice(0, 4),
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
