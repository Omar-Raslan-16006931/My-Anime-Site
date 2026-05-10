import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function AnimeCard({ anime, user, onAuthRequired, onSelect }) {
  const [inWatchlist, setInWatchlist] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('watchlist')
      .select('mal_id')
      .eq('user_id', user.id)
      .eq('mal_id', anime.mal_id)
      .single()
      .then(({ data }) => setInWatchlist(!!data))
  }, [user, anime.mal_id])

  const toggleWatchlist = async (e) => {
    e.stopPropagation()
    if (!user) return onAuthRequired()

    if (inWatchlist) {
      await supabase.from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('mal_id', anime.mal_id)
      setInWatchlist(false)
    } else {
      await supabase.from('watchlist').insert({
        user_id: user.id,
        mal_id: anime.mal_id,
        title: anime.title_english || anime.title,
        japanese_title: anime.title,
        poster: anime.images?.jpg?.large_image_url,
        score: anime.score
      })
      setInWatchlist(true)
    }
  }

  return (
    <div onClick={() => onSelect(anime)} style={{
      background: 'var(--card)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer',
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
      <div style={{ position: 'relative', aspectRatio: '2/3', overflow: 'hidden' }}>
        <img
          src={anime.images?.jpg?.large_image_url}
          alt={anime.title_english || anime.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {anime.score && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            color: '#fbbf24',
            fontWeight: 700,
            fontSize: 13,
            padding: '3px 8px',
            borderRadius: 6
          }}>
            ⭐ {anime.score}
          </div>
        )}
        <button onClick={toggleWatchlist} style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: inWatchlist ? 'var(--accent)' : 'rgba(0,0,0,0.8)',
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
          transition: 'background 0.2s'
        }}>
          {inWatchlist ? '★' : '☆'}
        </button>
      </div>

      <div style={{ padding: 12 }}>
        <h3 style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 4,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {anime.title_english || anime.title}
        </h3>

        {anime.title_english && anime.title_english !== anime.title && (
          <div style={{
            fontSize: 11,
            color: 'var(--text2)',
            marginBottom: 6,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {anime.title}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {anime.genres?.slice(0, 2).map(g => (
            <span key={g.mal_id} style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 20,
              background: 'var(--bg3)',
              color: 'var(--text2)',
              border: '1px solid var(--border)'
            }}>
              {g.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}