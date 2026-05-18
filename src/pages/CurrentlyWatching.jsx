import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function CurrentlyWatching({ user, onAuthRequired }) {
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deletingKey, setDeletingKey] = useState(null)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)

      const [animeRes, tmdbRes] = await Promise.all([
        supabase
          .from('currently_watching')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),

        supabase
          .from('currently_watching_tmdb')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
      ])

      const animeRows = (animeRes.data || []).map(item => ({
        ...item,
        source_table: 'currently_watching'
      }))

      const tmdbRows = (tmdbRes.data || []).map(item => ({
        ...item,
        source_table: 'currently_watching_tmdb'
      }))

      const merged = [...animeRows, ...tmdbRows].sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
      )

      setItems(merged)
      setLoading(false)
    }

    load()
  }, [user])

  const getItemHref = (item) => {
    if (item.media_type === 'tv' && item.tmdb_id) return `/tv/${item.tmdb_id}`
    if (item.media_type === 'movie' && item.tmdb_id) return `/movie/${item.tmdb_id}`
    if (item.mal_id) return `/anime/${item.mal_id}`
    return '/'
  }

  const getItemKey = (item) => {
    return `${item.source_table}-${item.id}`
  }

  if (!user) {
    return (
      <div style={{ padding: isMobile ? 20 : 40, color: 'var(--text2)' }}>
        Please sign in to view your currently watching list.
        <div style={{ marginTop: 16 }}>
          <button
            onClick={onAuthRequired}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              padding: isMobile ? '9px 14px' : '10px 18px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: isMobile ? 13 : 14,
              minHeight: 42
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: isMobile ? 20 : 40, color: 'var(--text2)' }}>Loading...</div>
  }

  const handleDelete = (e, item) => {
    e.stopPropagation()
    setDeleteConfirm(item)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    const itemKey = getItemKey(deleteConfirm)
    setDeletingKey(itemKey)

    try {
      const tableName = deleteConfirm.source_table || 'currently_watching'

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', deleteConfirm.id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Delete error:', error)
        setDeletingKey(null)
        return
      }

      setTimeout(() => {
        setItems(prev => prev.filter(item => getItemKey(item) !== itemKey))
        setDeletingKey(null)
      }, 220)
    } catch (err) {
      console.error('Delete failed:', err)
      setDeletingKey(null)
    }

    setDeleteConfirm(null)
  }

  const cancelDelete = () => {
    setDeleteConfirm(null)
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: isMobile ? 20 : 40, color: 'var(--text2)' }}>
        No currently watching shows yet.
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: isMobile ? '12px' : '24px'
      }}
    >
      <h2
        style={{
          fontSize: isMobile ? 18 : 22,
          fontWeight: 800,
          marginBottom: isMobile ? 12 : 20
        }}
      >
        Currently Watching
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: isMobile ? 10 : 16
        }}
      >
        {items.map(item => {
          const itemKey = getItemKey(item)
          const isDeleting = deletingKey === itemKey

          const progressText =
            item.media_type === 'tv'
              ? `S${item.season_number || 1} • E${item.last_episode || 1}`
              : item.media_type === 'movie'
                ? 'Movie'
                : `Ep. ${item.last_episode || 1}${item.total_episodes ? ` / ${item.total_episodes}` : ''}`

          const subText =
            item.media_type === 'tv'
              ? item.total_episodes
                ? `${item.total_episodes} eps`
                : 'TV show'
              : item.media_type === 'movie'
                ? 'Movie'
                : item.total_episodes
                  ? `${item.total_episodes} episodes`
                  : 'Anime'

          return (
            <div
              key={itemKey}
              onClick={() => navigate(getItemHref(item))}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: isMobile ? 12 : 14,
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
                opacity: isDeleting ? 0 : 1,
                transform: isDeleting ? 'scale(0.97)' : 'scale(1)',
                transition: 'opacity 0.22s ease, transform 0.22s ease',
                display: isMobile ? 'flex' : 'block',
                minHeight: isMobile ? 92 : 'auto'
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: isMobile ? 74 : '100%',
                  minWidth: isMobile ? 74 : 'auto',
                  height: isMobile ? 92 : 240,
                  flexShrink: 0,
                  background: 'var(--bg3)'
                }}
              >
                <img
                  src={item.poster || '/placeholder.jpg'}
                  alt={item.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />

                <button
                  onClick={(e) => handleDelete(e, item)}
                  style={{
                    position: 'absolute',
                    top: isMobile ? 6 : 8,
                    right: isMobile ? 6 : 8,
                    background: 'rgba(225,29,72,0.92)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    width: isMobile ? 24 : 32,
                    height: isMobile ? 24 : 32,
                    borderRadius: '50%',
                    fontSize: isMobile ? 12 : 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    lineHeight: 1,
                    padding: 0
                  }}
                >
                  ✕
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
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: 700,
                      marginBottom: isMobile ? 4 : 6,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: isMobile ? 2 : 1,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: isMobile ? 1.25 : 1.35
                    }}
                  >
                    {item.title}
                  </div>

                  <div
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      color: 'var(--text2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {subText}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8
                  }}
                >
                  <div
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      color: 'var(--text2)'
                    }}
                  >
                    {item.score ? `★ ${Number(item.score).toFixed(1)}` : ''}
                  </div>

                  <div
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      background: isMobile ? 'rgba(225,29,72,0.10)' : 'transparent',
                      border: isMobile ? '1px solid rgba(225,29,72,0.20)' : 'none',
                      borderRadius: isMobile ? 999 : 0,
                      padding: isMobile ? '4px 8px' : 0,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.1
                    }}
                  >
                    {progressText}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {deleteConfirm && (
        <div
          onClick={cancelDelete}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 14 : 20,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(16px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>

          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: isMobile ? 14 : 16,
              padding: isMobile ? 16 : 32,
              width: '100%',
              maxWidth: isMobile ? 340 : 400,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              animation: 'slideUp 0.25s ease'
            }}
          >
            <h3
              style={{
                fontSize: isMobile ? 16 : 18,
                fontWeight: 800,
                marginBottom: 8,
                lineHeight: 1.25
              }}
            >
              Remove from Currently Watching?
            </h3>

            <p
              style={{
                fontSize: isMobile ? 13 : 14,
                color: 'var(--text2)',
                marginBottom: isMobile ? 16 : 24,
                lineHeight: 1.6
              }}
            >
              Remove <strong>{deleteConfirm.title}</strong> from your list?
            </p>

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end'
              }}
            >
              <button
                onClick={cancelDelete}
                style={{
                  padding: isMobile ? '9px 14px' : '10px 18px',
                  borderRadius: 8,
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  fontSize: isMobile ? 13 : 14,
                  cursor: 'pointer',
                  minHeight: 40
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                style={{
                  padding: isMobile ? '9px 14px' : '10px 18px',
                  borderRadius: 8,
                  background: 'rgba(225,29,72,0.92)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: isMobile ? 13 : 14,
                  cursor: 'pointer',
                  minHeight: 40
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}