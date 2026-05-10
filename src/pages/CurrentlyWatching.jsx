import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function CurrentlyWatching({ user, onAuthRequired, onSelect }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

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
              cursor: 'pointer'
            }}
          >
            <img
              src={item.poster}
              alt={item.title}
              style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
            />
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
    </div>
  )
}