import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import Icon from '../components/Icons'

async function jikan(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url)
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 800 * (i + 1))); continue }
    if (res.ok) return res.json()
    return { data: [] }
  }
  return { data: [] }
}

export default function Anime() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [input, setInput] = useState(q)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { setInput(q) }, [q])

  useEffect(() => {
    let active = true
    setLoading(true)
    const url = q
      ? `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=24&sfw=true&order_by=popularity`
      : 'https://api.jikan.moe/v4/top/anime?limit=24'
    jikan(url).then((d) => { if (active) { setList(d.data || []); setLoading(false) } })
    return () => { active = false }
  }, [q])

  const submit = useCallback((e) => {
    e.preventDefault()
    setParams(input.trim() ? { q: input.trim() } : {})
  }, [input, setParams])

  return (
    <div className="page">
      <h1 className="section-title" style={{ marginBottom: 16 }}>Anime</h1>

      <form onSubmit={submit} style={{ display: 'flex', gap: 10, marginBottom: 22, maxWidth: 560 }}>
        <div className="topbar-search" style={{ flex: 1, width: 'auto' }}>
          <Icon.search width="16" height="16" />
          <input placeholder="Search anime…" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <h2 className="section-title" style={{ fontSize: 18, marginBottom: 14 }}>
        {q ? `Results for “${q}”` : 'Top Anime'}
      </h2>

      {loading ? (
        <div className="grid">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skel skel-poster" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="empty"><div className="emoji">🔍</div><p>No anime found.</p></div>
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
