import { useEffect, useState } from 'react'
import { getPopularTV, searchTV, getTmdbImage } from '../lib/tmdb'
import MediaCard from '../components/MediaCard'
import Icon from '../components/Icons'

export default function TVShows() {
  const [shows, setShows] = useState([])
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const data = query ? await searchTV(query) : await getPopularTV()
        if (active) setShows(data?.results || [])
      } catch { if (active) setShows([]) }
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [query])

  return (
    <div className="page">
      <h1 className="section-title" style={{ marginBottom: 16 }}>TV Shows</h1>

      <form onSubmit={(e) => { e.preventDefault(); setQuery(input.trim()) }}
        style={{ display: 'flex', gap: 10, marginBottom: 22, maxWidth: 560 }}>
        <div className="topbar-search" style={{ flex: 1, width: 'auto' }}>
          <Icon.search width="16" height="16" />
          <input placeholder="Search TV shows…" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <h2 className="section-title" style={{ fontSize: 18, marginBottom: 14 }}>
        {query ? `Results for “${query}”` : 'Popular TV Shows'}
      </h2>

      {loading ? (
        <div className="grid">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="skel skel-poster" />)}</div>
      ) : shows.length === 0 ? (
        <div className="empty"><div className="emoji">📺</div><p>No shows found.</p></div>
      ) : (
        <div className="grid">
          {shows.map((s) => (
            <MediaCard key={s.id} item={{
              href: `/tv/${s.id}`,
              poster: getTmdbImage(s.poster_path),
              title: s.name,
              score: s.vote_average,
              sub: s.first_air_date?.slice(0, 4),
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
