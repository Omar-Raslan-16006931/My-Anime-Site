import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import VideoPlayer from '../components/VideoPlayer'
import { supabase } from '../supabase'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG = 'https://image.tmdb.org/t/p/w500'
const BACKDROP = 'https://image.tmdb.org/t/p/original'

export default function MovieDetail({ user, onAuthRequired }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playingMovie, setPlayingMovie] = useState(false)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const loadMovie = async () => {
      try {
        setLoading(true)
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}`
        )
        const data = await res.json()
        setMovie(data)
      } catch (err) {
        console.error('Movie detail load error:', err)
        setMovie(null)
      } finally {
        setLoading(false)
      }
    }

    loadMovie()
  }, [id])

  const saveMovieToCurrentlyWatching = async () => {
    if (!user) {
      onAuthRequired?.()
      return false
    }

    if (!movie?.id) return false

    const payload = {
      user_id: user.id,
      media_type: 'movie',
      tmdb_id: movie.id,
      title: movie.title,
      poster: movie.poster_path ? `${IMG}${movie.poster_path}` : null,
      score: movie.vote_average || null,
      season_number: null,
      last_episode: 1,
      total_episodes: null,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('currently_watching_tmdb')
      .upsert(payload, { onConflict: 'user_id,media_type,tmdb_id' })
      .select()

    console.log('movie currently watching payload:', payload)
    console.log('movie currently watching data:', data)
    console.log('movie currently watching error:', error)

    return !error
  }

  const handlePlayMovie = async () => {
    const ok = await saveMovieToCurrentlyWatching()
    if (ok || !user) {
      setPlayingMovie(true)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>
        Loading...
      </div>
    )
  }

  if (!movie || movie.success === false) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>
        Movie not found.
      </div>
    )
  }

  const year = movie.release_date ? movie.release_date.slice(0, 4) : 'N/A'
  const runtime = movie.runtime ? `${movie.runtime} min` : 'N/A'
  const score = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: isMobile ? '12px' : '24px'
      }}
    >
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'var(--bg3)',
          color: 'var(--text2)',
          padding: isMobile ? '6px 12px' : '8px 16px',
          borderRadius: 8,
          fontSize: 14,
          marginBottom: isMobile ? 14 : 24,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        ← Back
      </button>

      {movie.backdrop_path && (
        <div
          style={{
            width: '100%',
            borderRadius: 18,
            overflow: 'hidden',
            marginBottom: isMobile ? 16 : 24,
            border: '1px solid var(--border)',
            background: 'var(--bg3)',
            position: 'relative'
          }}
        >
          <img
            src={`${BACKDROP}${movie.backdrop_path}`}
            alt={movie.title}
            style={{
              width: '100%',
              height: isMobile ? 180 : 360,
              objectFit: 'cover',
              display: 'block'
            }}
          />

          <button
            onClick={handlePlayMovie}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.15))',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 16 : 18,
              fontWeight: 800
            }}
          >
            ▶ Play Movie
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 16 : 28,
          alignItems: 'flex-start'
        }}
      >
        <img
          src={movie.poster_path ? `${IMG}${movie.poster_path}` : '/placeholder.jpg'}
          alt={movie.title}
          style={{
            width: isMobile ? '100%' : 240,
            maxWidth: isMobile ? '100%' : 240,
            borderRadius: 16,
            objectFit: 'cover',
            border: '1px solid var(--border)',
            background: 'var(--bg3)'
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontSize: isMobile ? 24 : 36,
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: 10
            }}
          >
            {movie.title}
          </h1>

          {movie.original_title && movie.original_title !== movie.title && (
            <p
              style={{
                color: 'var(--text2)',
                fontSize: isMobile ? 13 : 15,
                marginBottom: 12
              }}
            >
              {movie.original_title}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 16
            }}
          >
            {[
              { label: '⭐ Score', value: score },
              { label: '📅 Year', value: year },
              { label: '⏱ Runtime', value: runtime },
              { label: '🎬 Status', value: movie.status || 'N/A' }
            ].map(item => (
              <div
                key={item.label}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: isMobile ? '7px 10px' : '9px 14px'
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {movie.genres?.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 16
              }}
            >
              {movie.genres.map(genre => (
                <span
                  key={genre.id}
                  style={{
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: 999,
                    background: 'rgba(225,29,72,0.14)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(225,29,72,0.28)'
                  }}
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 18
            }}
          >
            <button
              onClick={handlePlayMovie}
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: '#fff',
                padding: isMobile ? '10px 14px' : '12px 18px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 14,
                minHeight: 44
              }}
            >
              ▶ Play Movie
            </button>
          </div>

          <p
            style={{
              color: 'var(--text2)',
              lineHeight: 1.8,
              fontSize: isMobile ? 14 : 15,
              maxWidth: 780
            }}
          >
            {movie.overview || 'No overview available.'}
          </p>
        </div>
      </div>

      {playingMovie && (
        <VideoPlayer
          mediaType="movie"
          tmdbId={movie.id}
          movieTitle={movie.title}
          onClose={() => setPlayingMovie(false)}
        />
      )}
    </div>
  )
}