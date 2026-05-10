import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Watchlist({ user, onAuthRequired, onSelect }) {
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { onAuthRequired(); return }
    supabase.from('watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
      .then(({ data }) => { setWatchlist(data || []); setLoading(false) })
  }, [user])

  const removeFromWatchlist = async (e, mal_id) => {
    e.stopPropagation()
    await supabase.from('watchlist')
      .delete().eq('user_id', user.id).eq('mal_id', mal_id)
    setWatchlist(prev => prev.filter(a => a.mal_id !== mal_id))
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>My Watchlist</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 32 }}>{watchlist.length} anime saved</p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>Loading...</div>
      ) : watchlist.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
          <p style={{ color: 'var(--text2)', fontSize: 18 }}>Your watchlist is empty</p>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 8 }}>
            Browse anime and click ☆ to add them here
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 20
        }}>
          {watchlist.map(anime => (
            <div key={anime.mal_id} onClick={() => onSelect({ mal_id: anime.mal_id, title: anime.title, images: { jpg: { large_image_url: anime.poster } }, score: anime.score })}
              style={{
                background: 'var(--card)', borderRadius: 'var(--radius)',
                overflow: 'hidden', border: '1px solid var(--border)',
                transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer',
                position: 'relative'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ position: 'relative', aspectRatio: '2/3' }}>
                <img src={anime.poster} alt={anime.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {anime.score && (
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(0,0,0,0.8)', color: '#fbbf24',
                    fontWeight: 700, fontSize: 13, padding: '3px 8px', borderRadius: 6
                  }}>⭐ {anime.score}</div>
                )}
                <button onClick={(e) => removeFromWatchlist(e, anime.mal_id)} style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'var(--accent)', color: '#fff',
                  width: 32, height: 32, borderRadius: '50%', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>★</button>
              </div>
              <div style={{ padding: 12 }}>
                <h3 style={{
                  fontSize: 13, fontWeight: 600,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                }}>{anime.title}</h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}