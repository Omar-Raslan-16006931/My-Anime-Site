import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { udb } from '../lib/udb'
import Icon from '../components/Icons'
import { toast } from '../lib/toast'
import { useFlip } from '../lib/flip'
import { useWatched, markWatched, removeWatched } from '../lib/watched'

export default function Watchlist({ user, onAuthRequired }) {
  const navigate = useNavigate()
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [leaving, setLeaving] = useState(() => new Set())
  const gridRef = useRef(null)
  const watched = useWatched(user)
  useFlip(gridRef, watchlist)

  useEffect(() => {
    if (!user) { onAuthRequired?.(); setLoading(false); return }
    setLoading(true)
    udb.from('watchlist').select('*').eq('user_id', user.id).order('added_at', { ascending: false })
      .then(({ data }) => { setWatchlist(data || []); setLoading(false) })
  }, [user, onAuthRequired])

  const href = (i) => (i.media_type === 'tv' && i.tmdb_id ? `/tv/${i.tmdb_id}` : i.media_type === 'movie' && i.tmdb_id ? `/movie/${i.tmdb_id}` : i.mal_id ? `/anime/${i.mal_id}` : '/')
  const kind = (i) => (i.media_type === 'tv' ? 'TV' : i.media_type === 'movie' ? 'MOVIE' : 'ANIME')

  const keyOf = (i) => i.id || `${i.media_type}-${i.tmdb_id || i.mal_id}`

  const doRemove = async () => {
    const item = confirm
    if (!item) return
    setConfirm(null)
    setLeaving((s) => new Set(s).add(keyOf(item)))
    const wait = new Promise((r) => setTimeout(r, 420))
    let q = udb.from('watchlist').delete().eq('user_id', user.id)
    if (item.id) q = q.eq('id', item.id)
    else if (item.mal_id) q = q.eq('mal_id', item.mal_id)
    else if (item.tmdb_id && item.media_type) q = q.eq('tmdb_id', item.tmdb_id).eq('media_type', item.media_type)
    await Promise.all([q, wait])
    setWatchlist((prev) => prev.filter((w) => (item.id ? w.id !== item.id : item.mal_id ? w.mal_id !== item.mal_id : !(w.tmdb_id === item.tmdb_id && w.media_type === item.media_type))))
    toast(`Removed “${item.title}” from My List`)
  }

  if (!user) return null

  return (
    <div className="page">
      <h1 className="section-title" style={{ marginBottom: 4 }}>My List</h1>
      <p className="muted" style={{ marginBottom: 22 }}>{watchlist.length} saved</p>

      {loading ? (
        <div className="grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel skel-poster" />)}</div>
      ) : watchlist.length === 0 ? (
        <div className="empty"><div className="emoji">📭</div><p>Your list is empty</p>
          <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>Tap the + on any title to save it here.</p>
        </div>
      ) : (
        <div className="grid" ref={gridRef}>
          {watchlist.map((i) => (
            <div key={keyOf(i)} data-flip={keyOf(i)} className={'card' + (leaving.has(keyOf(i)) ? ' leaving' : '')} onClick={() => navigate(href(i))}>
              <div className="card-poster">
                {i.poster ? <img src={i.poster} alt={i.title} /> : null}
                {i.score ? <span className="card-score"><Icon.star width="10" height="10" />{Number(i.score).toFixed(1)}</span> : null}
                <span className="card-kind">{kind(i)}</span>
                <button className="card-fav on" onClick={(e) => { e.stopPropagation(); setConfirm(i) }} aria-label="Remove"><Icon.check width="15" height="15" /></button>
                <button className={'card-fav card-done' + (watched.has(i) ? ' seen' : '')} onClick={(e) => { e.stopPropagation(); if (watched.has(i)) { removeWatched(user, i); toast('Removed from Watched') } else markWatched(user, i) }} aria-label={watched.has(i) ? 'Watched' : 'Mark as watched'} aria-pressed={watched.has(i)} title={watched.has(i) ? 'Watched' : 'Mark as watched'}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
              </div>
              <div className="card-title">{i.title}</div>
              {(i.last_episode || i.season_number) ? (
                <div className="card-sub">{[i.season_number ? `S${i.season_number}` : null, i.last_episode ? `Ep ${i.last_episode}` : null].filter(Boolean).join(' · ')}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <div className="modal" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Remove from My List?</h3>
            <p className="muted" style={{ marginBottom: 20 }}><strong style={{ color: 'var(--text)' }}>{confirm.title}</strong> will be removed from your list.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={doRemove}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
