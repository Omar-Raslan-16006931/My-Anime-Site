import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { udb } from '../lib/udb'
import VideoPlayer from '../components/VideoPlayer'
import Icon from '../components/Icons'
import GenreChips from '../components/GenreChips'
import Select from '../components/Select'
import { normalizeGenres } from '../lib/categories'
import { recordRecent } from '../lib/progress'
import { animeDetails, animeEpisodes, isAdultAnime } from '../lib/anime'
import { toast } from '../lib/toast'
import WatchedButton from '../components/WatchedButton'
import { fromAnime } from '../lib/watched'
import DownloadLinks from '../components/DownloadLinks'
import Collapse from '../components/Collapse'
import PlayerEpisodes from '../components/PlayerEpisodes'
import MoreLikeThis from '../components/MoreLikeThis'

async function upsertWatching(user, d, epNum) {
  if (!user || !d) return
  await udb.from('currently_watching').upsert({
    user_id: user.id, mal_id: d.mal_id, title: d.title_english || d.title,
    poster: d.images?.jpg?.large_image_url || d.images?.jpg?.image_url || null,
    score: d.score, last_episode: epNum, total_episodes: d.episodes || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,mal_id' })
}

const fmtDate = (s) => {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const OP_PER = 12 // episodes per page within a saga (One Piece browser)

// Canonical One Piece saga model (name → inclusive episode range).
const OP_SAGAS = [
  { name: 'East Blue', start: 1, end: 61 },
  { name: 'Alabasta', start: 62, end: 135 },
  { name: 'Sky Island', start: 136, end: 206 },
  { name: 'Water 7', start: 207, end: 325 },
  { name: 'Thriller Bark', start: 326, end: 384 },
  { name: 'Summit War', start: 385, end: 516 },
  { name: 'Fish-Man Island', start: 517, end: 574 },
  { name: 'Dressrosa', start: 575, end: 746 },
  { name: 'Whole Cake Island', start: 747, end: 889 },
  { name: 'Wano Country', start: 890, end: 1085 },
  { name: 'Final Saga', start: 1086, end: 1165 },
]
const OP_MILESTONES = {
  1: "I'm Luffy! The Man Who's Gonna Be King of the Pirates",
  377: 'The Death of Portgas D. Ace',
  1000: 'The Straw Hats Come Together',
  1015: 'The Decisive Battle of Onigashima',
  1071: "Luffy's Peak: Gear Five",
  1086: 'A New Emperor: Buggy the Star Clown',
}

// Saga/range tabs for any show: canonical for One Piece (mal 21), otherwise
// 100-episode ranges so long-runners stay navigable. Short shows get one range.
function buildSagas(malId, total) {
  if (malId === 21) {
    // The last (ongoing) saga always runs up to the latest aired episode, so new
    // episodes appear automatically instead of stopping at a hardcoded number.
    const last = OP_SAGAS[OP_SAGAS.length - 1]
    const end = total && total >= last.start ? total : last.end
    return [...OP_SAGAS.slice(0, -1), { ...last, end }]
  }
  const n = total || 0
  if (n <= 50) return [{ name: 'Episodes', start: 1, end: Math.max(n, 1) }]
  const out = []
  for (let s = 1; s <= n; s += 100) out.push({ name: `Episodes ${s}–${Math.min(s + 99, n)}`, start: s, end: Math.min(s + 99, n) })
  return out
}

export default function AnimeDetail({ user, onAuthRequired }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const malId = Number(id)

  const [details, setDetails] = useState(null)
  const [banner, setBanner] = useState(null)
  const [jump, setJump] = useState('')
  const [episodes, setEpisodes] = useState([])
  const [epCount, setEpCount] = useState(null)
  const [isAiring, setIsAiring] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [episodeProgress, setEpisodeProgress] = useState({})
  const [lastWatched, setLastWatched] = useState(null)
  const [lastWatchedAt, setLastWatchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [epLoading, setEpLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [playingEp, setPlayingEp] = useState(null)
  const [opSaga, setOpSaga] = useState(0)
  const [opPage, setOpPage] = useState(0)
  const [synOpen, setSynOpen] = useState(false)
  const [showDl, setShowDl] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const on = () => setIsMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Lock background scroll while the synopsis popup is open so swiping inside it
  // never drags the page behind.
  useEffect(() => {
    if (!synOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [synOpen])

  // Anime data — keyed on the title only. Deliberately NOT on `user`, so auth
  // token refreshes (e.g. returning to the browser tab) never reload the page
  // or unmount an in-progress player.
  useEffect(() => {
    if (!malId) return
    let cancelled = false
    setLoading(true); setLoadError(''); setEpisodes([]); setEpCount(null); setIsAiring(false)
    setOpSaga(0); setOpPage(0); setDetails(null); setBanner(null)

    // Details: Jikan + AniList in parallel, merged (either one alone is enough).
    animeDetails(malId).then((res) => {
      if (cancelled) return
      if (!res?.data) setLoadError('Failed to load anime details.')
      else {
        setDetails(res.data)
        if (res.banner) setBanner(res.banner)
        if (res.epCount) { setEpCount(res.epCount.n); setIsAiring(res.epCount.airing) }
      }
      setLoading(false)
    })

    // Episode titles (best-effort — the browser works from numbers without them).
    setEpLoading(true)
    animeEpisodes(malId, () => cancelled).then((all) => {
      if (cancelled) return
      setEpisodes(all)
      setEpLoading(false)
    })

    return () => { cancelled = true }
  }, [malId])

  // Per-user state (watchlist membership, seen episodes, resume point).
  const userId = user?.id
  useEffect(() => {
    if (!malId) return
    let cancelled = false
    setInWatchlist(false); setEpisodeProgress({}); setLastWatched(null); setLastWatchedAt(null)
    if (!userId) return

    udb.from('watchlist').select('mal_id').eq('user_id', userId).eq('mal_id', malId).limit(1).maybeSingle()
      .then(({ data }) => !cancelled && setInWatchlist(!!data)).catch(() => {})
    udb.from('anime_episode_progress').select('episode_number, seen, seen_at')
      .eq('user_id', userId).eq('mal_id', malId).eq('seen', true)
      .then(({ data }) => {
        if (cancelled) return
        const map = {}
        ;(data || []).forEach((row) => { map[Number(row.episode_number)] = { seen: true, seen_at: row.seen_at } })
        setEpisodeProgress(map)
      }).catch(() => {})
    udb.from('currently_watching').select('last_episode, updated_at').eq('user_id', userId).eq('mal_id', malId).limit(1).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setLastWatched(data?.last_episode ?? null); setLastWatchedAt(data?.updated_at ?? null) } }).catch(() => {})

    return () => { cancelled = true }
  }, [malId, userId])

  const totalEps = epCount || details?.episodes || null
  const totalForPaging = totalEps ?? episodes.length
  const episodesByNum = useMemo(
    () => new Map(episodes.filter((e) => typeof e.episode === 'number').map((e) => [e.episode, e])),
    [episodes]
  )

  // Saga browser derived state.
  const sagas = useMemo(() => buildSagas(malId, totalForPaging), [malId, totalForPaging])
  const saga = sagas[Math.min(opSaga, sagas.length - 1)] || sagas[0]
  const sagaPageCount = Math.max(1, Math.ceil((saga.end - saga.start + 1) / OP_PER))
  const rangeStart = saga.start + opPage * OP_PER
  const rangeEnd = Math.min(rangeStart + OP_PER - 1, saga.end)
  const opRows = Array.from({ length: Math.max(0, rangeEnd - rangeStart + 1) }, (_, i) => {
    const num = rangeStart + i
    return { num, ep: episodesByNum.get(num) || null }
  })
  const milestoneTitle = (n) => (malId === 21 ? OP_MILESTONES[n] : null)

  const markSeen = async (epNum) => {
    if (!user) return onAuthRequired?.()
    const now = new Date().toISOString()
    const { error } = await udb.from('anime_episode_progress').upsert(
      { user_id: user.id, mal_id: malId, episode_number: Number(epNum), seen: true, seen_at: now, updated_at: now },
      { onConflict: 'user_id,mal_id,episode_number' }
    )
    if (!error) setEpisodeProgress((p) => ({ ...p, [Number(epNum)]: { seen: true, seen_at: now } }))
  }

  const toggleSeen = async (epNum, isSeen) => {
    if (!user) return onAuthRequired?.()
    if (!isSeen) return markSeen(epNum)
    const { error } = await udb.from('anime_episode_progress').delete()
      .eq('user_id', user.id).eq('mal_id', malId).eq('episode_number', Number(epNum))
    if (!error) setEpisodeProgress((p) => { const n = { ...p }; delete n[Number(epNum)]; return n })
  }

  const play = async (epNum) => {
    const ep = Number(epNum)
    if (!Number.isFinite(ep)) return
    setPlayingEp(ep)
    if (details) {
      recordRecent({
        kind: 'anime', id: malId, title: details.title_english || details.title,
        poster: details.images?.jpg?.large_image_url, backdrop: details.images?.jpg?.large_image_url,
        episode: ep, totalEpisodes: totalEps || null,
      })
    }
    if (user && details) {
      setLastWatched(ep); setLastWatchedAt(new Date().toISOString())
      await upsertWatching(user, details, ep)
      await markSeen(ep)
    }
  }

  const toggleWatchlist = async () => {
    if (!user) return onAuthRequired?.()
    if (!details) return
    if (inWatchlist) {
      const { error } = await udb.from('watchlist').delete().eq('user_id', user.id).eq('mal_id', malId)
      if (!error) { setInWatchlist(false); toast('Removed from My List') }
    } else {
      const { error } = await udb.from('watchlist').insert({
        user_id: user.id, mal_id: malId, title: details.title_english || details.title,
        poster: details.images?.jpg?.large_image_url || details.images?.jpg?.image_url || null, score: details.score,
      })
      if (!error) { setInWatchlist(true); toast('Added to My List') }
    }
  }

  const selectSaga = (i) => { setOpSaga(i); setOpPage(0) }
  const jumpToEp = (n) => {
    const num = parseInt(n, 10)
    if (!num || num < 1) return
    const i = sagas.findIndex((s) => num >= s.start && num <= s.end)
    if (i < 0) return
    setOpSaga(i); setOpPage(Math.floor((num - sagas[i].start) / OP_PER)); setJump('')
  }

  if (loading) return <div className="page"><div className="center-msg"><span className="spinner" /></div></div>
  if (details && isAdultAnime(details)) {
    return (
      <div className="page">
        <button className="icon-btn detail-back" onClick={() => navigate(-1)}><Icon.back width="18" height="18" /></button>
        <div className="empty"><div className="emoji">🚫</div><p>This title isn’t available on Yoru.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => navigate('/anime')}>Browse anime</button>
        </div>
      </div>
    )
  }
  if (loadError || !details) {
    return (
      <div className="page">
        <button className="icon-btn detail-back" onClick={() => navigate(-1)}><Icon.back width="18" height="18" /></button>
        <div className="empty"><div className="emoji">⚠️</div><p>Couldn’t load this anime.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  const poster = details.images?.jpg?.large_image_url || details.images?.jpg?.image_url
  const title = details.title_english || details.title
  const genreNames = normalizeGenres(details.genres)
  const eyebrow = `Anime${details.year ? ` · ${details.year}${isAiring ? '–' : ''}` : ''}`
  const resumeLabel = lastWatched ? `Continue · EP ${lastWatched}` : 'Play · EP 1'
  const share = () => {
    if (navigator.share) navigator.share({ title, url: window.location.href }).catch(() => {})
    else navigator.clipboard?.writeText(window.location.href)
  }
  const curSaga = Math.min(opSaga, sagas.length - 1)

  return (
    <div className="fu">
      <button className="fu-back" onClick={() => navigate(-1)} aria-label="Back"><Icon.back width="18" height="18" /></button>

      {/* Same header as the TV page: artwork behind everything, title, one
          info line, categories, short description, one main action, shortcuts. */}
      <section className="tvh">
        <div className="tvh-art">
          {(banner || poster) && <img src={banner || poster} alt="" className={banner ? '' : 'is-poster'} />}
        </div>
        <div className="tvh-body">
          <h1 className="tvh-title">{title}</h1>
          <div className="tvh-meta">
            {details.score ? <span className="tvh-rating"><span aria-hidden="true">★</span> {Number(details.score).toFixed(1)}</span> : null}
            {details.year ? <span>{details.year}</span> : null}
            {totalEps ? <span>{totalEps.toLocaleString()} Episode{totalEps > 1 ? 's' : ''}</span> : null}
            {sagas.length > 1 ? <span>{sagas.length} {malId === 21 ? 'Sagas' : 'Parts'}</span> : null}
            <span>{isAiring ? 'Ongoing' : (details.status?.split(' ')[0] || 'Finished')}</span>
          </div>
          <GenreChips genres={genreNames} className="on-art" />
          {details.synopsis && (
            <p className="tvh-desc" onClick={() => setSynOpen(true)} title="Read full description">{details.synopsis}</p>
          )}

          <div className="tvh-actions">
          <button className="tvh-play" onClick={() => play(lastWatched || 1)}>
            <Icon.play width="16" height="16" /> {resumeLabel}
          </button>

          <div className="tvh-shortcuts">
            {lastWatched && (!totalEps || lastWatched < totalEps) && (
              <button title="Next ep" className="tvh-sc" onClick={() => play(lastWatched + 1)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5v14l10-7z" fill="currentColor" stroke="none" /><path d="M19 5v14" /></svg>
                <span className="tvh-lbl">Next ep</span>
              </button>
            )}
            <button className={'tvh-sc' + (inWatchlist ? ' on' : '')} onClick={toggleWatchlist} aria-pressed={inWatchlist}>
              {inWatchlist
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
              <span>{inWatchlist ? 'In My List' : 'My List'}</span>
            </button>
            <WatchedButton user={user} onAuthRequired={onAuthRequired} build={() => (details ? fromAnime(details, malId) : null)} />
            <button title="Download" className={'tvh-sc' + (showDl ? ' on' : '')} onClick={() => setShowDl((v) => !v)} aria-expanded={showDl}>
              <Icon.download width="20" height="20" />
              <span className="tvh-lbl">Download</span>
            </button>
            <button title="Share" className="tvh-sc" onClick={share}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
              <span className="tvh-lbl">Share</span>
            </button>
          </div>
          </div>
          <Collapse open={showDl}><div className="tvh-dl"><DownloadLinks title={title} /></div></Collapse>
        </div>
      </section>

      {/* Episodes header with the season/saga picker — same as the TV page.
          More than 6 seasons (or more than 3 on a phone) → a drop-down. */}
      <section className="fu-eps">
        <div className="fu-eps-head">
          <h2 className="fu-h2">{saga.end >= saga.start ? `${saga.end - saga.start + 1} ` : ''}Episodes</h2>
          {sagas.length > 1 && (
            sagas.length > 6 || (isMobile && sagas.length > 3) ? (
              <Select
                value={curSaga}
                onChange={selectSaga}
                label={malId === 21 ? 'Select saga' : 'Select part'}
                options={sagas.map((s, i) => ({ value: i, label: `${s.name}${malId === 21 ? ' Saga' : ''} · EP ${s.start}–${s.end}` }))}
              />
            ) : (
              <div className="fu-seg">
                {sagas.map((s, i) => (
                  <button key={i} className={'fu-seg-btn' + (i === curSaga ? ' on' : '')} onClick={() => selectSaga(i)}>{s.name}</button>
                ))}
              </div>
            )
          )}
        </div>

        <div className="ae-bar">
          <div className="ae-ranges">
            {Array.from({ length: sagaPageCount }, (_, i) => {
              const st = saga.start + i * OP_PER
              const en = Math.min(st + OP_PER - 1, saga.end)
              return (
                <button key={i} type="button" className={'ae-range' + (i === opPage ? ' on' : '')} onClick={() => setOpPage(i)}>{st}–{en}</button>
              )
            })}
          </div>
          <form className={'ae-jump' + (jump !== '' ? ' open' : '')} onSubmit={(e) => { e.preventDefault(); jumpToEp(jump) }}>
            <label className="ae-jump-icon" aria-label="Jump to episode">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
              <input type="number" min="1" inputMode="numeric" placeholder="Jump to ep" value={jump} onChange={(e) => setJump(e.target.value)} />
            </label>
            <button type="submit" className="ae-jump-go">Go</button>
          </form>
        </div>

        <div className="fu-ep-list">
          {opRows.map(({ num, ep }) => {
            const seen = !!episodeProgress[Number(num)]?.seen
            const thumb = ep?.images?.jpg?.image_url || poster
            const isLast = lastWatched === Number(num)
            const epTitle = milestoneTitle(num) || ep?.title || `Episode ${num}`
            const meta = [
              ep?.aired ? fmtDate(ep.aired) : null,
              ep?.filler ? 'Filler' : null,
              ep?.recap ? 'Recap' : null,
            ].filter(Boolean).join(' · ')
            return (
              <div key={`${malId}-${num}`} className={'fu-ep' + (seen ? ' seen' : '')} onClick={() => play(num)}>
                <div className="fu-still">
                  {thumb ? <img src={thumb} alt={`EP ${num}`} loading="lazy" /> : null}
                  <span className="fu-ep-badge">EP {num}</span>
                  {seen && (
                    <button
                      type="button"
                      className="fu-seen-check"
                      title="Watched (tap to unmark)"
                      aria-label={`Unmark episode ${num} as watched`}
                      onClick={(e) => { e.stopPropagation(); toggleSeen(num, true) }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </button>
                  )}
                </div>
                <div className="fu-ep-body">
                  <div className="fu-ep-titlerow">
                    <h3 className="fu-ep-title">{epTitle}</h3>
                    {isLast && <span className="fu-tag">Continue</span>}
                    {seen && !isLast && (
                      <span className="fu-seen-pill"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>Watched</span>
                    )}
                  </div>
                  {meta && <div className="fu-ep-meta">{meta}</div>}
                </div>
                <div className="fu-play" onClick={(e) => { e.stopPropagation(); play(num) }}><Icon.play width="18" height="18" /></div>
              </div>
            )
          })}
        </div>
      </section>

      {playingEp != null && (
        <VideoPlayer
          key={`anime-${malId}-${playingEp}`}
          mediaType="anime"
          malId={details.mal_id}
          title={title}
          episode={playingEp}
          season={1}
          onClose={() => setPlayingEp(null)}
          onNext={() => play(playingEp + 1)}
          onJump={(ep) => play(ep)}
          poster={poster}
          altTitles={[details.title, ...(details.title_synonyms || [])].filter((t) => t && t !== title)}
          hasNext={!totalEps || playingEp < totalEps}
          watched={!!episodeProgress[Number(playingEp)]?.seen}
          onToggleWatched={() => toggleSeen(playingEp, !!episodeProgress[Number(playingEp)]?.seen)}
          aside={(
            <PlayerEpisodes
              heading="Episodes"
              current={playingEp}
              onPick={(n) => play(n)}
              items={opRows.map(({ num, ep }) => ({
                num: Number(num),
                title: milestoneTitle(num) || ep?.title || `Episode ${num}`,
                thumb: ep?.images?.jpg?.image_url || poster,
                meta: [ep?.aired ? fmtDate(ep.aired) : null, ep?.filler ? 'Filler' : null].filter(Boolean).join(' · '),
                seen: !!episodeProgress[Number(num)]?.seen,
              }))}
            />
          )}
        />
      )}

      <MoreLikeThis kind="anime" id={malId} genres={genreNames} />

      {synOpen && (
        <div className="modal" onClick={() => setSynOpen(false)}>
          <div className="fu-syn-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fu-syn-head">
              <div>
                <div className="fu-syn-eyebrow">{eyebrow}</div>
                <h3 className="fu-syn-title">{title}</h3>
              </div>
              <button className="fu-syn-close" onClick={() => setSynOpen(false)} aria-label="Close"><Icon.close width="18" height="18" /></button>
            </div>
            <p className="fu-syn-body">{details.synopsis}</p>
          </div>
        </div>
      )}
    </div>
  )
}
