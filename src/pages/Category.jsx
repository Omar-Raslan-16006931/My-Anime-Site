import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import { fetchPage } from '../lib/browse'
import { CATEGORIES, isHiddenGenre, TMDB_MOVIE_GENRE, TMDB_TV_GENRE, categoryPath } from '../lib/categories'

export default function Category() {
  const { name: raw } = useParams()
  const name = decodeURIComponent(raw || '')
  const tabs = useMemo(() => {
    const t = [{ key: 'anime', label: 'Anime' }]
    if (TMDB_MOVIE_GENRE[name]) t.push({ key: 'movie', label: 'Movies' })
    if (TMDB_TV_GENRE[name]) t.push({ key: 'tv', label: 'TV Shows' })
    return t
  }, [name])

  const [tab, setTab] = useState('anime')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)

  // New category → back to the first tab.
  useEffect(() => { setTab('anime') }, [name])

  useEffect(() => {
    let active = true
    setLoading(true); setError(false); setItems([]); setPage(1); setHasNext(false)
    ;(async () => {
      try {
        const r = await fetchPage(tab, name, 1)
        if (!active) return
        setItems(r.items); setHasNext(r.hasNext); setError(!!r.failed)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [name, tab, tick])

  const loadMore = async () => {
    setMore(true)
    try {
      const r = await fetchPage(tab, name, page + 1)
      setItems((cur) => {
        const seen = new Set(cur.map((i) => i.href))
        return [...cur, ...r.items.filter((i) => !seen.has(i.href))]
      })
      setHasNext(r.hasNext); setPage((p) => p + 1)
    } catch { /* keep what we have */ }
    setMore(false)
  }

  if (!name || isHiddenGenre(name)) return <Navigate to="/" replace />

  return (
    <div className="page">
      <div className="cat-head">
        <h1 className="section-title">{name}</h1>
        {!loading && !error && items.length > 0 && (
          <span className="cat-count">{items.length}{hasNext ? '+' : ''} titles</span>
        )}
        {tabs.length > 1 && (
          <div className="cat-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={'cat-tab' + (tab === t.key ? ' on' : '')} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid">{Array.from({ length: 18 }).map((_, i) => <div key={i} className="skel skel-poster" />)}</div>
      ) : error ? (
        <div className="center-msg"><div>Couldn’t load this category. <button className="btn btn-primary btn-sm" onClick={() => setTick((n) => n + 1)} style={{ marginLeft: 8 }}>Retry</button></div></div>
      ) : !items.length ? (
        <div className="center-msg"><div>Nothing here yet.</div></div>
      ) : (
        <>
          <div className="grid">
            {items.map((it) => <MediaCard key={it.href} item={it} />)}
          </div>
          {hasNext && (
            <div style={{ textAlign: 'center', margin: '28px 0 8px' }}>
              <button className="btn btn-ghost" onClick={loadMore} disabled={more}>{more ? 'Loading…' : 'Load more'}</button>
            </div>
          )}
        </>
      )}

      <div className="cat-others">
        <div className="cat-others-title">More categories</div>
        <div className="genre-chips">
          {CATEGORIES.filter((g) => g !== name).map((g) => <Link key={g} to={categoryPath(g)} className="genre-chip">{g}</Link>)}
        </div>
      </div>
    </div>
  )
}
