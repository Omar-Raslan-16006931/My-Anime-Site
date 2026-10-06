import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import Icon from './Icons'
import { availableSources, getPreferredSource, setPreferredSource } from '../lib/sources'
import { allmangaResolve } from '../lib/allmanga'
import { anilistIdFromMal, animeTmdbInfo } from '../lib/anilist'
import DownloadLinks from './DownloadLinks'

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
  return { ended, pct: Number.isFinite(pct) ? pct : null, duration: Number.isFinite(duration) ? duration : null }
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

  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const iframeRef = useRef(null)
  const endedRef = useRef(false)
  const autoRef = useRef(autoNext)
  autoRef.current = autoNext
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext
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
  const embedUrl = active?.target.kind === 'embed' ? active.target.url : ''

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
      allmangaResolve({ title: displayTitle, episode: safeEpisode, translationType: audio })
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
      if (m.ended || (m.pct != null && m.pct >= 98.5 && (m.duration == null || m.duration > 90))) handleEnded()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [handleEnded])

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

        <div className="player-frame">
          {(loading || !active) && !error && (
            <div className="player-loading"><span className="spinner" /> {active ? `Loading ${active.source.label}…` : 'Preparing player…'}</div>
          )}

          {error ? (
            <div className="player-loading player-error">
              <span>{error}</span>
              {sources.length > 1 && <button className="btn btn-primary btn-sm" onClick={tryAnother}>Try another source</button>}
            </div>
          ) : active?.target.kind === 'resolve' ? (
            <video ref={videoRef} controls autoPlay playsInline />
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

        <div className="modal-body">
          <div className="player-bar">
            {type === 'anime' && (
              <div className="seg">
                {['sub', 'dub'].map((t) => (
                  <button key={t} className={'seg-btn' + (audio === t ? ' on' : '')} onClick={() => setAudio(t)}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            <label className="src-pick">
              <span className="src-label">Sources</span>
              <select className="select-min" value={activeId || ''} onChange={(e) => pickSource(e.target.value)} disabled={!sources.length}>
                {sources.map(({ source }) => (
                  <option key={source.id} value={source.id}>
                    {source.label}{source.badge ? ` · ${source.badge}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {currentStream && streams.length > 1 && (
              <select className="select-min" value={streamIdx} onChange={(e) => setStreamIdx(Number(e.target.value))}>
                {streams.map((s, i) => (
                  <option key={i} value={i}>{s.sourceName || 'Server'} · {s.quality || 'auto'}</option>
                ))}
              </select>
            )}

            {sources.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={tryAnother} title="Switch to the next source">
                <Icon.refresh width="14" height="14" /> Try another
              </button>
            )}

            <div className="grow" />

            {canNext && (
              <button type="button" className={'switch' + (autoNext ? ' on' : '')} onClick={toggleAuto} aria-pressed={autoNext}>
                <span className="switch-track"><span className="switch-thumb" /></span>
                Auto-next
              </button>
            )}

            {canNext && (
              <button className="btn btn-primary btn-sm" onClick={goNext} aria-label="Next episode">
                Next Ep <Icon.play width="13" height="13" />
              </button>
            )}
          </div>

          <div className="player-note">
            <Icon.info width="14" height="14" />
            <span>Not playing? Tap <strong>Try another</strong>. Whichever one works is remembered.</span>
          </div>

          <DownloadLinks title={displayTitle} />
        </div>
      </div>
    </div>
  )
}
