import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'
import Icon from '../components/Icons'
import { recordRecent } from '../lib/progress'
import { animeArtFromMal } from '../lib/anilist'
import { toast } from '../lib/toast'
import DownloadLinks from '../components/DownloadLinks'

async function jikan(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url)
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 1000 * (i + 1))); continue }
    return res
  }
  return fetch(url)
}

async function getEpCount(malId) {
  try {
    const query = `query ($id: Int){ Media(idMal: $id, type: ANIME){ episodes status nextAiringEpisode { episode } } }`
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: malId } }),
    })
    const media = (await res.json())?.data?.Media
    if (!media) return null
    if (media.nextAiringEpisode?.episode) return { n: media.nextAiringEpisode.episode - 1, airing: true }
    if (media.episodes) return { n: media.episodes, airing: false }
    return null
  } catch { return null }
}

async function upsertWatching(user, d, epNum) {
  if (!user || !d) return
  await supabase.from('currently_watching').upsert({
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
  1071: "Luffy's Peak — Gear Five",
  1086: 'A New Emperor — Buggy the Star Clown',
}

// Saga/range tabs for any show: canonical for One Piece (mal 21), otherwise
// 100-episode ranges so long-runners stay navigable. Short shows get one range.
function buildSagas(malId, total) {
  if (malId === 21) return OP_SAGAS
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
  const [tab, setTab] = useState('episodes')
  const [playingEp, setPlayingEp] = useState(null)
  const [opSaga, setOpSaga] = useState(0)
  const [opPage, setOpPage] = useState(0)

  // Anime data — keyed on the title only. Deliberately NOT on `user`, so auth
  // token refreshes (e.g. returning to the browser tab) never reload the page
  // or unmount an in-progress player.
  useEffect(() => {
    if (!malId) return
    let cancelled = false
    setLoading(true); setLoadError(''); setEpisodes([]); setEpCount(null); setIsAiring(false)
    setOpSaga(0); setOpPage(0); setDetails(null); setBanner(null)

    ;(async () => {
      try {
        const r = await jikan(`https://api.jikan.moe/v4/anime/${malId}/full`)
        const d = await r.json()
        if (cancelled) return
        if (!r.ok || !d?.data) throw new Error('fail')
        setDetails(d.data)
      } catch { if (!cancelled) setLoadError('Failed to load anime details.') }
      finally { if (!cancelled) setLoading(false) }
    })()

    // Wide hero banner from AniList (Jikan has no banner art).
    animeArtFromMal(malId).then((art) => { if (!cancelled && art?.banner) setBanner(art.banner) })

    ;(async () => {
      setEpLoading(true)
      let page = 1, all = []
      try {
        while (true) {
          const r = await jikan(`https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`)
          const d = await r.json()
          if (cancelled) return
          if (!r.ok || !d.data?.length) break
          all = [...all, ...d.data]
          if (!d.pagination?.has_next_page) break
          page += 1
          await new Promise((res) => setTimeout(res, 350))
        }
        if (!cancelled) setEpisodes(all)
      } catch { if (!cancelled) setEpisodes([]) }
      finally { if (!cancelled) setEpLoading(false) }
    })()

    getEpCount(malId).then((data) => { if (!cancelled && data) { setEpCount(data.n); setIsAiring(data.airing) } })

    return () => { cancelled = true }
  }, [malId])

  // Per-user state (watchlist membership, seen episodes, resume point).
  const userId = user?.id
  useEffect(() => {
    if (!malId) return
    let cancelled = false
    setInWatchlist(false); setEpisodeProgress({}); setLastWatched(null); setLastWatchedAt(null)
    if (!userId) return

    supabase.from('watchlist').select('mal_id').eq('user_id', userId).eq('mal_id', malId).limit(1).maybeSingle()
      .then(({ data }) => !cancelled && setInWatchlist(!!data)).catch(() => {})
    supabase.from('anime_episode_progress').select('episode_number, seen, seen_at')
      .eq('user_id', userId).eq('mal_id', malId).eq('seen', true)
      .then(({ data }) => {
        if (cancelled) return
        const map = {}
        ;(data || []).forEach((row) => { map[Number(row.episode_number)] = { seen: true, seen_at: row.seen_at } })
        setEpisodeProgress(map)
      }).catch(() => {})
    supabase.from('currently_watching').select('last_episode, updated_at').eq('user_id', userId).eq('mal_id', malId).limit(1).maybeSingle()
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
  const isMilestone = (n) => (malId === 21 ? !!OP_MILESTONES[n] : n === 1 || n % 100 === 0)

  const markSeen = async (epNum) => {
    if (!user) return onAuthRequired?.()
    const now = new Date().toISOString()
    const { error } = await supabase.from('anime_episode_progress').upsert(
      { user_id: user.id, mal_id: malId, episode_number: Number(epNum), seen: true, seen_at: now, updated_at: now },
      { onConflict: 'user_id,mal_id,episode_number' }
    )
    if (!error) setEpisodeProgress((p) => ({ ...p, [Number(epNum)]: { seen: true, seen_at: now } }))
  }

  const toggleSeen = async (epNum, isSeen) => {
    if (!user) return onAuthRequired?.()
    if (!isSeen) return markSeen(epNum)
    const { error } = await supabase.from('anime_episode_progress').delete()
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
      const { error } = await supabase.from('watchlist').delete().eq('user_id', user.id).eq('mal_id', malId)
      if (!error) { setInWatchlist(false); toast('Removed from My List') }
    } else {
      const { error } = await supabase.from('watchlist').insert({
        user_id: user.id, mal_id: malId, title: details.title_english || details.title,
        poster: details.images?.jpg?.large_image_url || details.images?.jpg?.image_url || null, score: details.score,
      })
      if (!error) { setInWatchlist(true); toast('Added to My List') }
    }
  }

  const selectSaga = (i) => { setOpSaga(i); setOpPage(0) }
  const changeOpPage = (d) => setOpPage((p) => Math.max(0, Math.min(sagaPageCount - 1, p + d)))
  const jumpToEp = (n) => {
    const num = parseInt(n, 10)
    if (!num || num < 1) return
    const i = sagas.findIndex((s) => num >= s.start && num <= s.end)
    if (i < 0) return
    setOpSaga(i); setOpPage(Math.floor((num - sagas[i].start) / OP_PER)); setJump('')
  }

  if (loading) return <div className="page"><div className="center-msg"><span className="spinner" /></div></div>
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
  const genreNames = (details.genres || []).map((g) => g.name)
  const eyebrow = `Anime${details.year ? ` · ${details.year}${isAiring ? '–' : ''}` : ''}${genreNames.length ? ` · ${genreNames.slice(0, 2).join(' / ')}` : ''}`
  const resumeLabel = lastWatched ? `Resume EP ${lastWatched}` : 'Play'
  const share = () => {
    if (navigator.share) navigator.share({ title, url: window.location.href }).catch(() => {})
    else navigator.clipboard?.writeText(window.location.href)
  }
  const curSaga = Math.min(opSaga, sagas.length - 1)

  return (
    <div className="fu">
      <button className="fu-back" onClick={() => navigate(-1)} aria-label="Back"><Icon.back width="18" height="18" /></button>

      <div className="fu-ophero">
        <div className="fu-ophero-bg"><div className="g1" /><div className="g2" /><div className="scrim" /></div>
        <div className="fu-op-poster">{poster ? <img src={poster} alt={title} loading="lazy" /> : null}</div>
        <div className="fu-op-headinfo">
          <div className="fu-eyebrow" style={{ color: '#7fd4ee' }}>{eyebrow}</div>
          <h1 className="fu-optitle">{title}</h1>
          <div className="fu-meta">
            {details.score ? <><span className="strong"><span className="star">★</span>{details.score}</span><span className="sep">·</span></> : null}
            {totalEps ? <><span><strong style={{ color: '#fff' }}>{totalEps.toLocaleString()}</strong> episodes</span><span className="sep">·</span></> : null}
            {sagas.length > 1 ? <><span>{sagas.length} sagas</span><span className="sep">·</span></> : null}
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className="fu-dot" style={isAiring ? undefined : { background: '#9b99a8', boxShadow: 'none' }} />{isAiring ? 'Ongoing' : (details.status?.split(' ')[0] || 'Finished')}</span>
          </div>
          {details.synopsis && (
            <p className="fu-syn" style={{ maxWidth: 680, margin: '12px 0 0', fontSize: 13.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{details.synopsis}</p>
          )}
          <div className="fu-actions" style={{ marginTop: 18 }}>
            <button className="fu-btn fu-btn-grad" onClick={() => play(lastWatched || 1)}><Icon.play width="16" height="16" /> {resumeLabel}</button>
            {lastWatched && (!totalEps || lastWatched < totalEps) && (
              <button className="fu-btn fu-btn-glass" onClick={() => play(lastWatched + 1)}><Icon.play width="15" height="15" /> Next Ep</button>
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
          <div className="fu-sources"><DownloadLinks title={title} /></div>
        </div>
      </div>

      {sagas.length > 1 && (
            <div className="fu-sagas">
              {sagas.map((s, i) => (
                <button key={i} className={'fu-saga' + (i === curSaga ? ' on' : '')} onClick={() => selectSaga(i)}>
                  <span className="nm">{s.name}</span>
                  <span className="rg">EP {s.start}–{s.end}</span>
                </button>
              ))}
            </div>
          )}

          <div className="fu-range">
            <div className="fu-range-l">
              <h2 className="fu-h2">Episode {rangeStart}–{rangeEnd}</h2>
              <span className="saga">{saga.name}{malId === 21 ? ' Saga' : ''}</span>
            </div>
            <div className="fu-range-r">
              <form className="fu-jump" onSubmit={(e) => { e.preventDefault(); jumpToEp(jump) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
                <input type="number" min="1" inputMode="numeric" placeholder="Jump to episode…" value={jump} onChange={(e) => setJump(e.target.value)} />
                <button type="submit" className="fu-jump-go">Go</button>
              </form>
              <div className="fu-pager">
                <button className="fu-pager-btn" disabled={opPage <= 0} onClick={() => changeOpPage(-1)} aria-label="Previous page"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
                <span className="fu-pager-label">Page {opPage + 1} / {sagaPageCount}</span>
                <button className="fu-pager-btn" disabled={opPage >= sagaPageCount - 1} onClick={() => changeOpPage(1)} aria-label="Next page"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
              </div>
            </div>
          </div>

          <div className="fu-op-grid">
            {opRows.map(({ num, ep }) => {
              const seen = episodeProgress[Number(num)]?.seen
              const thumb = ep?.images?.jpg?.image_url || poster
              const cont = lastWatched === Number(num)
              const mile = isMilestone(num)
              const epTitle = milestoneTitle(num) || ep?.title || `Episode ${num}`
              const meta = `${saga.name}${malId === 21 ? ' Arc' : ''}   ·   Subbed · Dubbed   ·   ~24 min`
              return (
                <div key={`${malId}-${num}`} className={'fu-op-ep' + (seen ? ' seen' : '')} onClick={() => play(num)}>
                  <div className="fu-op-still">
                    {thumb ? <img src={thumb} alt={`EP ${num}`} loading="lazy" /> : null}
                    <span className="fu-op-badge">EP {num}</span>
                    {seen && (
                      <span className="fu-seen-check" title="Watched">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                    )}
                    {cont && <div className="fu-op-prog"><span style={{ width: '55%' }} /></div>}
                  </div>
                  <div className="fu-op-body">
                    <div className="fu-op-titlerow">
                      <h3 className="fu-op-title">{epTitle}</h3>
                      {mile && <span className="fu-mile">★ MILESTONE</span>}
                      {cont && <span className="fu-tag sm">CONTINUE</span>}
                      {seen && !cont && <span className="fu-seen-pill"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>WATCHED</span>}
                    </div>
                    <div className="fu-ep-meta">{meta}</div>
                  </div>
                  <button className="fu-play sm" onClick={(e) => { e.stopPropagation(); play(num) }} aria-label={`Play episode ${num}`}><Icon.play width="15" height="15" /></button>
                </div>
              )
            })}
          </div>

      {playingEp != null && (
        <VideoPlayer
          key={`anime-${malId}-${playingEp}`}
          mediaType="anime"
          malId={details.mal_id}
          title={title}
          episode={playingEp}
          season={1}
          onClose={() => setPlayingEp(null)}
        />
      )}
    </div>
  )
}
