import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function CurrentlyWatching({ user, onAuthRequired, onSelect }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)
      const { data, error } = await supabase
        .from('currently_watching')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (!error) setItems(data || [])
      setLoading(false)
    }

    load()
  }, [user])

  if (!user) {
    return (
      <div style={{ padding: 40, color: 'var(--text2)' }}>
        Please sign in to view your currently watching list.
        <div style={{ marginTop: 16 }}>
          <button
            onClick={onAuthRequired}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: 8,
              fontWeight: 600
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text2)' }}>Loading...</div>
  }

  const handleDelete = (e, itemId, itemTitle) => {
    e.stopPropagation()
    setDeleteConfirm({ id: itemId, title: itemTitle })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    setDeletingId(deleteConfirm.id)

    try {
      const { error } = await supabase
        .from('currently_watching')
        .delete()
        .eq('id', deleteConfirm.id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Delete error:', error)
        setDeletingId(null)
        return
      }

      setTimeout(() => {
        setItems(items.filter(item => item.id !== deleteConfirm.id))
        setDeletingId(null)
      }, 300)

      console.log('Item deleted successfully')
    } catch (err) {
      console.error('Delete failed:', err)
      setDeletingId(null)
    }

    setDeleteConfirm(null)
  }

  const cancelDelete = () => {
    setDeleteConfirm(null)
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 40, color: 'var(--text2)' }}>
        No currently watching shows yet.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>
        Currently Watching
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 16
      }}>
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => onSelect({
              mal_id: item.mal_id,
              title: item.title,
              title_english: item.title,
              images: { jpg: { large_image_url: item.poster, image_url: item.poster } }
            })}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              overflow: 'hidden',
              cursor: 'pointer',
              position: 'relative',
              opacity: deletingId === item.id ? 0 : 1,
              transform: deletingId === item.id ? 'scale(0.95)' : 'scale(1)',
              transition: 'opacity 0.3s ease, transform 0.3s ease'
            }}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={item.poster}
                alt={item.title}
                style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
              />
              <button
                onClick={(e) => handleDelete(e, item.id, item.title)}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(225,29,72,0.9)',
                  backdropFilter: 'blur(4px)',
                  color: '#fff',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.1)',
                  transition: 'background 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(225,29,72,1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(225,29,72,0.9)'}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                Ep. {item.last_episode}{item.total_episodes ? ` / ${item.total_episodes}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {deleteConfirm && (
        <div onClick={cancelDelete} style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease'
        }}>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 32,
            maxWidth: 400,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.3s ease'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Remove from Currently Watching?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24 }}>
              Are you sure you want to remove <strong>{deleteConfirm.title}</strong> from your currently watching list?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDelete}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  background: 'rgba(225,29,72,0.9)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(225,29,72,1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(225,29,72,0.9)'}
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