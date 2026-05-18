import { useEffect, useMemo, useState } from 'react'

export default function VideoPlayer({
  mediaType = 'anime',
  malId,
  tmdbId,
  title,
  episode,
  season = 1,
  movieTitle,
  onClose
}) {
  const getDefaultSource = (type) => (type === 'anime' ? 'dropfile' : 'vidsrc')

  const [src, setSrc] = useState(() => getDefaultSource(mediaType))
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  useEffect(() => {
    setSrc(getDefaultSource(mediaType))
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
    const onKeyDown = e => {
      if (e.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
  }, [mediaType, malId, tmdbId, season, episode, src])

  const playerUrl = useMemo(() => {
    if (mediaType === 'movie') {
      return `https://vidsrc.to/embed/movie/${tmdbId}`
    }

    if (mediaType === 'tv') {
      return `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
    }

    switch (src) {
      case 'vidsrc':
        return `https://vidsrc.to/embed/anime/${malId}/${episode}`
      case 'dropfile':
      default:
        return `https://dropfile.cc/player/tv/mal-${malId}/1/${episode}?audio=sub&lang=en`
    }
  }, [mediaType, src, tmdbId, season, episode, malId])

  const nowPlayingLabel =
    mediaType === 'movie'
      ? 'Movie'
      : mediaType === 'tv'
        ? `S${season} • E${episode}`
        : `Episode ${episode}`

  const displayTitle = movieTitle || title

  const sourceOptions =
    mediaType === 'anime'
      ? [
          { value: 'dropfile', label: 'dropfile.cc' },
          { value: 'vidsrc', label: 'vidsrc.to' }
        ]
      : [{ value: 'vidsrc', label: 'vidsrc.to' }]

  const useExternalMobilePlayer = isMobile && (mediaType === 'tv' || mediaType === 'movie')

  const openExternalPlayer = () => {
    window.open(playerUrl, '_blank', 'noopener,noreferrer')
  }

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
        padding: isMobile ? '12px 12px 20px' : 12,
        overflowY: 'auto'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: isMobile ? 14 : 'var(--radius)',
          width: '100%',
          maxWidth: 1100,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          marginTop: isMobile ? 0 : undefined
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
              Now Playing
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
              width: 36,
              height: 36,
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
            padding: isMobile ? 12 : 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <select
              value={src}
              onChange={e => {
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
              {sourceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {mediaType === 'anime'
                ? 'Anime defaults to dropfile'
                : useExternalMobilePlayer
                  ? 'Mobile opens external player'
                  : 'Player source'}
            </div>
          </div>

          {useExternalMobilePlayer ? (
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
                padding: 20
              }}
            >
              <div style={{ textAlign: 'center', maxWidth: 420 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    marginBottom: 10,
                    color: 'var(--text)'
                  }}
                >
                  Open player in a new tab
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text2)',
                    lineHeight: 1.7,
                    marginBottom: 16
                  }}
                >
                  TV and movie providers can fail inside mobile iframes. Opening the stream
                  directly is more stable on phone view.
                </div>

                <button
                  type="button"
                  onClick={openExternalPlayer}
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 18px',
                    fontSize: 14,
                    fontWeight: 800,
                    minHeight: 44
                  }}
                >
                  Open Player
                </button>
              </div>
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
                key={playerUrl}
                src={playerUrl}
                title={
                  mediaType === 'movie'
                    ? `${displayTitle}`
                    : mediaType === 'tv'
                      ? `${displayTitle} Season ${season} Episode ${episode}`
                      : `${displayTitle} Episode ${episode}`
                }
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
              padding: '8px 12px',
              background: 'var(--bg3)',
              borderRadius: 6
            }}
          >
            {useExternalMobilePlayer
              ? 'External open is used only for TV and movies on mobile view.'
              : 'If the player stays blank, that source may block embedding.'}
          </div>
        </div>
      </div>
    </div>
  )
}