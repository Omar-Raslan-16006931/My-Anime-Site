import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import Icon from './Icons'
import { availableSources, DEFAULT_SOURCE } from '../lib/sources'
import { allmangaResolve } from '../lib/allmanga'
import { anilistIdFromMal, animeTmdbInfo } from '../lib/anilist'
import DownloadLinks from './DownloadLinks'

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
  const type = mediaType === 'anime' ? 'anime' : mediaType
  const displayTitle = movieTitle || title
  const [audio, setAudio] = useState('sub')
  const [sourceId, setSourceId] = useState(DEFAULT_SOURCE[type] || 'videasy')
  const [anilistId, setAnilistId] = useState(anilistIdProp || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [streams, setStreams] = useState([])      // for resolve sources
  const [streamIdx, setStreamIdx] = useState(0)

  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const iframeRef = useRef(null)

  const safeEpisode = Number(episode) || 1
  const safeSeason = Number(season) || 1

  // Lock background scroll + ESC to close.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  // Resolve AniList id for anime embeds that need it.
  useEffect(() => {
    if (type === 'anime' && !anilistId && malId) {
      anilistIdFromMal(malId).then((id) => id && setAnilistId(id))
    }
  }, [type, malId, anilistId])

  // Map anime → TMDB id + real season/episode (ani.zip) so every TV source
  // also works for anime with correct season numbering.
  const [animeTmdb, setAnimeTmdb] = useState(null)
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
  const active = sources.find((s) => s.source.id === sourceId) || sources[0]
  const activeId = active?.source.id

  const progressKey = useMemo(
    () => `vp:${type}:${malId || tmdbId || imdbId}:s${safeSeason}:e${safeEpisode}:${audio}`,
    [type, malId, tmdbId, imdbId, safeSeason, safeEpisode, audio]
  )

  // Auto-advance to the next source when the current one can't deliver.
  const advanceSource = () => {
    const idx = sources.findIndex((s) => s.source.id === activeId)
    const next = sources[idx + 1]
    if (next) { setSourceId(next.source.id); return true }
    return false
  }

  // Resolve the active source.
  useEffect(() => {
    let cancelled = false
    setError('')
    setStreams([])
    setStreamIdx(0)

    if (!active) { setError('No source available for this title.'); setLoading(false); return }

    if (active.target.kind === 'resolve') {
      setLoading(true)
      allmangaResolve({ title: displayTitle, episode: safeEpisode, translationType: audio })
        .then((res) => {
          if (cancelled) return
          if (!res?.ok || !res.streams?.length) {
            // AllManga miss → fall back to the next source automatically.
            if (!advanceSource()) { setError('No working source found. Try a different one.'); setLoading(false) }
            return
          }
          setStreams(res.streams)
          setLoading(false)
        })
        .catch(() => { if (!cancelled && !advanceSource()) { setError('Source failed. Try another.'); setLoading(false) } })
    } else {
      setLoading(true) // iframe onLoad clears it
    }

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, displayTitle, safeEpisode, audio, active])

  // Watchdog: never spin forever — clear the loader after a grace period so the
  // user can read the source list and switch manually.
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 12000)
    return () => clearTimeout(t)
  }, [loading, activeId])

  const currentStream = streams[streamIdx] || null

  // HLS / direct video playback for resolve sources.
  useEffect(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    const video = videoRef.current
    if (!video || !currentStream) return

    const url = currentStream.url
    const isHls = currentStream.type === 'hls' || url.includes('.m3u8')
    let dead = false

    // A broken stream tries the next server, then the next source, before erroring.
    const failStream = () => {
      if (dead) return
      dead = true
      if (streamIdx + 1 < streams.length) { setStreamIdx(streamIdx + 1); return }
      if (!advanceSource()) setError('Stream failed — try another server or source.')
    }

    const restore = () => {
      const saved = Number(sessionStorage.getItem(progressKey) || '0')
      if (saved > 0) { try { video.currentTime = saved } catch { /* ignore */ } }
    }
    const save = () => { if (Number.isFinite(video.currentTime)) sessionStorage.setItem(progressKey, String(video.currentTime)) }
    const clear = () => sessionStorage.removeItem(progressKey)
    const onVideoError = () => { if (video.src && !isHls) failStream() }

    video.addEventListener('loadedmetadata', restore)
    video.addEventListener('timeupdate', save)
    video.addEventListener('ended', clear)
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
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url // Safari native HLS
    } else {
      video.src = url
    }
    video.play?.().catch(() => {})

    return () => {
      dead = true
      save()
      video.removeEventListener('loadedmetadata', restore)
      video.removeEventListener('timeupdate', save)
      video.removeEventListener('ended', clear)
      video.removeEventListener('error', onVideoError)
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStream, progressKey])

  const embedUrl = active?.target.kind === 'embed' ? active.target.url : ''
  const nowLabel =
    type === 'movie' ? 'Movie'
      : type === 'tv' ? `S${safeSeason} · E${safeEpisode}`
        : `Episode ${safeEpisode}`

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Now Playing</div>
            <div className="ttl">{nowLabel}</div>
            <div className="sub">{displayTitle}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon.close width="18" height="18" /></button>
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

            <select className="select-min" value={activeId || ''} onChange={(e) => setSourceId(e.target.value)}>
              {sources.map(({ source }) => (
                <option key={source.id} value={source.id}>
                  {source.label}{source.badge ? ` · ${source.badge}` : ''}
                </option>
              ))}
            </select>

            {currentStream && streams.length > 1 && (
              <select className="select-min" value={streamIdx} onChange={(e) => setStreamIdx(Number(e.target.value))}>
                {streams.map((s, i) => (
                  <option key={i} value={i}>{s.sourceName || 'Server'} · {s.quality || 'auto'}</option>
                ))}
              </select>
            )}

            <div className="grow" />

            {onNext && hasNext && type !== 'movie' && (
              <button className="btn btn-primary btn-sm" onClick={onNext} aria-label="Next episode">
                Next Ep <Icon.play width="13" height="13" />
              </button>
            )}

            {(currentStream?.url || embedUrl) && (
              <a className="icon-btn" href={currentStream?.url || embedUrl} target="_blank" rel="noopener noreferrer" aria-label="Open externally">
                <Icon.external width="17" height="17" />
              </a>
            )}
          </div>

          <div className="player-frame">
            {loading && (
              <div className="player-loading"><span className="spinner" /> Loading {active?.source.label || 'player'}…</div>
            )}

            {error ? (
              <div className="player-loading" style={{ flexDirection: 'column', textAlign: 'center', padding: 20 }}>
                <span>{error}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Pick another source from the dropdown above.</span>
              </div>
            ) : active?.target.kind === 'resolve' ? (
              <video ref={videoRef} controls autoPlay playsInline />
            ) : (
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
            )}
          </div>

          <div className="player-note">
            <Icon.info width="14" height="14" />
            {active?.target.kind === 'resolve'
              ? 'Direct stream via AllManga. If it stalls, switch server or source.'
              : 'Embedded provider. Use an ad-blocker; pop-ups come from the provider, not this site.'}
          </div>

          <div style={{ padding: '10px 0 4px' }}>
            <DownloadLinks title={displayTitle} />
          </div>
        </div>
      </div>
    </div>
  )
}
