import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Watchlist({ user, onAuthRequired }) {
  const navigate = useNavigate()

  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!user) {
      onAuthRequired?.()
      setLoading(false)
      return
    }

    setLoading(true)

    supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
      .then(({ data }) => {
        setWatchlist(data || [])
        setLoading(false)
      })
  }, [user, onAuthRequired])

  const getHref = (item) => {
    if (item.media_type === 'tv' && item.tmdb_id) return `/tv/${item.tmdb_id}`
    if (item.media_type === 'movie' && item.tmdb_id) return `/movie/${item.tmdb_id}`
    if (item.mal_id) return `/anime/${item.mal_id}`
    return '/'
  }

  const removeFromWatchlist = async (e, item) => {
    e.stopPropagation()

    let query = supabase
      .from('watchlist')
      .delete()
      .eq('user_id', user.id)

    if (item.id) {
      query = query.eq('id', item.id)
    } else if (item.mal_id) {
      query = query.eq('mal_id', item.mal_id)
    } else if (item.tmdb_id && item.media_type) {
      query = query.eq('tmdb_id', item.tmdb_id).eq('media_type', item.media_type)
    }

    await query

    setWatchlist(prev =>
      prev.filter(w => {
        if (item.id) return w.id !== item.id
        if (item.mal_id) return w.mal_id !== item.mal_id
        return !(w.tmdb_id === item.tmdb_id && w.media_type === item.media_type)
      })
    )
  }

  if (!user) return null

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: isMobile ? '12px' : '32px 24px'
      }}
    >
      <h1
        style={{
          fontSize: isMobile ? 20 : 28,
          fontWeight: 800,
          marginBottom: 4,
          lineHeight: 1.2
        }}
      >
        My Watchlist
      </h1>

      <p
        style={{
          color: 'var(--text2)',
          marginBottom: isMobile ? 14 : 32,
          fontSize: isMobile ? 12 : 14
        }}
      >
        {watchlist.length} saved
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: isMobile ? 30 : 60, color: 'var(--text2)' }}>
          Loading...
        </div>
      ) : watchlist.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: isMobile ? '42px 10px' : 80
          }}
        >
          <div style={{ fontSize: isMobile ? 40 : 64, marginBottom: 12 }}>📭</div>

          <p style={{ color: 'var(--text2)', fontSize: isMobile ? 15 : 18 }}>
            Your watchlist is empty
          </p>

          <p
            style={{
              color: 'var(--text2)',
              fontSize: isMobile ? 12 : 14,
              marginTop: 6
            }}
          >
            Browse and tap ☆ to save titles here
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: isMobile ? 10 : 20
          }}
        >
          {watchlist.map(item => {
            const typeLabel =
              item.media_type === 'tv'
                ? 'TV'
                : item.media_type === 'movie'
                  ? 'Movie'
                  : 'Anime'

            return (
              <div
                key={item.id || `${item.media_type}-${item.tmdb_id || item.mal_id}`}
                onClick={() => navigate(getHref(item))}
                style={{
                  background: 'var(--card)',
                  borderRadius: isMobile ? 12 : 'var(--radius)',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  display: isMobile ? 'flex' : 'block',
                  minHeight: isMobile ? 92 : 'auto'
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
                <div
                  style={{
                    position: 'relative',
                    width: isMobile ? 72 : '100%',
                    minWidth: isMobile ? 72 : 'auto',
                    height: isMobile ? 92 : 'auto',
                    aspectRatio: isMobile ? undefined : '2/3',
                    background: 'var(--bg3)',
                    flexShrink: 0
                  }}
                >
                  <img
                    src={item.poster}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />

                  {item.score && (
                    <div
                      style={{
                        position: 'absolute',
                        top: isMobile ? 5 : 8,
                        left: isMobile ? 5 : 8,
                        background: 'rgba(0,0,0,0.8)',
                        color: '#fbbf24',
                        fontWeight: 700,
                        fontSize: isMobile ? 10 : 13,
                        padding: isMobile ? '2px 5px' : '3px 8px',
                        borderRadius: 6
                      }}
                    >
                      ★ {Number(item.score).toFixed(1)}
                    </div>
                  )}

                  <button
                    onClick={(e) => removeFromWatchlist(e, item)}
                    style={{
                      position: 'absolute',
                      top: isMobile ? 5 : 8,
                      right: isMobile ? 5 : 8,
                      background: 'var(--accent)',
                      color: '#fff',
                      width: isMobile ? 24 : 32,
                      height: isMobile ? 24 : 32,
                      borderRadius: '50%',
                      fontSize: isMobile ? 12 : 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      padding: 0
                    }}
                  >
                    ★
                  </button>
                </div>

                <div
                  style={{
                    padding: isMobile ? '9px 10px' : 12,
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: isMobile ? 6 : 8
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: isMobile ? 13 : 13,
                        fontWeight: 700,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: isMobile ? 2 : 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.25,
                        marginBottom: 5
                      }}
                    >
                      {item.title}
                    </div>

                    <div
                      style={{
                        fontSize: isMobile ? 11 : 12,
                        color: 'var(--text2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap'
                      }}
                    >
                      <span>{typeLabel}</span>
                      {item.last_episode ? <span>• Ep {item.last_episode}</span> : null}
                      {item.season_number ? <span>• S{item.season_number}</span> : null}
                    </div>
                  </div>

                  {isMobile && (
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--accent)',
                        fontWeight: 700,
                        alignSelf: 'flex-start',
                        background: 'rgba(225,29,72,0.10)',
                        border: '1px solid rgba(225,29,72,0.20)',
                        borderRadius: 999,
                        padding: '4px 8px',
                        lineHeight: 1
                      }}
                    >
                      Open
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}