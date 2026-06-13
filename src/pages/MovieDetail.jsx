import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import VideoPlayer from '../components/VideoPlayer'
import { supabase } from '../supabase'
import Icon from '../components/Icons'
import { recordRecent } from '../lib/progress'
import DownloadLinks from '../components/DownloadLinks'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG = 'https://image.tmdb.org/t/p/w500'
const BACKDROP = 'https://image.tmdb.org/t/p/original'

async function fetchRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url)
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 1000 * (i + 1))); continue }
    return res
  }
  return fetch(url)
}

export default function MovieDetail({ user, onAuthRequired }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetchRetry(`https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}`)
        const data = await res.json()
        if (!cancelled) setMovie(data)
      } catch { if (!cancelled) setMovie(null) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id])

  const handlePlay = async () => {
    if (movie) {
      recordRecent({
        kind: 'movie', id: movie.id, title: movie.title,
        poster: movie.poster_path ? `${IMG}${movie.poster_path}` : null,
        backdrop: movie.backdrop_path ? `${BACKDROP}${movie.backdrop_path}` : null,
      })
    }
    if (user && movie?.id) {
      await supabase.from('currently_watching_tmdb').upsert({
        user_id: user.id, media_type: 'movie', tmdb_id: movie.id, title: movie.title,
        poster: movie.poster_path ? `${IMG}${movie.poster_path}` : null, score: movie.vote_average || null,
        season_number: null, last_episode: 1, total_episodes: null, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,media_type,tmdb_id' })
    } else if (!user) {
      onAuthRequired?.()
    }
    setPlaying(true)
  }

  if (loading) return <div className="page"><div className="center-msg"><span className="spinner" /></div></div>
  if (!movie || movie.success === false) return <div className="page"><div className="empty"><div className="emoji">🎬</div><p>Movie not found.</p></div></div>

  const year = movie.release_date ? movie.release_date.slice(0, 4) : 'N/A'

  return (
    <div className="page">
      {movie.backdrop_path && (
        <div className="detail-banner"><img src={`${BACKDROP}${movie.backdrop_path}`} alt={movie.title} /></div>
      )}
      <button className="icon-btn detail-back" onClick={() => navigate(-1)} style={{ marginTop: movie.backdrop_path ? 14 : 0 }}><Icon.back width="18" height="18" /></button>

      <div className="detail-head">
        <div className="detail-poster"><img src={movie.poster_path ? `${IMG}${movie.poster_path}` : '/placeholder.jpg'} alt={movie.title} /></div>
        <div className="detail-info">
          <h1 className="detail-title">{movie.title}</h1>
          {movie.original_title && movie.original_title !== movie.title && <p className="detail-orig">{movie.original_title}</p>}

          <div className="meta-pills">
            <div className="pill"><div className="pill-k">Score</div><div className="pill-v">{movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</div></div>
            <div className="pill"><div className="pill-k">Year</div><div className="pill-v">{year}</div></div>
            <div className="pill"><div className="pill-k">Runtime</div><div className="pill-v">{movie.runtime ? `${movie.runtime}m` : 'N/A'}</div></div>
            <div className="pill"><div className="pill-k">Status</div><div className="pill-v">{movie.status || 'N/A'}</div></div>
          </div>

          <div className="genres">{(movie.genres || []).map((g) => <span key={g.id} className="tag">{g.name}</span>)}</div>

          <div className="detail-actions">
            <button className="btn btn-light" onClick={handlePlay}><Icon.play width="17" height="17" /> Play Movie</button>
          </div>
          <DownloadLinks title={movie.title} />

          <p className="synopsis">{movie.overview || 'No overview available.'}</p>
        </div>
      </div>

      {playing && (
        <VideoPlayer mediaType="movie" tmdbId={movie.id} movieTitle={movie.title} onClose={() => setPlaying(false)} />
      )}
    </div>
  )
}
