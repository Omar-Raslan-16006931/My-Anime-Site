import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Watchlist({ user, onAuthRequired, onSelect }) {
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!user) {
      onAuthRequired()
      return
    }

    supabase.from('watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
      .then(({ data }) => {
        setWatchlist(data || [])
        setLoading(false)
      })
  }, [user])

  const removeFromWatchlist = async (e, mal_id) => {
    e.stopPropagation()
    await supabase.from('watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('mal_id', mal_id)
    setWatchlist(prev => prev.filter(a => a.mal_id !== mal_id))
  }

  if (!user) return null

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: isMobile ? '12px' : '32px 24px'
    }}>
      <h1 style={{
        fontSize: isMobile ? 22 : 28,
        fontWeight: 800,
        marginBottom: 6
      }}>
        My Watchlist
      </h1>
      <p style={{
        color: 'var(--text2)',
        marginBottom: isMobile ? 20 : 32,
        fontSize: isMobile ? 13 : 14
      }}>
        {watchlist.length} anime saved
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>Loading...</div>
      ) : watchlist.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: isMobile ? '50px 10px' : 80
        }}>
          <div style={{ fontSize: isMobile ? 44 : 64, marginBottom: 16 }}>📭</div>
          <p style={{ color: 'var(--text2)', fontSize: isMobile ? 16 : 18 }}>
            Your watchlist is empty
          </p>
          <p style={{ color: 'var(--text2)', fontSize: isMobile ? 12 : 14, marginTop: 8 }}>
            Browse anime and click ☆ to add them here
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: isMobile ? 10 : 20
        }}>
          {watchlist.map(anime => (
            <div
              key={anime.mal_id}
              onClick={() => onSelect({
                mal_id: anime.mal_id,
                title: anime.title,
                images: { jpg: { large_image_url: anime.poster } },
                score: anime.score
              })}
              style={{
                background: 'var(--card)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
                position: 'relative'
              }}
              onMouseEnter={e => {
                if (!isMobile) {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)'
                }
              }}
              onMouseLeave={e => {
                if (!isMobile) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              <div style={{ position: 'relative', aspectRatio: isMobile ? '3/4' : '2/3' }}>
                <img
                  src={anime.poster}
                  alt={anime.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {anime.score && (
                  <div style={{
                    position: 'absolute',
                    top: isMobile ? 6 : 8,
                    left: isMobile ? 6 : 8,
                    background: 'rgba(0,0,0,0.8)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    fontSize: isMobile ? 11 : 13,
                    padding: isMobile ? '2px 6px' : '3px 8px',
                    borderRadius: 6
                  }}>
                    ⭐ {anime.score}
                  </div>
                )}

                <button
                  onClick={(e) => removeFromWatchlist(e, anime.mal_id)}
                  style={{
                    position: 'absolute',
                    top: isMobile ? 6 : 8,
                    right: isMobile ? 6 : 8,
                    background: 'var(--accent)',
                    color: '#fff',
                    width: isMobile ? 28 : 32,
                    height: isMobile ? 28 : 32,
                    borderRadius: '50%',
                    fontSize: isMobile ? 14 : 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ★
                </button>
              </div>

              <div style={{ padding: isMobile ? 8 : 12 }}>
                <h3 style={{
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 600,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.25
                }}>
                  {anime.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}