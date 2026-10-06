import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import Icon from '../components/Icons'
import { searchAnime, animeList } from '../lib/anime'

const TABS = [
  { id: 'trending', label: 'Trending' },
  { id: 'airing', label: 'Airing' },
  { id: 'popular', label: 'All-time' },
]

export default function Anime() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [input, setInput] = useState(q)
  const [tab, setTab] = useState('trending')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => { setInput(q) }, [q])

  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    const p = q ? searchAnime(q, 36) : animeList(tab, 36)
    p.then((items) => { if (active) { setList(items || []); setLoading(false) } })
      .catch(() => { if (active) { setList([]); setError(true); setLoading(false) } })
    return () => { active = false }
  }, [q, tab, nonce])

  const submit = useCallback((e) => {
    e.preventDefault()
    setParams(input.trim() ? { q: input.trim() } : {})
  }, [input, setParams])

  return (
    <div className="page">
      <h1 className="section-title" style={{ marginBottom: 14 }}>Anime</h1>

      <form onSubmit={submit} className="search-form">
        <div className="topbar-search search-field">
          <Icon.search width="16" height="16" />
          <input type="search" enterKeyHint="search" placeholder="Search anime…" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {q ? (
        <div className="list-head">
          <h2 className="section-title" style={{ fontSize: 18 }}>Results for “{q}”</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setParams({})}>Clear</button>
        </div>
      ) : (
        <div className="seg list-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={'seg-btn' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skel skel-poster" />)}
        </div>
      ) : error ? (
        <div className="empty"><div className="emoji">⚠️</div><p>Couldn’t reach the anime database.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setNonce((n) => n + 1)}>Try again</button>
        </div>
      ) : list.length === 0 ? (
        <div className="empty"><div className="emoji">🔍</div><p>No anime found for “{q}”.</p></div>
      ) : (
        <div className="grid">
          {list.map((a) => (
            <MediaCard key={a.mal_id} item={{
              href: `/anime/${a.mal_id}`,
              poster: a.images?.jpg?.large_image_url,
              title: a.title_english || a.title,
              score: a.score,
              kind: a.type,
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
