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
  const year = details.first_air_date ? details.first_air_date.slice(0, 4) : ''
  const ongoing = /return|ongoing|airing/i.test(details.status || '')
  const backdrop = details.backdrop_path ? `${BACKDROP}${details.backdrop_path}` : null
  const resumeLabel = lastEp && lastSeason ? `Resume · S${lastSeason} E${lastEp}` : 'Play'
  const heroPlay = () => {
    if (lastEp && lastSeason) { setSelectedSeason(lastSeason); play(lastEp) }
    else play(seasonData?.episodes?.[0]?.episode_number || 1)
  }
  const share = () => {
    if (navigator.share) navigator.share({ title: details.name, url: window.location.href }).catch(() => {})
    else navigator.clipboard?.writeText(window.location.href)
  }

  return (
    <div className="fu">
      <button className="fu-back" onClick={() => navigate(-1)} aria-label="Back"><Icon.back width="18" height="18" /></button>

      <section className="fu-hero">
        <div className="fu-hero-img">{backdrop && <img src={backdrop} alt={details.name} />}</div>
        <div className="fu-hero-glow" />
        <div className="fu-hero-scrim" />
        <div className="fu-hero-noise" />
        <div className="fu-hero-inner">
          <div className="fu-eyebrow">Series{year ? ` · ${year}` : ''}{details.number_of_seasons ? ` · ${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}` : ''}</div>
          <h1 className="fu-title">{details.name}</h1>
          <div className="fu-meta">
            {details.vote_average ? <><span className="strong"><span className="star">★</span>{details.vote_average.toFixed(1)}</span><span className="sep">·</span></> : null}
            {details.number_of_seasons ? <><span>{details.number_of_seasons} Season{details.number_of_seasons > 1 ? 's' : ''}</span><span className="sep">·</span></> : null}
            {details.number_of_episodes ? <><span>{details.number_of_episodes} Episodes</span><span className="sep">·</span></> : null}
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className="fu-dot" />{ongoing ? 'Returning' : (details.status?.split(' ')[0] || 'Ended')}</span>
          </div>
          <div className="fu-genres">{(details.genres || []).slice(0, 4).map((g) => <span key={g.id} className="fu-pill">{g.name}</span>)}</div>
          {details.overview && <p className="fu-syn">{details.overview}</p>}
          <div className="fu-actions">
            <button className="fu-btn fu-btn-grad" onClick={heroPlay}><Icon.play width="16" height="16" /> {resumeLabel}</button>
            {lastEp && lastSeason && (
              <button className="fu-btn fu-btn-glass" onClick={() => { setSelectedSeason(lastSeason); play(lastEp + 1) }}><Icon.play width="15" height="15" /> Next Ep</button>
            )}
            <button className="fu-btn fu-btn-glass" onClick={toggleWatchlist}>
              {inWatchlist
                ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a99cff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> In Your List</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg> My List</>}
            </button>
            <button className="fu-round" aria-label="Share" onClick={share}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
            </button>
          </div>
          <div className="fu-sources"><DownloadLinks title={details.name} /></div>
        </div>
      </section>

      <section className="fu-eps">
        <div className="fu-eps-head">
          <div>
            <div className="fu-eps-eyebrow">{(seasonData?.name || (selectedSeason ? `Season ${selectedSeason}` : 'Episodes'))}{seasonData?.episodes?.length ? ` · ${seasonData.episodes.length} Episodes` : ''}</div>
            <h2 className="fu-h2">Episodes</h2>
          </div>
          {seasons.length > 0 && (
            <div className="fu-seg">
              {seasons.map((s) => (
                <button key={s.id || s.season_number} className={'fu-seg-btn' + (selectedSeason === s.season_number ? ' on' : '')} onClick={() => setSelectedSeason(s.season_number)}>Season {s.season_number}</button>
              ))}
            </div>
          )}
        </div>

        {seasonLoading ? (
          <div className="fu-center"><span className="spinner lg" /></div>
        ) : seasonData?.episodes?.length ? (
          <div className="fu-ep-list">
            {seasonData.episodes.map((ep) => {
              const isLast = lastSeason === selectedSeason && lastEp === ep.episode_number
              const thumb = ep.still_path ? `${IMG}${ep.still_path}` : (details.poster_path ? `${IMG}${details.poster_path}` : null)
              const meta = [ep.air_date, typeof ep.runtime === 'number' ? `${ep.runtime} min` : null].filter(Boolean).join('   ·   ') || 'Subbed · Dubbed'
              return (
                <div key={ep.id} className="fu-ep" onClick={() => play(ep.episode_number)}>
                  <div className="fu-still">
                    {thumb ? <img src={thumb} alt={ep.name} loading="lazy" /> : null}
                    <span className="fu-ep-badge">EP {ep.episode_number}</span>
                  </div>
                  <div className="fu-ep-body">
                    <div className="fu-ep-titlerow">
                      <h3 className="fu-ep-title">{ep.name || `Episode ${ep.episode_number}`}</h3>
                      {isLast && <span className="fu-tag">CONTINUE</span>}
                    </div>
                    <div className="fu-ep-meta">{meta}</div>
                    {ep.overview && <p className="fu-ep-syn">{ep.overview}</p>}
                  </div>
                  <div className="fu-play" onClick={(e) => { e.stopPropagation(); play(ep.episode_number) }}><Icon.play width="18" height="18" /></div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted" style={{ color: 'var(--fu-mute)' }}>No episodes found for this season.</p>
        )}
      </section>

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
