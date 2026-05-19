import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import DownloadButton from './DownloadButton'
import { QUALITY_OPTIONS, resolvePlayableSource } from '/utils/videoSources'

export default function VideoPlayer({
  mediaType = 'anime',
  malId,
  tmdbId,
  imdbId,
  anilistId,
  title,
  episode,
  season = 1,
  movieTitle,
  downloadUrl,
  onClose
}) {
  const [src, setSrc] = useState(() => (mediaType === 'anime' ? 'dropfile' : 'vidsrc'))
  const [dub, setDub] = useState(false)
  const [quality, setQuality] = useState('auto')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolvedSource, setResolvedSource] = useState(null)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  function getAnimeSeasonFromTitle(t = '') {
    if (!t) return null
    const str = String(t).toLowerCase()
    const sMatch = str.match(/season\s+(\d+)/)
    if (sMatch) return parseInt(sMatch[1], 10)
    const cMatch = str.match(/cour\s+(\d+)/)
    if (cMatch) return parseInt(cMatch[1], 10)
    return null
  }

  const inferredSeason = mediaType === 'anime' ? getAnimeSeasonFromTitle(title || movieTitle) : null
  const safeEpisode = Number(episode) || 1
  const defaultSeason = Number(season) || 1
  const safeSeason = inferredSeason && defaultSeason === 1 ? inferredSeason : defaultSeason
  const displayTitle = movieTitle || title
  const audio = dub ? 'dub' : 'sub'

  useEffect(() => {
    setSrc(mediaType === 'anime' ? 'dropfile' : 'vidsrc')
  }, [mediaType])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow
    const bodyOverflow = document.body.style.overflow

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.overflow = htmlOverflow
      document.body.style.overflow = bodyOverflow
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false

    const loadSource = async () => {
      setLoading(true)
      setError('')
      setResolvedSource(null)

      try {
        const source = await resolvePlayableSource({
          mediaType: mediaType === 'anime' ? 'tv' : mediaType,
          isAnime: mediaType === 'anime',
          imdbId,
          tmdbId,
          malId,
          anilistId,
          season: safeSeason,
          episode: safeEpisode,
          audio,
          lang: 'en',
          quality,
          preferredProvider: src,
          title: displayTitle
        })

        if (cancelled) return

        if (!source) {
          setError('No playable source found.')
          setLoading(false)
          return
        }

        setResolvedSource(source)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Failed to load player source.')
          setLoading(false)
        }
      }
    }

    loadSource()

    return () => {
      cancelled = true
    }
  }, [mediaType, imdbId, tmdbId, malId, anilistId, safeSeason, safeEpisode, src, audio, quality, displayTitle])

  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const video = videoRef.current
    if (!video || !resolvedSource || resolvedSource.type !== 'hls') return

    const hlsUrl = resolvedSource.finalUrl || resolvedSource.url
    if (!hlsUrl) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls()
      hlsRef.current = hls
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          setError('Failed to load HLS stream.')
          hls.destroy()
          hlsRef.current = null
        }
      })
    } else {
      setError('This browser does not support HLS playback here.')
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [resolvedSource])

  const playerUrl = useMemo(() => {
    if (!resolvedSource) return ''
    return resolvedSource.finalUrl || resolvedSource.iframeUrl || resolvedSource.url || ''
  }, [resolvedSource])

  const frameKey = useMemo(() => {
    return [
      mediaType,
      src,
      dub ? 'dub' : 'sub',
      quality,
      tmdbId || 'no-tmdb',
      imdbId || 'no-imdb',
      malId || 'no-mal',
      anilistId || 'no-anilist',
      safeSeason,
      safeEpisode,
      playerUrl
    ].join(':')
  }, [mediaType, src, dub, quality, tmdbId, imdbId, malId, anilistId, safeSeason, safeEpisode, playerUrl])

  const nowPlayingLabel =
    mediaType === 'movie'
      ? 'Movie'
      : mediaType === 'tv'
        ? `S${safeSeason} • E${safeEpisode}`
        : safeSeason && safeSeason > 1
          ? `S${safeSeason} • E${safeEpisode}`
          : `Episode ${safeEpisode}`

  const sourceOptions =
    mediaType === 'anime'
      ? [
          { value: 'dropfile', label: 'dropfile.cc' },
          { value: 'vidsrc', label: 'vidsrc.to' }
        ]
      : [{ value: 'vidsrc', label: 'vidsrc.to' }]

  const openExternalPlayer = () => {
    if (!playerUrl) return
    window.open(playerUrl, '_blank', 'noopener,noreferrer')
  }

  const useExternalMobilePlayer = isMobile && (mediaType === 'tv' || mediaType === 'movie')
  const openExternally = resolvedSource?.provider === 'vidsrc' && useExternalMobilePlayer
  const supportsQuality = src === 'dropfile' || src === 'vidsrc'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '12px 12px 20px' : 24,
        overflowY: 'auto'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: isMobile ? 14 : 'var(--radius)',
          width: '100%',
          maxWidth: openExternally ? 520 : 1100,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
        }}
      >
        <div
          style={{
            padding: isMobile ? '14px 14px 12px' : '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text2)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 2
              }}
            >
              Now Selected
            </div>

            <div style={{ fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>
              {nowPlayingLabel}
            </div>

            <div
              style={{
                fontSize: 13,
                color: 'var(--text2)',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {displayTitle}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg3)',
              color: 'var(--text2)',
              width: 34,
              height: 34,
              borderRadius: '50%',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              flexShrink: 0
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: isMobile ? '14px' : '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          {mediaType === 'anime' && (
            <div
              style={{
                display: 'flex',
                background: 'var(--bg3)',
                borderRadius: 999,
                padding: 3,
                gap: 3,
                width: 'fit-content'
              }}
            >
              {['SUB', 'DUB'].map((t, i) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDub(i === 1)
                    setLoading(true)
                  }}
                  style={{
                    padding: '4px 16px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    background: dub === (i === 1) ? 'var(--accent)' : 'transparent',
                    color: dub === (i === 1) ? '#fff' : 'var(--text2)',
                    transition: 'all 0.2s'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <select
                value={src}
                onChange={(e) => {
                  setLoading(true)
                  setSrc(e.target.value)
                }}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {supportsQuality && (
                <select
                  value={quality}
                  onChange={(e) => {
                    setLoading(true)
                    setQuality(e.target.value)
                  }}
                  style={{
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {QUALITY_OPTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}

              <DownloadButton url={downloadUrl} label="Download" isMobile={isMobile} />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {mediaType === 'anime'
                ? 'Anime may use provider-specific season mapping'
                : useExternalMobilePlayer
                  ? 'Mobile opens external player'
                  : 'Player source'}
            </div>
          </div>

          {openExternally ? (
            <div
              style={{
                background: 'var(--bg3)',
                borderRadius: 10,
                border: '1px solid var(--border)',
                padding: '18px 16px'
              }}
            >
              <button
                type="button"
                onClick={openExternalPlayer}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '14px',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  boxShadow: '0 4px 20px rgba(225,29,72,0.35)',
                  transition: 'background 0.2s, transform 0.2s'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Watch Now
              </button>
            </div>
          ) : error ? (
            <div
              style={{
                background: '#000',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                minHeight: 240,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                color: 'var(--text2)',
                textAlign: 'center'
              }}
            >
              {error}
            </div>
          ) : !playerUrl ? (
            <div
              style={{
                background: '#000',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                minHeight: 240,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
                color: 'var(--text2)'
              }}
            >
              Missing player data.
            </div>
          ) : resolvedSource?.type === 'hls' ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: isMobile ? '16 / 10' : '16 / 9',
                minHeight: isMobile ? 240 : undefined,
                background: '#000',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--border)'
              }}
            >
              {loading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text2)',
                    fontSize: 14,
                    background: 'rgba(0,0,0,0.35)',
                    zIndex: 1
                  }}
                >
                  Loading player...
                </div>
              )}

              <video
                ref={videoRef}
                controls
                autoPlay
                playsInline
                disableremoteplayback
                width="100%"
                height="100%"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  background: '#000'
                }}
              />
            </div>
          ) : (
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: isMobile ? '16 / 10' : '16 / 9',
                minHeight: isMobile ? 240 : undefined,
                background: '#000',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--border)'
              }}
            >
              {loading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text2)',
                    fontSize: 14,
                    background: 'rgba(0,0,0,0.35)',
                    zIndex: 1
                  }}
                >
                  Loading player...
                </div>
              )}

              <iframe
                key={frameKey}
                src={playerUrl}
                title={`${displayTitle} ${nowPlayingLabel}`}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="origin"
                onLoad={() => setLoading(false)}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  background: '#000'
                }}
              />
            </div>
          )}

          <div
            style={{
              fontSize: 12,
              color: 'var(--text2)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'var(--bg3)',
              borderRadius: 6
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            {openExternally
              ? 'Opens in a new tab for sources that work better outside iframes.'
              : resolvedSource?.type === 'hls'
                ? 'Using direct HLS playback when available.'
                : 'Anime providers may split seasons into separate entries, so source behavior can differ by title.'}
          </div>
        </div>
      </div>
    </div>
  )
}