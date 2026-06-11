import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Icon from '../components/Icons'
import { toast } from '../lib/toast'

export default function CurrentlyWatching({ user, onAuthRequired }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let active = true
    setLoading(true)
    ;(async () => {
      const [a, t] = await Promise.all([
        supabase.from('currently_watching').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('currently_watching_tmdb').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      ])
      if (!active) return
      const merged = [
        ...(a.data || []).map((i) => ({ ...i, source_table: 'currently_watching' })),
        ...(t.data || []).map((i) => ({ ...i, source_table: 'currently_watching_tmdb' })),
      ].sort((x, y) => new Date(y.updated_at) - new Date(x.updated_at))
      setItems(merged); setLoading(false)
    })()
    return () => { active = false }
  }, [user])

  const href = (i) => (i.media_type === 'tv' && i.tmdb_id ? `/tv/${i.tmdb_id}` : i.media_type === 'movie' && i.tmdb_id ? `/movie/${i.tmdb_id}` : i.mal_id ? `/anime/${i.mal_id}` : '/')
  const keyOf = (i) => `${i.source_table}-${i.id}`
  const meta = (i) => i.media_type === 'tv' ? `S${i.season_number || 1} · E${i.last_episode || 1}` : i.media_type === 'movie' ? 'Movie' : `Ep. ${i.last_episode || 1}${i.total_episodes ? ` / ${i.total_episodes}` : ''}`

  const doDelete = async () => {
    if (!confirm) return
    const item = confirm
    setConfirm(null)
    await supabase.from(item.source_table || 'currently_watching').delete().eq('id', item.id).eq('user_id', user.id)
    setItems((prev) => prev.filter((x) => keyOf(x) !== keyOf(item)))
    toast(`Removed “${item.title}”`)
  }

  if (!user) {
    return <div className="page"><div className="empty"><div className="emoji">🔒</div><p>Sign in to view your list.</p>
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onAuthRequired}>Sign In</button></div></div>
  }
  if (loading) return <div className="page"><div className="center-msg"><span className="spinner" /></div></div>

  return (
    <div className="page">
      <h1 className="section-title" style={{ marginBottom: 18 }}>Currently Watching</h1>

      {items.length === 0 ? (
        <div className="empty"><div className="emoji">🍿</div><p>Nothing in progress yet.</p></div>
      ) : (
        <div className="grid">
          {items.map((i) => (
            <div key={keyOf(i)} className="card" onClick={() => navigate(href(i))}>
              <div className="card-poster">
                {i.poster ? <img src={i.poster} alt={i.title} /> : null}
                {i.score ? <span className="card-score"><Icon.star width="10" height="10" />{Number(i.score).toFixed(1)}</span> : null}
                <button className="card-fav on" onClick={(e) => { e.stopPropagation(); setConfirm(i) }} aria-label="Remove"><Icon.close width="15" height="15" /></button>
                <div className="pcard-badge" style={{ left: 8, bottom: 8 }}>{meta(i)}</div>
              </div>
              <div className="card-title">{i.title}</div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <div className="modal" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Remove from list?</h3>
            <p className="muted" style={{ marginBottom: 20 }}>Remove <strong style={{ color: 'var(--text)' }}>{confirm.title}</strong>?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={doDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
