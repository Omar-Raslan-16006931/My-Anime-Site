import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'
import Icon from '../components/Icons'
import { recordRecent } from '../lib/progress'
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

const EP_GROUP = 100

export default function AnimeDetail({ user, onAuthRequired }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const malId = Number(id)

  const [details, setDetails] = useState(null)
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
  const [epPage, setEpPage] = useState(1)

  // Anime data — keyed on the title only. Deliberately NOT on `user`, so auth
  // token refreshes (e.g. returning to the browser tab) never reload the page
  // or unmount an in-progress player.
  useEffect(() => {
    if (!malId) return
    let cancelled = false
    setLoading(true); setLoadError(''); setEpisodes([]); setEpCount(null); setIsAiring(false)
    setEpPage(1); setDetails(null)

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
  const pageCount = totalForPaging ? Math.ceil(totalForPaging / EP_GROUP) : 1
  const episodesByNum = useMemo(
    () => new Map(episodes.filter((e) => typeof e.episode === 'number').map((e) => [e.episode, e])),
    [episodes]
  )
  const pageItems = totalEps
    ? Array.from({ length: Math.min(EP_GROUP, totalEps - (epPage - 1) * EP_GROUP) }, (_, i) => {
        const num = (epPage - 1) * EP_GROUP + i + 1
        return { num, ep: episodesByNum.get(num) || null }
      })
    : episodes.slice((epPage - 1) * EP_GROUP, epPage * EP_GROUP).map((ep) => ({ num: ep.episode ?? ep.mal_id, ep }))

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
  const trailer = details.trailer?.embed_url

  return (
    <div className="page">
      <button className="icon-btn detail-back" onClick={() => navigate(-1)}><Icon.back width="18" height="18" /></button>

      <div className="detail-head">
        <div className="detail-poster"><img src={poster} alt={details.title} /></div>
        <div className="detail-info">
          <h1 className="detail-title">{details.title_english || details.title}</h1>
          {details.title && details.title_english && details.title_english !== details.title && (
            <p className="detail-orig">{details.title}</p>
          )}

          <div className="meta-pills">
            <div className="pill"><div className="pill-k">Score</div><div className="pill-v">{details.score || 'N/A'}</div></div>
            <div className="pill"><div className="pill-k">Episodes</div><div className="pill-v">{totalEps || '?'}{isAiring ? ' aired' : ''}</div></div>
            <div className="pill"><div className="pill-k">Status</div><div className="pill-v">{details.status?.split(' ')[0] || 'N/A'}</div></div>
            <div className="pill"><div className="pill-k">Type</div><div className="pill-v">{details.type || 'N/A'}</div></div>
          </div>

          <div className="genres">{(details.genres || []).map((g) => <span key={g.mal_id} className="tag">{g.name}</span>)}</div>

          {lastWatched && (
            <div className="resume-bar">
              <div><div className="lbl">Last watched</div><div className="val">Episode {lastWatched}{lastWatchedAt ? ` · ${fmtDate(lastWatchedAt)}` : ''}</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => play(lastWatched)}><Icon.play width="15" height="15" /> Resume</button>
            </div>
          )}

          <div className="detail-actions">
            <button className="btn btn-light" onClick={() => play(lastWatched || 1)}><Icon.play width="17" height="17" /> Play</button>
            <button className={inWatchlist ? 'btn btn-outline' : 'btn btn-primary'} onClick={toggleWatchlist}>
              {inWatchlist ? <><Icon.check width="16" height="16" /> In List</> : <><Icon.plus width="16" height="16" /> My List</>}
            </button>
          </div>
          <DownloadLinks title={details.title_english || details.title} />
        </div>
      </div>

      <div className="tabs">
        {['episodes', 'overview', 'trailer'].map((t) => (
          <button key={t} className={'tab-btn' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
            {t === 'episodes' ? `Episodes${totalEps ? ` (${totalEps})` : ''}` : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <p className="synopsis">{details.synopsis || 'No synopsis available.'}</p>}

      {tab === 'episodes' && (
        <div>
          {pageCount > 1 && (
            <div className="ep-toolbar">
              <span className="muted" style={{ fontSize: 13 }}>{totalEps} episodes</span>
              <select className="select-min" value={epPage} onChange={(e) => setEpPage(Number(e.target.value))}>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>{(p - 1) * EP_GROUP + 1}–{Math.min(p * EP_GROUP, totalForPaging)}</option>
                ))}
              </select>
            </div>
          )}

          {epLoading && episodes.length === 0 ? (
            <div className="center-msg"><span className="spinner" /></div>
          ) : pageItems.length ? (
            <div className="ep-list">
              {pageItems.map(({ num, ep }) => {
                const seen = episodeProgress[Number(num)]?.seen
                const thumb = ep?.images?.jpg?.image_url || poster
                return (
                  <div key={`${malId}-${num}`} className={'ep' + (seen ? ' seen' : '')}>
                    <div className="ep-main" onClick={() => play(num)}>
                      <div className="ep-thumb">
                        {thumb ? <img src={thumb} alt={`EP ${num}`} /> : null}
                        <span className="num">EP {num}</span>
                        {seen && <span className="seen-dot">SEEN</span>}
                      </div>
                      <div className="ep-body">
                        <div className="ep-name">{ep?.title || `Episode ${num}`}</div>
                        <div className="ep-sub">{seen ? `Seen${episodeProgress[Number(num)]?.seen_at ? ` · ${fmtDate(episodeProgress[Number(num)].seen_at)}` : ''}` : ep?.aired ? ep.aired.split('T')[0] : `Episode ${num}`}</div>
                      </div>
                    </div>
                    <div className="ep-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => play(num)}><Icon.play width="14" height="14" /></button>
                      <button className={seen ? 'chip active' : 'chip'} onClick={() => toggleSeen(num, seen)}>{seen ? 'Seen' : 'Mark'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="muted">No episode data available.</p>
          )}
        </div>
      )}

      {tab === 'trailer' && (
        trailer ? (
          <div className="player-frame" style={{ maxWidth: 860 }}>
            <iframe src={trailer} title="trailer" allowFullScreen />
          </div>
        ) : <p className="muted">No trailer available.</p>
      )}

      {playingEp != null && (
        <VideoPlayer
          key={`anime-${malId}-${playingEp}`}
          mediaType="anime"
          malId={details.mal_id}
          title={details.title_english || details.title}
          episode={playingEp}
          season={1}
          onClose={() => setPlayingEp(null)}
        />
      )}
    </div>
  )
}
