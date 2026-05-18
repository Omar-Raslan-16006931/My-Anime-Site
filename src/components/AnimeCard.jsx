import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function AnimeCard({ anime, user, onAuthRequired, compact = false }) {
  const [inWatchlist, setInWatchlist] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return

    supabase
      .from('watchlist')
      .select('mal_id')
      .eq('user_id', user.id)
      .eq('mal_id', anime.mal_id)
      .single()
      .then(({ data }) => setInWatchlist(!!data))
  }, [user, anime.mal_id])

  const toggleWatchlist = async (e) => {
    e.stopPropagation()

    if (!user) {
      return onAuthRequired()
    }

    try {
      if (inWatchlist) {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('mal_id', anime.mal_id)

        if (error) {
          console.error('Delete error:', error)
          return
        }

        setInWatchlist(false)
      } else {
        const { error } = await supabase.from('watchlist').insert({
          user_id: user.id,
          mal_id: anime.mal_id,
          title: anime.title_english || anime.title,
          poster: anime.images?.jpg?.large_image_url,
          score: anime.score
        })

        if (error) {
          console.error('Insert error:', error)
          return
        }

        setInWatchlist(true)
      }
    } catch (err) {
      console.error('Watchlist toggle error:', err)
    }
  }

  return (
    <div
      onClick={() => navigate(`/anime/${anime.mal_id}`)}
      style={{
        background: 'var(--card)',
        borderRadius: compact ? 12 : 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        position: 'relative'
      }}
      onMouseEnter={e => {
        if (!compact) {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)'
        }
      }}
      onMouseLeave={e => {
        if (!compact) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: compact ? '3/4' : '2/3',
          overflow: 'hidden'
        }}
      >
        <img
          src={anime.images?.jpg?.large_image_url}
          alt={anime.title_english || anime.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {anime.score && (
          <div
            style={{
              position: 'absolute',
              top: compact ? 6 : 8,
              left: compact ? 6 : 8,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(4px)',
              color: '#fbbf24',
              fontWeight: 700,
              fontSize: compact ? 11 : 13,
              padding: compact ? '2px 6px' : '3px 8px',
              borderRadius: 6
            }}
          >
            ⭐ {anime.score}
          </div>
        )}

        <button
          onClick={toggleWatchlist}
          style={{
            position: 'absolute',
            top: compact ? 6 : 8,
            right: compact ? 6 : 8,
            background: inWatchlist ? 'var(--accent)' : 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            color: '#fff',
            width: compact ? 28 : 32,
            height: compact ? 28 : 32,
            borderRadius: '50%',
            fontSize: compact ? 14 : 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
            transition: 'background 0.2s'
          }}
        >
          {inWatchlist ? '★' : '☆'}
        </button>
      </div>

      <div style={{ padding: compact ? 8 : 12 }}>
        <h3
          style={{
            fontSize: compact ? 12 : 14,
            fontWeight: 600,
            marginBottom: compact ? 3 : 4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: compact ? 1 : 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.25
          }}
        >
          {anime.title_english || anime.title}
        </h3>

        {!compact && anime.title_english && anime.title_english !== anime.title && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text2)',
              marginBottom: 6,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {anime.title}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {anime.genres?.slice(0, compact ? 1 : 2).map(g => (
            <span
              key={g.mal_id}
              style={{
                fontSize: compact ? 10 : 11,
                padding: compact ? '2px 6px' : '2px 8px',
                borderRadius: 20,
                background: 'var(--bg3)',
                color: 'var(--text2)',
                border: '1px solid var(--border)'
              }}
            >
              {g.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}