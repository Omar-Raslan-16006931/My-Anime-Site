import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'
import Icon from '../components/Icons'
import { recordRecent } from '../lib/progress'
import DownloadLinks from '../components/DownloadLinks'
import { isAdultTmdbDetails } from '../lib/tmdb'
import { loadTvSeen, setTvSeen, tvEpKey } from '../lib/tvProgress'

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
  const [synOpen, setSynOpen] = useState(false)
  const [showDl, setShowDl] = useState(false)
  const [seen, setSeen] = useState(() => new Set()) // "season:episode" keys
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches)

  // Lock background scroll while the synopsis popup is open.
  useEffect(() => {
    if (!synOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [synOpen])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const on = () => setIsMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true); setDetails(null); setSeasonData(null); setSelectedSeason(null)
    setPlaying(null); setInWatchlist(false); setLastEp(null); setLastSeason(null)

    ;(async () => {
      try {
        // content_ratings + keywords let us block hentai (JP "R18+" / "hentai" keyword).
        const res = await fetchRetry(`https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}&append_to_response=content_ratings,keywords`)
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

  // Watched episodes (account + this device).
  const userId = user?.id
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setSeen(new Set())
    loadTvSeen(userId, id).then((s) => { if (!cancelled) setSeen(s) })
    return () => { cancelled = true }
  }, [id, userId])

  const markSeen = (season, epNum, isSeen = true) => {
    const k = tvEpKey(season, epNum)
    setSeen((prev) => {
      const next = new Set(prev)
      if (isSeen) next.add(k); else next.delete(k)
      return next
    })
    setTvSeen(userId, id, season, epNum, isSeen)
  }

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

  const play = (epNum, season = selectedSeason) => {
    setPlaying(epNum); setLastEp(epNum); setLastSeason(season)
    if (season != null) markSeen(season, epNum, true)
    if (details) {
      recordRecent({
        kind: 'tv', id: details.id, title: details.name,
        poster: details.poster_path ? `${IMG}${details.poster_path}` : null,
        backdrop: details.backdrop_path ? `${BACKDROP}${details.backdrop_path}` : null,
        season, episode: epNum, totalEpisodes: details.number_of_episodes,
      })
    }
    if (user) upsertWatching(user, details, season, epNum)
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
  if (isAdultTmdbDetails(details)) {
    return (
      <div className="page">
        <div className="empty"><div className="emoji">🚫</div><p>This title isn’t available on AniWave.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => navigate('/tv')}>Browse TV shows</button>
        </div>
      </div>
    )
  }

  const seasons = (details.seasons || []).filter((s) => s?.season_number > 0)
  const year = details.first_air_date ? details.first_air_date.slice(0, 4) : ''
  const ongoing = /return|ongoing|airing/i.test(details.status || '')
  const backdrop = details.backdrop_path ? `${BACKDROP}${details.backdrop_path}` : null
  const resuming = !!(lastEp && lastSeason)
  const firstEp = seasonData?.episodes?.[0]?.episode_number || 1
  const playLabel = resuming ? `Continue S${lastSeason} · E${lastEp}` : `Play S${selectedSeason || 1} · E${firstEp}`
  const rating = details.vote_average ? details.vote_average.toFixed(1) : null
  const seasonCount = details.number_of_seasons || seasons.length
  const genre = details.genres?.[0]?.name
  const heroPlay = () => {
    if (lastEp && lastSeason) { setSelectedSeason(lastSeason); play(lastEp, lastSeason) }
    else play(seasonData?.episodes?.[0]?.episode_number || 1)
  }
  const share = () => {
    if (navigator.share) navigator.share({ title: details.name, url: window.location.href }).catch(() => {})
    else navigator.clipboard?.writeText(window.location.href)
  }

  return (
    <div className="fu">
      <button className="fu-back" onClick={() => navigate(-1)} aria-label="Back"><Icon.back width="18" height="18" /></button>

      {/* Show header: picture, title, one info line, short description,
          one clear main action, three small shortcuts. */}
      <section className="tvh">
        <div className="tvh-art">{backdrop && <img src={backdrop} alt="" />}</div>
        <div className="tvh-body">
          <h1 className="tvh-title">{details.name}</h1>
          <div className="tvh-meta">
            {rating && <span className="tvh-rating"><span aria-hidden="true">★</span> {rating}</span>}
            {year && <span>{year}</span>}
            {seasonCount > 0 && <span>{seasonCount} Season{seasonCount > 1 ? 's' : ''}</span>}
            {genre && <span>{genre}</span>}
            {ongoing && <span>Ongoing</span>}
          </div>
          {details.overview && (
            <p className="tvh-desc" onClick={() => setSynOpen(true)} title="Read full description">{details.overview}</p>
          )}

          <button className="tvh-play" onClick={heroPlay}>
            <Icon.play width="16" height="16" /> {playLabel}
          </button>

          <div className="tvh-shortcuts">
            {resuming && (
              <button className="tvh-sc" onClick={() => { setSelectedSeason(lastSeason); play(lastEp + 1, lastSeason) }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5v14l10-7z" fill="currentColor" stroke="none" /><path d="M19 5v14" /></svg>
                <span>Next episode</span>
              </button>
            )}
            <button className={'tvh-sc' + (inWatchlist ? ' on' : '')} onClick={toggleWatchlist} aria-pressed={inWatchlist}>
              {inWatchlist
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
              <span>{inWatchlist ? 'In My List' : 'My List'}</span>
            </button>
            <button className={'tvh-sc' + (showDl ? ' on' : '')} onClick={() => setShowDl((v) => !v)} aria-expanded={showDl}>
              <Icon.download width="20" height="20" />
              <span>Download</span>
            </button>
            <button className="tvh-sc" onClick={share}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
              <span>Share</span>
            </button>
          </div>
          {showDl && <div className="tvh-dl"><DownloadLinks title={details.name} /></div>}
        </div>
      </section>

      <section className="fu-eps">
        <div className="fu-eps-head">
          <div>
            <div className="fu-eps-eyebrow">{(seasonData?.name || (selectedSeason ? `Season ${selectedSeason}` : 'Episodes'))}{seasonData?.episodes?.length ? ` · ${seasonData.episodes.length} Episodes` : ''}</div>
            <h2 className="fu-h2">Episodes</h2>
          </div>
          {seasons.length > 0 && (
            isMobile && seasons.length > 3 ? (
              <select
                className="fu-season-select"
                value={selectedSeason ?? ''}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                aria-label="Select season"
              >
                {seasons.map((s) => (
                  <option key={s.id || s.season_number} value={s.season_number}>Season {s.season_number}</option>
                ))}
              </select>
            ) : (
              <div className="fu-seg">
                {seasons.map((s) => (
                  <button key={s.id || s.season_number} className={'fu-seg-btn' + (selectedSeason === s.season_number ? ' on' : '')} onClick={() => setSelectedSeason(s.season_number)}>Season {s.season_number}</button>
                ))}
              </div>
            )
          )}
        </div>

        {seasonLoading ? (
          <div className="fu-center"><span className="spinner lg" /></div>
        ) : seasonData?.episodes?.length ? (
          <div className="fu-ep-list">
            {seasonData.episodes.map((ep) => {
              const isLast = lastSeason === selectedSeason && lastEp === ep.episode_number
              const isSeen = seen.has(tvEpKey(selectedSeason, ep.episode_number))
              const thumb = ep.still_path ? `${IMG}${ep.still_path}` : (details.poster_path ? `${IMG}${details.poster_path}` : null)
              const meta = [ep.air_date, typeof ep.runtime === 'number' ? `${ep.runtime} min` : null].filter(Boolean).join(' · ')
              return (
                <div key={ep.id} className={'fu-ep' + (isSeen ? ' seen' : '')} onClick={() => play(ep.episode_number)}>
                  <div className="fu-still">
                    {thumb ? <img src={thumb} alt={ep.name} loading="lazy" /> : null}
                    <span className="fu-ep-badge">EP {ep.episode_number}</span>
                    {isSeen && (
                      <button
                        type="button"
                        className="fu-seen-check"
                        title="Watched (tap to unmark)"
                        aria-label={`Unmark episode ${ep.episode_number} as watched`}
                        onClick={(e) => { e.stopPropagation(); markSeen(selectedSeason, ep.episode_number, false) }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </button>
                    )}
                  </div>
                  <div className="fu-ep-body">
                    <div className="fu-ep-titlerow">
                      <h3 className="fu-ep-title">{ep.name || `Episode ${ep.episode_number}`}</h3>
                      {isLast && <span className="fu-tag">Continue</span>}
                      {isSeen && !isLast && (
                        <span className="fu-seen-pill"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>Watched</span>
                      )}
                    </div>
                    {meta && <div className="fu-ep-meta">{meta}</div>}
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
          onNext={() => play(playing + 1)}
          onJump={(ep, season) => {
            if (season && season !== selectedSeason) setSelectedSeason(season)
            play(ep, season || selectedSeason)
          }}
          hasNext={!!seasonData?.episodes?.some((e) => e.episode_number === playing + 1)}
        />
      )}

      {synOpen && (
        <div className="modal" onClick={() => setSynOpen(false)}>
          <div className="fu-syn-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fu-syn-head">
              <div>
                <div className="fu-syn-eyebrow">Series{year ? ` · ${year}` : ''}</div>
                <h3 className="fu-syn-title">{details.name}</h3>
              </div>
              <button className="fu-syn-close" onClick={() => setSynOpen(false)} aria-label="Close"><Icon.close width="18" height="18" /></button>
            </div>
            <p className="fu-syn-body">{details.overview}</p>
          </div>
        </div>
      )}
    </div>
  )
}
