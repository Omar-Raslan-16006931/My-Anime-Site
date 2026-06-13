import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'
import Icon from '../components/Icons'
import { recordRecent } from '../lib/progress'
import DownloadLinks from '../components/DownloadLinks'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG = 'https://image.tmdb.org/t/p/w500'
const BACKDROP = 'https://image.tmdb.org/t/p/original'

async function upsertWatching(user, d, seasonNumber, episodeNumber) {
  if (!user || !d) return
  await supabase.from('currently_watching_tmdb').upsert({
    user_id: user.id, media_type: 'tv', tmdb_id: d.id, title: d.name,
    poster: d.poster_path ? `${IMG}${d.poster_path}` : null, score: d.vote_average || null,
    season_number: seasonNumber, last_episode: episodeNumber, total_episodes: d.number_of_episodes || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,media_type,tmdb_id' })
}

async function fetchRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url)
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 1000 * (i + 1))); continue }
    return res
  }
  return fetch(url)
}

export default function TVDetail({ user, onAuthRequired }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [details, setDetails] = useState(null)
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [seasonData, setSeasonData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seasonLoading, setSeasonLoading] = useState(false)
  const [playing, setPlaying] = useState(null)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [lastEp, setLastEp] = useState(null)
  const [lastSeason, setLastSeason] = useState(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true); setDetails(null); setSeasonData(null); setSelectedSeason(null)
    setPlaying(null); setInWatchlist(false); setLastEp(null); setLastSeason(null)

    ;(async () => {
      try {
        const res = await fetchRetry(`https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}`)
        const json = await res.json()
        if (cancelled) return
        setDetails(json)
        const valid = (json.seasons || []).filter((s) => s?.season_number > 0)
        if (valid.length) setSelectedSeason(valid[0].season_number)

        if (user && json?.id) {
          supabase.from('watchlist').select('tmdb_id').eq('user_id', user.id).eq('media_type', 'tv').eq('tmdb_id', json.id).maybeSingle()
            .then(({ data }) => !cancelled && setInWatchlist(!!data)).catch(() => {})
          supabase.from('currently_watching_tmdb').select('season_number,last_episode').eq('user_id', user.id).eq('media_type', 'tv').eq('tmdb_id', json.id).maybeSingle()
            .then(({ data }) => {
              if (cancelled || !data) return
              setLastSeason(data.season_number ?? null); setLastEp(data.last_episode ?? null)
              if (data.season_number) setSelectedSeason(data.season_number)
            }).catch(() => {})
        }
      } catch { if (!cancelled) setDetails(null) }
      finally { if (!cancelled) setLoading(false) }
    })()

    return () => { cancelled = true }
  }, [id, user])

  useEffect(() => {
    if (selectedSeason == null) return
    let cancelled = false
    setSeasonLoading(true); setSeasonData(null)
    ;(async () => {
      try {
        const res = await fetchRetry(`https://api.themoviedb.org/3/tv/${id}/season/${selectedSeason}?api_key=${API_KEY}`)
        const data = await res.json()
        if (!cancelled) setSeasonData(data)
      } catch { if (!cancelled) setSeasonData(null) }
      finally { if (!cancelled) setSeasonLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id, selectedSeason])

  const play = (epNum) => {
    setPlaying(epNum); setLastEp(epNum); setLastSeason(selectedSeason)
    if (details) {
      recordRecent({
        kind: 'tv', id: details.id, title: details.name,
        poster: details.poster_path ? `${IMG}${details.poster_path}` : null,
        backdrop: details.backdrop_path ? `${BACKDROP}${details.backdrop_path}` : null,
        season: selectedSeason, episode: epNum, totalEpisodes: details.number_of_episodes,
      })
    }
    if (user) upsertWatching(user, details, selectedSeason, epNum)
  }

  const toggleWatchlist = async () => {
    if (!user) return onAuthRequired?.()
    if (inWatchlist) {
      const { error } = await supabase.from('watchlist').delete().eq('user_id', user.id).eq('media_type', 'tv').eq('tmdb_id', details.id)
      if (!error) setInWatchlist(false)
    } else {
      const { error } = await supabase.from('watchlist').insert({
        user_id: user.id, media_type: 'tv', tmdb_id: details.id, title: details.name,
        poster: details.poster_path ? `${IMG}${details.poster_path}` : null, score: details.vote_average,
        season_number: selectedSeason, last_episode: lastEp,
      })
      if (!error) setInWatchlist(true)
    }
  }

  if (loading) return <div className="page"><div className="center-msg"><span className="spinner" /></div></div>
  if (!details || details.success === false) return <div className="page"><div className="empty"><div className="emoji">📺</div><p>TV show not found.</p></div></div>

  const seasons = (details.seasons || []).filter((s) => s?.season_number > 0)

  return (
    <div className="page">
      {details.backdrop_path && (
        <div className="detail-banner"><img src={`${BACKDROP}${details.backdrop_path}`} alt={details.name} /></div>
      )}
      <button className="icon-btn detail-back" onClick={() => navigate(-1)} style={{ marginTop: details.backdrop_path ? 14 : 0 }}><Icon.back width="18" height="18" /></button>

      <div className="detail-head">
        <div className="detail-poster"><img src={details.poster_path ? `${IMG}${details.poster_path}` : '/placeholder.jpg'} alt={details.name} /></div>
        <div className="detail-info">
          <h1 className="detail-title">{details.name}</h1>
          {details.original_name && details.original_name !== details.name && <p className="detail-orig">{details.original_name}</p>}

          <div className="meta-pills">
            <div className="pill"><div className="pill-k">Score</div><div className="pill-v">{details.vote_average ? details.vote_average.toFixed(1) : 'N/A'}</div></div>
            <div className="pill"><div className="pill-k">Seasons</div><div className="pill-v">{details.number_of_seasons || seasons.length || 'N/A'}</div></div>
            <div className="pill"><div className="pill-k">Episodes</div><div className="pill-v">{details.number_of_episodes || 'N/A'}</div></div>
            <div className="pill"><div className="pill-k">Status</div><div className="pill-v">{details.status?.split(' ')[0] || 'N/A'}</div></div>
          </div>

          <div className="genres">{(details.genres || []).map((g) => <span key={g.id} className="tag">{g.name}</span>)}</div>

          {lastEp && lastSeason && (
            <div className="resume-bar">
              <div><div className="lbl">Last watched</div><div className="val">S{lastSeason} · E{lastEp}</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => { setSelectedSeason(lastSeason); play(lastEp) }}><Icon.play width="15" height="15" /> Resume</button>
            </div>
          )}

          <div className="detail-actions">
            <button className={inWatchlist ? 'btn btn-outline' : 'btn btn-primary'} onClick={toggleWatchlist}>
              {inWatchlist ? <><Icon.check width="16" height="16" /> In List</> : <><Icon.plus width="16" height="16" /> My List</>}
            </button>
          </div>
          <DownloadLinks title={details.name} />

          <p className="synopsis">{details.overview || 'No overview available.'}</p>
        </div>
      </div>

      <h2 className="section-title" style={{ fontSize: 20, margin: '26px 0 14px' }}>Seasons</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {seasons.map((s) => (
          <button key={s.id || s.season_number}
            className={'chip' + (selectedSeason === s.season_number ? ' active' : '')}
            onClick={() => setSelectedSeason(s.season_number)}>Season {s.season_number}</button>
        ))}
      </div>

      {seasonLoading ? (
        <div className="center-msg"><span className="spinner" /></div>
      ) : seasonData?.episodes?.length ? (
        <div className="ep-list">
          {seasonData.episodes.map((ep) => {
            const isLast = lastSeason === selectedSeason && lastEp === ep.episode_number
            return (
              <div key={ep.id} className={'ep' + (isLast ? ' seen' : '')}>
                <div className="ep-main" onClick={() => play(ep.episode_number)}>
                  <div className="ep-thumb">
                    {ep.still_path ? <img src={`${IMG}${ep.still_path}`} alt={ep.name} /> : null}
                    <span className="num">EP {ep.episode_number}</span>
                  </div>
                  <div className="ep-body">
                    <div className="ep-name">{ep.name || `Episode ${ep.episode_number}`}</div>
                    <div className="ep-sub">{[ep.air_date, typeof ep.runtime === 'number' ? `${ep.runtime} min` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
                <div className="ep-actions"><button className="btn btn-primary btn-sm" onClick={() => play(ep.episode_number)}><Icon.play width="14" height="14" /></button></div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="muted">No episodes found for this season.</p>
      )}

      {playing && (
        <VideoPlayer
          mediaType="tv"
          tmdbId={details.id}
          title={details.name}
          season={selectedSeason}
          episode={playing}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  )
}
