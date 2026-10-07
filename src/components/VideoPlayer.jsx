import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import Icon from './Icons'
import { availableSources, getPreferredSource, setPreferredSource } from '../lib/sources'
import { allmangaResolve } from '../lib/allmanga'
import { anilistIdFromMal, animeTmdbInfo } from '../lib/anilist'
import DownloadLinks from './DownloadLinks'
import { toast } from '../lib/toast'
import { apiUrl, absoluteUrl, isNative } from '../lib/native'
import { downloadAnimeEpisode, downloadId, isDownloaded, isDownloading, subscribe as subscribeDownloads } from '../lib/offline'

// Subtitle delivery: VidLink takes our file natively (documented `sub_file`
// option), AllManga plays in our own <video> (<track>), and every other embed
// gets our overlay layer timed by the player's reported playback clock.
const subsPrefKey = (type) => `aw:subs:${type}`
// Anime "SUB" streams usually already have subtitles, so default off there.
const readSubsPref = (type) => {
  try {
    const v = localStorage.getItem(subsPrefKey(type))
    return v == null ? type !== 'anime' : v === '1'
  } catch { return type !== 'anime' }
}

const AUTO_KEY = 'aw:autonext'
const readAuto = () => { try { return localStorage.getItem(AUTO_KEY) !== '0' } catch { return true } }
const COUNTDOWN = 5

// Normalise whatever an embed provider posts into { ended, pct, duration }.
// VidLink:  { type:'PLAYER_EVENT', data:{ event:'ended'|'timeupdate', currentTime, duration } }
// MegaPlay: { event:'complete'|'time', time, duration, percent }  (sometimes a JSON string)
// Videasy:  JSON string { progress (0-100), timestamp, duration, ... }
function parsePlayerMessage(raw) {
  let d = raw
  if (typeof d === 'string') { try { d = JSON.parse(d) } catch { return null } }
  if (!d || typeof d !== 'object') return null
  const inner = d.data && typeof d.data === 'object' && !Array.isArray(d.data) ? d.data : d
  const ev = String(inner.event || d.event || '').toLowerCase()
  const ended = ['ended', 'complete', 'completed', 'finish', 'finished', 'end'].includes(ev)
  const current = Number(inner.currentTime ?? inner.time ?? inner.timestamp ?? d.currentTime)
  const duration = Number(inner.duration ?? d.duration)
  let pct = Number(inner.percent ?? (typeof inner.progress === 'number' ? inner.progress : NaN))
  if (!Number.isFinite(pct) && Number.isFinite(current) && Number.isFinite(duration) && duration > 0) pct = (current / duration) * 100
  // Only trust a playback position that looks like seconds into the video
  // (some players send epoch timestamps under similar names).
  const dur = Number.isFinite(duration) && duration > 0 ? duration : null
  const okTime = Number.isFinite(current) && current >= 0 && current < 6 * 3600 && (dur == null || current <= dur + 5)
  const epNum = Number(inner.episode ?? d.episode)
  const seNum = Number(inner.season ?? d.season)
  return {
    ev,
    ended,
    episode: Number.isInteger(epNum) && epNum > 0 ? epNum : null,
    season: Number.isInteger(seNum) && seNum > 0 ? seNum : null,
    current: okTime ? current : null,
    pct: Number.isFinite(pct) ? pct : null,
    duration: dur,
  }
}

// ── Subtitle overlay helpers ─────────────────────────────────────────────────
// Minimal WebVTT → [{ start, end, text }] (sorted). Styling tags are stripped.
function parseVtt(text) {
  const toSec = (s) => {
    const m = String(s).match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/)
    if (!m) return NaN
    return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000
  }
  const out = []
  for (const block of String(text).replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n')
    const i = lines.findIndex((l) => l.includes('-->'))
    if (i < 0) continue
    const [a, b] = lines[i].split('-->')
    const start = toSec(a)
    const end = toSec(b)
    const body = lines.slice(i + 1).join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .trim()
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && body) out.push({ start, end, text: body })
  }
  return out.sort((x, y) => x.start - y.start)
}

// Text of every cue active at time t (binary search + check a few neighbours
// for overlapping lines).
function cueAt(cues, t) {
  let lo = 0
  let hi = cues.length - 1
  let idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (cues[mid].start <= t) { idx = mid; lo = mid + 1 } else hi = mid - 1
  }
  const hits = []
  for (let k = idx; k >= 0 && k > idx - 4; k--) if (cues[k].end > t) hits.unshift(cues[k].text)
  return hits.join('\n')
}

// True if `win` is our iframe or nested anywhere inside it (players often
// post from an inner frame). Cross-origin `.parent` access is allowed.
function fromFrame(win, frame) {
  if (!win || !frame?.contentWindow) return false
  try {
    let w = win
    for (let i = 0; i < 4 && w; i++) {
      if (w === frame.contentWindow) return true
      if (w === w.parent) break
      w = w.parent
    }
  } catch { /* ignore */ }
  return false
}

export default function VideoPlayer({
  mediaType = 'anime',
  malId,
  tmdbId,
  imdbId,
  anilistId: anilistIdProp,
  title,
  movieTitle,
  episode = 1,
  season = 1,
  onClose,
  onNext,
  onJump, // (episode, season) — the embed switched episodes on its own
  poster, // used for the Downloads list (iPhone app)
  altTitles = [], // other names (romaji, synonyms) — helps AllManga find the show
  hasNext = true,
}) {
  const type = mediaType
  const displayTitle = movieTitle || title
  const safeEpisode = Number(episode) || 1
  const safeSeason = Number(season) || 1
  const canNext = !!onNext && hasNext && type !== 'movie'

  const [audio, setAudio] = useState('sub')
  const [sourceId, setSourceId] = useState(() => getPreferredSource(type))
  const [anilistId, setAnilistId] = useState(anilistIdProp || null)
  const [idsReady, setIdsReady] = useState(type !== 'anime' || !!anilistIdProp)
  const [animeTmdb, setAnimeTmdb] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [streams, setStreams] = useState([])
  const [streamIdx, setStreamIdx] = useState(0)
  const [autoNext, setAutoNext] = useState(readAuto)
  const [countdown, setCountdown] = useState(null)
  const [subsOn, setSubsOn] = useState(() => readSubsPref(mediaType))
  const [subBusy, setSubBusy] = useState(false)
  const [showDl, setShowDl] = useState(false)

  // ── Save offline (iPhone app, anime via AllManga) ──
  const offId = type === 'anime' && malId ? downloadId(malId, safeEpisode, audio) : null
  const [, bumpDl] = useState(0)
  useEffect(() => (isNative ? subscribeDownloads(() => bumpDl((n) => n + 1)) : undefined), [])
  const offState = !offId ? null : isDownloaded(offId) ? 'saved' : isDownloading(offId) ? 'saving' : 'idle'
  const saveOffline = async () => {
    if (!offId || offState !== 'idle') return
    toast('Downloading… see the Downloads tab')
    try {
      await downloadAnimeEpisode({ malId, title: displayTitle, altTitles, episode: safeEpisode, audio, poster })
      toast(`Episode ${safeEpisode} saved for offline`)
    } catch (e) {
      toast(e?.message || 'Download failed')
    }
  }

  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const iframeRef = useRef(null)
  const frameRef = useRef(null)
  const endedRef = useRef(false)
  // Playback clock reported by the embed (for the subtitle overlay).
  const clockRef = useRef({ t: null, at: 0, playing: false })
  const clockLiveRef = useRef(false)
  const [clockLive, setClockLive] = useState(false)
  const [cues, setCues] = useState(null)
  const [cueText, setCueText] = useState('')
  const [subOffset, setSubOffset] = useState(0)
  const offsetRef = useRef(0)
  offsetRef.current = subOffset
  const [clockMissing, setClockMissing] = useState(false)
  const autoRef = useRef(autoNext)
  autoRef.current = autoNext
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext
  const onJumpRef = useRef(onJump)
  onJumpRef.current = onJump
  const epBaseRef = useRef(null) // first episode the embed reported
  const goNext = useCallback(() => { setCountdown(null); onNextRef.current?.() }, [])

  // Lock background scroll (html + body, so iOS doesn't rubber-band behind) + ESC.
  useEffect(() => {
    const html = document.documentElement
    const prev = [html.style.overflow, document.body.style.overflow]
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => {
      html.style.overflow = prev[0]
      document.body.style.overflow = prev[1]
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Anime: resolve the AniList id (unlocks Videasy / MegaPlay 2 / TMDB-mapped
  // sources). MAL-keyed sources work immediately, so this never blocks them.
  useEffect(() => {
    if (type !== 'anime') return
    if (anilistIdProp) { setAnilistId(anilistIdProp); setIdsReady(true); return }
    if (!malId) { setIdsReady(true); return }
    let on = true
    const giveUp = setTimeout(() => on && setIdsReady(true), 6000)
    anilistIdFromMal(malId).then((id) => {
      if (!on) return
      if (id) setAnilistId(id)
      setIdsReady(true)
    })
    return () => { on = false; clearTimeout(giveUp) }
  }, [type, malId, anilistIdProp])

  // Anime → TMDB season/episode mapping (ani.zip) for TMDB-keyed sources.
  useEffect(() => {
    if (type !== 'anime' || !anilistId) return
    let on = true
    animeTmdbInfo(anilistId, safeEpisode).then((m) => { if (on) setAnimeTmdb(m) })
    return () => { on = false }
  }, [type, anilistId, safeEpisode])

  const ctx = useMemo(() => ({
    type, tmdbId, imdbId, malId, anilistId, animeTmdb,
    season: safeSeason, episode: safeEpisode, title: displayTitle, audio,
  }), [type, tmdbId, imdbId, malId, anilistId, animeTmdb, safeSeason, safeEpisode, displayTitle, audio])

  const sources = useMemo(() => availableSources(ctx), [ctx])
  // Preferred source if it's available. While anime ids are still resolving we
  // wait for it instead of flashing a different source first.
  const active = sources.find((s) => s.source.id === sourceId) || (idsReady ? sources[0] : null)
  const activeId = active?.source.id
  // ── English subtitles (served by our /api/subs, which holds the Wyzie key) ──
  // What to look subtitles up by: TMDB id (+ season/episode). Anime uses the
  // ani.zip TMDB mapping the player already resolves.
  const subTarget = useMemo(() => {
    if (type === 'movie') return tmdbId || imdbId ? { id: tmdbId || imdbId } : null
    if (type === 'tv') return tmdbId ? { id: tmdbId, season: safeSeason, episode: safeEpisode } : null
    return animeTmdb?.id ? { id: animeTmdb.id, season: animeTmdb.season, episode: animeTmdb.episode } : null
  }, [type, tmdbId, imdbId, safeSeason, safeEpisode, animeTmdb])

  const subPath = useCallback((to, extra = {}) => {
    if (!subTarget) return null
    const p = new URLSearchParams({ id: String(subTarget.id), to })
    if (subTarget.season != null && subTarget.episode != null) {
      p.set('season', String(subTarget.season))
      p.set('episode', String(subTarget.episode))
    }
    Object.entries(extra).forEach(([k, v]) => p.set(k, String(v)))
    p.set('file', `en.${to}`) // URL ends in ".vtt"/".srt" for players that check
    return apiUrl(`/api/subs?${p}`)
  }, [subTarget])

  const baseEmbed = active?.target.kind === 'embed' ? active.target.url : ''
  // VidLink loads an external VTT via its documented sub_file option.
  const embedUrl = baseEmbed && activeId === 'vidlink' && subsOn && subTarget
    ? `${baseEmbed}${baseEmbed.includes('?') ? '&' : '?'}sub_file=${encodeURIComponent(absoluteUrl(subPath('vtt')))}&sub_label=English`
    : baseEmbed

  const toggleSubs = () => {
    setSubsOn((v) => {
      const nv = !v
      try { localStorage.setItem(subsPrefKey(type), nv ? '1' : '0') } catch { /* ignore */ }
      return nv
    })
  }

  // Download the .srt so it can be uploaded into any embed player's CC menu.
  const downloadSubs = async () => {
    if (!subTarget || subBusy) return
    setSubBusy(true)
    const name = type === 'movie' ? displayTitle : `${displayTitle} S${subTarget.season ?? safeSeason}E${subTarget.episode ?? safeEpisode}`
    try {
      const r = await fetch(subPath('srt', { dl: 1, name }))
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast(r.status === 404 ? 'No English subtitles found for this one' : (d.error || 'Subtitles unavailable right now'))
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/[^\w .()-]+/g, '').trim() || 'subtitles'}.en.srt`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast('Subtitle file downloaded')
    } catch {
      toast('Subtitles unavailable right now')
    } finally {
      setSubBusy(false)
    }
  }

  // ── Subtitle overlay for embeds ───────────────────────────────────────────
  // VidLink takes the file natively and AllManga uses a <track>; every other
  // embed gets our own subtitle layer on top, timed by the playback clock the
  // player posts to the page (VidLink / MegaPlay / Videasy all do).
  const overlayMode = !!(subsOn && subTarget && active?.target.kind === 'embed' && activeId !== 'vidlink')
  const vttPath = subTarget ? subPath('vtt') : null

  // New source / episode → forget the old clock.
  useEffect(() => {
    epBaseRef.current = null
    clockRef.current = { t: null, at: 0, playing: false }
    clockLiveRef.current = false
    setClockLive(false)
    setClockMissing(false)
    setCueText('')
  }, [embedUrl])

  // Fetch + parse the English VTT when the overlay is needed.
  useEffect(() => {
    if (!overlayMode || !vttPath) { setCues(null); return }
    let on = true
    setCues(null)
    fetch(vttPath)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((txt) => { if (on) setCues(parseVtt(txt)) })
      .catch(() => { if (on) setCues([]) })
    return () => { on = false }
  }, [overlayMode, vttPath])

  // Frame loop: estimate the current time between player updates and show the
  // matching line. Only re-renders when the visible text actually changes.
  useEffect(() => {
    if (!overlayMode || !cues?.length) { setCueText(''); return }
    let raf = 0
    let last = ''
    const tick = () => {
      const c = clockRef.current
      let text = ''
      if (c.t != null) {
        const drift = c.playing ? Math.min((performance.now() - c.at) / 1000, 6) : 0
        text = cueAt(cues, c.t + drift - offsetRef.current)
      }
      if (text !== last) { last = text; setCueText(text) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [overlayMode, cues])

  // If a player never reports its time, say so instead of showing nothing.
  useEffect(() => {
    if (!overlayMode || clockLive || loading) return
    const t = setTimeout(() => setClockMissing(true), 9000)
    return () => clearTimeout(t)
  }, [overlayMode, clockLive, loading, embedUrl])

  const nudgeSubs = (d) => setSubOffset((o) => Math.round((o + d) * 10) / 10)

  // Fullscreen the frame itself so our subtitle layer stays visible (an embed's
  // own fullscreen button only enlarges the embed, hiding the overlay).
  const goFullscreen = () => {
    const el = frameRef.current
    if (!el) return
    const req = el.requestFullscreen || el.webkitRequestFullscreen
    if (req) {
      try { req.call(el)?.catch?.(() => {}) } catch { /* ignore */ }
    }
    else toast('Turn your phone sideways for a bigger picture')
  }

  // Automatic advance (no wrap) — used when a direct stream fails.
  const advanceSource = useCallback(() => {
    const idx = sources.findIndex((s) => s.source.id === activeId)
    const next = sources[idx + 1]
    if (next) { setSourceId(next.source.id); return true }
    return false
  }, [sources, activeId])

  // User actions — remembered, so the source that works sticks next time.
  const pickSource = (id) => { setSourceId(id); setPreferredSource(type, id) }
  const tryAnother = () => {
    if (sources.length < 2) return
    const idx = sources.findIndex((s) => s.source.id === activeId)
    pickSource(sources[(idx + 1) % sources.length].source.id)
  }

  const progressKey = `vp:${type}:${malId || tmdbId || imdbId}:s${safeSeason}:e${safeEpisode}:${audio}`

  // New episode / new source → reset end-of-episode state.
  useEffect(() => { endedRef.current = false; setCountdown(null) }, [safeEpisode, safeSeason, activeId])

  // Resolve / load the active source.
  useEffect(() => {
    let cancelled = false
    setError('')
    setStreams([])
    setStreamIdx(0)

    if (!active) {
      if (idsReady) { setError('No source is available for this title yet.'); setLoading(false) }
      else setLoading(true)
      return
    }

    setLoading(true)
    if (active.target.kind === 'resolve') {
      allmangaResolve({ title: displayTitle, alt: altTitles, episode: safeEpisode, translationType: audio })
        .then((res) => {
          if (cancelled) return
          if (!res?.ok || !res.streams?.length) {
            if (!advanceSource()) { setError('This source has nothing for this episode.'); setLoading(false) }
            return
          }
          setStreams(res.streams)
          setLoading(false)
        })
        .catch(() => { if (!cancelled && !advanceSource()) { setError('Source failed.'); setLoading(false) } })
    }
    // Embeds clear the loader via iframe onLoad / player messages.
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, embedUrl, displayTitle, safeEpisode, audio, idsReady])

  // Watchdog: never spin forever.
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 9000)
    return () => clearTimeout(t)
  }, [loading, activeId])

  // ── Auto-next ─────────────────────────────────────────────────────────────
  const handleEnded = useCallback(() => {
    if (endedRef.current) return
    endedRef.current = true
    if (canNext && autoRef.current) setCountdown(COUNTDOWN)
  }, [canNext])

  useEffect(() => {
    if (countdown == null) return
    if (countdown <= 0) { goNext(); return }
    const t = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
  }, [countdown, goNext])

  const toggleAuto = () => {
    setAutoNext((v) => {
      const nv = !v
      try { localStorage.setItem(AUTO_KEY, nv ? '1' : '0') } catch { /* ignore */ }
      if (!nv) setCountdown(null)
      return nv
    })
  }

  // Embed players report progress/end via postMessage.
  useEffect(() => {
    const onMsg = (e) => {
      if (!fromFrame(e.source, iframeRef.current)) return
      const m = parsePlayerMessage(e.data)
      if (!m) return
      setLoading(false) // it's alive and talking

      // The embed's OWN next/previous-episode button: it switches episodes
      // inside the iframe and the site never knows. Players report the
      // episode they're on, so we notice the change and hand it to the page
      // (which marks it watched, saves progress and reloads properly).
      if (m.episode != null && type !== 'movie') {
        const base = epBaseRef.current
        if (!base) {
          epBaseRef.current = { episode: m.episode, season: m.season }
        } else if (m.episode !== base.episode || (m.season != null && base.season != null && m.season !== base.season)) {
          epBaseRef.current = { episode: m.episode, season: m.season }
          let ep
          let se = safeSeason
          if (type === 'tv') {
            // TV numbering is the same as ours (TMDB) — use it directly.
            ep = m.episode
            se = m.season || safeSeason
          } else {
            // Anime players may number differently, so move by the same
            // amount the player moved.
            ep = safeEpisode + (m.episode - base.episode)
          }
          if (ep >= 1 && (ep !== safeEpisode || se !== safeSeason)) {
            const jump = onJumpRef.current
            if (jump) jump(ep, se)
            else if (ep === safeEpisode + 1) onNextRef.current?.()
            return
          }
        }
      }

      // Keep the overlay clock in step with the embedded player.
      const c = clockRef.current
      if (m.current != null) {
        clockRef.current = { t: m.current, at: performance.now(), playing: m.ev !== 'pause' && !m.ended }
        if (!clockLiveRef.current) { clockLiveRef.current = true; setClockLive(true) }
      } else if (m.ev === 'pause' || m.ended) {
        if (c.t != null && c.playing) c.t += (performance.now() - c.at) / 1000
        c.playing = false
      } else if (m.ev === 'play' || m.ev === 'playing') {
        c.at = performance.now()
        c.playing = true
      }

      if (m.ended || (m.pct != null && m.pct >= 98.5 && (m.duration == null || m.duration > 90))) handleEnded()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [handleEnded, type, safeEpisode, safeSeason])

  const currentStream = streams[streamIdx] || null

  // HLS / direct video playback for resolve sources.
  useEffect(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    const video = videoRef.current
    if (!video || !currentStream) return

    const url = currentStream.url
    const isHls = currentStream.type === 'hls' || url.includes('.m3u8')
    let dead = false

    const failStream = () => {
      if (dead) return
      dead = true
      if (streamIdx + 1 < streams.length) { setStreamIdx(streamIdx + 1); return }
      if (!advanceSource()) setError('Stream failed. Try another source.')
    }

    const restore = () => {
      const saved = Number(sessionStorage.getItem(progressKey) || '0')
      if (saved > 0) { try { video.currentTime = saved } catch { /* ignore */ } }
    }
    const save = () => { if (Number.isFinite(video.currentTime)) sessionStorage.setItem(progressKey, String(video.currentTime)) }
    const onEnd = () => { sessionStorage.removeItem(progressKey); handleEnded() }
    const onVideoError = () => { if (video.src && !isHls) failStream() }

    video.addEventListener('loadedmetadata', restore)
    video.addEventListener('timeupdate', save)
    video.addEventListener('ended', onEnd)
    video.addEventListener('error', onVideoError)

    if (isHls && Hls.isSupported()) {
      let retried = false
      const hls = new Hls()
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data?.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !retried) { retried = true; hls.startLoad(); return }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !retried) { retried = true; hls.recoverMediaError(); return }
        hls.destroy()
        if (hlsRef.current === hls) hlsRef.current = null
        failStream()
      })
    } else {
      video.src = url // Safari native HLS or plain mp4
    }
    video.play?.().catch(() => {})

    return () => {
      dead = true
      save()
      video.removeEventListener('loadedmetadata', restore)
      video.removeEventListener('timeupdate', save)
      video.removeEventListener('ended', onEnd)
      video.removeEventListener('error', onVideoError)
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStream, progressKey])

  const nowLabel = type === 'movie' ? 'Movie' : type === 'tv' ? `S${safeSeason} · E${safeEpisode}` : `Episode ${safeEpisode}`
  const nextLabel = type === 'tv' ? `S${safeSeason} · E${safeEpisode + 1}` : `Episode ${safeEpisode + 1}`

  return (
    <div className="modal player-modal" onClick={onClose}>
      <div className="modal-card player-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Now Playing · {nowLabel}</div>
            <div className="ttl">{displayTitle}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon.close width="18" height="18" /></button>
        </div>

        <div className="player-frame" ref={frameRef}>
          {(loading || !active) && !error && (
            <div className="player-loading"><span className="spinner" /> {active ? `Loading ${active.source.label}…` : 'Preparing player…'}</div>
          )}

          {error ? (
            <div className="player-loading player-error">
              <span>{error}</span>
              {sources.length > 1 && <button className="btn btn-primary btn-sm" onClick={tryAnother}>Try another source</button>}
            </div>
          ) : active?.target.kind === 'resolve' ? (
            <video ref={videoRef} controls autoPlay playsInline>
              {subsOn && subTarget && (
                <track key={subPath('vtt')} kind="subtitles" srcLang="en" label="English" src={subPath('vtt')} default />
              )}
            </video>
          ) : embedUrl ? (
            <iframe
              ref={iframeRef}
              key={embedUrl}
              src={embedUrl}
              title={displayTitle}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="origin"
              onLoad={() => setLoading(false)}
            />
          ) : null}

          {overlayMode && cueText && (
            <div className="sub-overlay" aria-live="off"><span>{cueText}</span></div>
          )}

          {countdown != null && (
            <div className="next-overlay">
              <div className="next-card">
                <div className="next-eyebrow">Up next</div>
                <div className="next-title">{nextLabel}</div>
                <div className="next-count">Starting in {countdown}s</div>
                <div className="next-actions">
                  <button className="btn btn-primary btn-sm" onClick={goNext}>
                    <Icon.play width="13" height="13" /> Play now
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCountdown(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-body pc">
          {/* 1. The one main action */}
          {canNext && (
            <button className="btn btn-primary pc-next" onClick={goNext}>
              Next episode <Icon.play width="14" height="14" />
            </button>
          )}

          {/* 2. Settings — one per row, control on the right */}
          <div className="pc-list">
            {type === 'anime' && (
              <div className="pc-row">
                <span className="pc-k">Audio</span>
                <div className="seg">
                  {['sub', 'dub'].map((t) => (
                    <button key={t} className={'seg-btn' + (audio === t ? ' on' : '')} onClick={() => setAudio(t)}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pc-row pc-source">
              <span className="pc-k">Source</span>
              <select className="select-min" value={activeId || ''} onChange={(e) => pickSource(e.target.value)} disabled={!sources.length} aria-label="Source">
                {sources.map(({ source }) => (
                  <option key={source.id} value={source.id}>{source.label}</option>
                ))}
              </select>
              {sources.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm pc-try" onClick={tryAnother} title="Not playing? Switch to the next source">
                  <Icon.refresh width="14" height="14" /> Try another source
                </button>
              )}
            </div>

            {currentStream && streams.length > 1 && (
              <div className="pc-row">
                <span className="pc-k">Server</span>
                <select className="select-min" value={streamIdx} onChange={(e) => setStreamIdx(Number(e.target.value))} aria-label="Server">
                  {streams.map((s, i) => (
                    <option key={i} value={i}>{s.sourceName || 'Server'} · {s.quality || 'auto'}</option>
                  ))}
                </select>
              </div>
            )}

            {canNext && (
              <button type="button" className={'pc-row pc-toggle' + (autoNext ? ' on' : '')} onClick={toggleAuto} aria-pressed={autoNext}>
                <span className="pc-k">Auto-play next episode</span>
                <span className="switch-track"><span className="switch-thumb" /></span>
              </button>
            )}

            {subTarget && (
              <button type="button" className={'pc-row pc-toggle' + (subsOn ? ' on' : '')} onClick={toggleSubs} aria-pressed={subsOn}>
                <span className="pc-k">English subtitles</span>
                <span className="switch-track"><span className="switch-thumb" /></span>
              </button>
            )}

            {overlayMode && clockLive && (
              <div className="pc-row pc-row-tall">
                <span className="pc-k">
                  Subtitle timing
                  <small>Late? tap −&nbsp;&nbsp;·&nbsp;&nbsp;Early? tap +</small>
                </span>
                <div className="pc-v" role="group" aria-label="Subtitle timing">
                  <button type="button" className="icon-btn pc-icon" onClick={() => nudgeSubs(-0.5)} aria-label="Show subtitles sooner">−</button>
                  <button
                    type="button"
                    className="pc-offset"
                    onClick={() => setSubOffset(0)}
                    disabled={subOffset === 0}
                    title={subOffset === 0 ? '' : 'Tap to reset'}
                    aria-live="polite"
                  >
                    {subOffset === 0 ? 'In sync' : `${subOffset > 0 ? '+' : ''}${subOffset.toFixed(1)}s`}
                  </button>
                  <button type="button" className="icon-btn pc-icon" onClick={() => nudgeSubs(0.5)} aria-label="Show subtitles later">+</button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Only when something needs explaining */}
          {overlayMode && cues && cues.length === 0 && (
            <p className="pc-hint">No English subtitles found for this one.</p>
          )}
          {overlayMode && clockMissing && !(cues && cues.length === 0) && (
            <p className="pc-hint">This player hides its timing, so subtitles can’t follow it. Try another source, or use <strong>Subtitle file</strong> and upload it in the player’s CC menu.</p>
          )}

          {/* 4. Extras */}
          <div className="pc-more">
            {isNative && offId && (
              <button type="button" className={'pc-link' + (offState === 'saved' ? ' on' : '')} onClick={saveOffline} disabled={offState !== 'idle'}>
                <Icon.download width="14" height="14" />
                {offState === 'saved' ? 'Saved offline' : offState === 'saving' ? 'Downloading…' : 'Save offline'}
              </button>
            )}
            {overlayMode && clockLive && (
              <button type="button" className="pc-link" onClick={goFullscreen} title="Keeps the subtitles on screen (the player's own fullscreen hides them)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
                Fullscreen
              </button>
            )}
            {subTarget && (
              <button type="button" className="pc-link" onClick={downloadSubs} disabled={subBusy}>
                <Icon.download width="14" height="14" /> {subBusy ? 'Finding…' : 'Subtitle file'}
              </button>
            )}
            <button type="button" className={'pc-link' + (showDl ? ' on' : '')} onClick={() => setShowDl((v) => !v)} aria-expanded={showDl}>
              <Icon.download width="14" height="14" /> Download episode
            </button>
          </div>
          {showDl && <DownloadLinks title={displayTitle} />}
        </div>
      </div>
    </div>
  )
}
