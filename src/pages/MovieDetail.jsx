import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import VideoPlayer from '../components/VideoPlayer'
import { supabase } from '../supabase'
import Icon from '../components/Icons'
import { recordRecent } from '../lib/progress'
import { toast } from '../lib/toast'
import Row from '../components/Row'
import MediaCard from '../components/MediaCard'

const FACE = 'https://image.tmdb.org/t/p/w185'

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

const fmtRuntime = (m) => (m ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m}m`) : null)

export default function MovieDetail({ user, onAuthRequired }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [synOpen, setSynOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setPlaying(false)
    ;(async () => {
      try {
        // One request: details + cast + recommendations (+ similar as a fallback).
        const res = await fetchRetry(`https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}&append_to_response=credits,recommendations,similar`)
        const data = await res.json()
        if (!cancelled) setMovie(data)
      } catch { if (!cancelled) setMovie(null) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id])

  // Watchlist membership.
  const userId = user?.id
  useEffect(() => {
    setInWatchlist(false)
    if (!userId || !id) return
    let cancelled = false
    supabase.from('watchlist').select('tmdb_id').eq('user_id', userId).eq('media_type', 'movie').eq('tmdb_id', Number(id)).maybeSingle()
      .then(({ data }) => { if (!cancelled) setInWatchlist(!!data) }).catch(() => {})
    return () => { cancelled = true }
  }, [id, userId])

  // Lock background scroll while the description popup is open.
  useEffect(() => {
    if (!synOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [synOpen])

  const handlePlay = () => {
    if (!movie) return
    recordRecent({
      kind: 'movie', id: movie.id, title: movie.title,
      poster: movie.poster_path ? `${IMG}${movie.poster_path}` : null,
      backdrop: movie.backdrop_path ? `${BACKDROP}${movie.backdrop_path}` : null,
    })
    if (user) {
      supabase.from('currently_watching_tmdb').upsert({
        user_id: user.id, media_type: 'movie', tmdb_id: movie.id, title: movie.title,
        poster: movie.poster_path ? `${IMG}${movie.poster_path}` : null, score: movie.vote_average || null,
        season_number: null, last_episode: 1, total_episodes: null, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,media_type,tmdb_id' }).then(() => {}, () => {})
    }
    setPlaying(true)
  }

  const toggleWatchlist = async () => {
    if (!user) return onAuthRequired?.()
    if (!movie) return
    if (inWatchlist) {
      const { error } = await supabase.from('watchlist').delete().eq('user_id', user.id).eq('media_type', 'movie').eq('tmdb_id', movie.id)
      if (!error) { setInWatchlist(false); toast('Removed from My List') }
    } else {
      const { error } = await supabase.from('watchlist').insert({
        user_id: user.id, media_type: 'movie', tmdb_id: movie.id, title: movie.title,
        poster: movie.poster_path ? `${IMG}${movie.poster_path}` : null, score: movie.vote_average,
      })
      if (!error) { setInWatchlist(true); toast('Added to My List') }
    }
  }

  const share = () => {
    if (navigator.share) navigator.share({ title: movie?.title, url: window.location.href }).catch(() => {})
    else navigator.clipboard?.writeText(window.location.href)
  }

  if (loading) return <div className="page"><div className="center-msg"><span className="spinner" /></div></div>
  if (!movie || movie.success === false) return <div className="page"><div className="empty"><div className="emoji">🎬</div><p>Movie not found.</p></div></div>

  const year = movie.release_date ? movie.release_date.slice(0, 4) : null
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null
  const runtime = fmtRuntime(movie.runtime)
  const genres = (movie.genres || []).slice(0, 2).map((g) => g.name)
  const backdrop = movie.backdrop_path ? `${BACKDROP}${movie.backdrop_path}` : null
  const upcoming = movie.status && movie.status !== 'Released'
  const cast = (movie.credits?.cast || []).filter((c) => c.name).slice(0, 14)
  const director = (movie.credits?.crew || []).find((c) => c.job === 'Director')?.name
  const recsRaw = movie.recommendations?.results?.length ? movie.recommendations.results : movie.similar?.results || []
  const recs = recsRaw.filter((m) => !m.adult && m.poster_path && m.id !== movie.id).slice(0, 18)

  return (
    <div className="fu">
      <button className="fu-back" onClick={() => navigate(-1)} aria-label="Back"><Icon.back width="18" height="18" /></button>

      {/* Same header as the TV page: backdrop behind everything, title, one
          info line, short description, one clear action, two shortcuts. */}
      <section className="tvh tvh-full">
        <div className="tvh-art">{backdrop && <img src={backdrop} alt="" />}</div>
        <div className="tvh-body">
          <h1 className="tvh-title">{movie.title}</h1>
          <div className="tvh-meta">
            {rating && <span className="tvh-rating"><span aria-hidden="true">★</span> {rating}</span>}
            {year && <span>{year}</span>}
            {runtime && <span>{runtime}</span>}
            {genres.map((g) => <span key={g}>{g}</span>)}
            {upcoming && <span>{movie.status}</span>}
          </div>
          {movie.overview && (
            <p className="tvh-desc" onClick={() => setSynOpen(true)} title="Read full description">{movie.overview}</p>
          )}

          <button className="tvh-play" onClick={handlePlay}>
            <Icon.play width="16" height="16" /> Play movie
          </button>

          <div className="tvh-shortcuts">
            <button className={'tvh-sc' + (inWatchlist ? ' on' : '')} onClick={toggleWatchlist} aria-pressed={inWatchlist}>
              {inWatchlist
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
              <span>{inWatchlist ? 'In My List' : 'My List'}</span>
            </button>
            <button className="tvh-sc" onClick={share}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
              <span>Share</span>
            </button>
          </div>
        </div>
      </section>

      <div className="mv-more">
        {cast.length > 0 && (
          <section className="mv-sec">
            <div className="mv-sec-head">
              <h2>Cast</h2>
              {director && <span className="mv-sec-note">Directed by {director}</span>}
            </div>
            <div className="cast-row">
              {cast.map((c) => (
                <div key={c.credit_id || c.id} className="cast">
                  <div className="cast-face">
                    {c.profile_path
                      ? <img src={`${FACE}${c.profile_path}`} alt={c.name} loading="lazy" />
                      : <span>{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
                  </div>
                  <div className="cast-name">{c.name}</div>
                  {c.character && <div className="cast-role">{c.character}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {recs.length > 0 && (
          <Row title="More like this">
            {recs.map((m) => (
              <MediaCard key={m.id} item={{
                href: `/movie/${m.id}`, poster: `${IMG}${m.poster_path}`,
                title: m.title, score: m.vote_average, sub: m.release_date?.slice(0, 4),
              }} />
            ))}
          </Row>
        )}
      </div>

      {playing && (
        <VideoPlayer mediaType="movie" tmdbId={movie.id} movieTitle={movie.title} onClose={() => setPlaying(false)} />
      )}

      {synOpen && (
        <div className="modal" onClick={() => setSynOpen(false)}>
          <div className="fu-syn-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fu-syn-head">
              <div>
                <div className="fu-syn-eyebrow">Movie{year ? ` · ${year}` : ''}</div>
                <h3 className="fu-syn-title">{movie.title}</h3>
              </div>
              <button className="fu-syn-close" onClick={() => setSynOpen(false)} aria-label="Close"><Icon.close width="18" height="18" /></button>
            </div>
            <p className="fu-syn-body">{movie.overview}</p>
          </div>
        </div>
      )}
    </div>
  )
}
