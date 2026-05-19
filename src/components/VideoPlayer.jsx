import { useEffect, useMemo, useState } from 'react'
import DownloadButton from './DownloadButton'

export default function VideoPlayer({
  mediaType = 'anime',
  malId,
  tmdbId,
  title,
  episode,
  season = 1,
  movieTitle,
  downloadUrl,
  onClose
}) {
  const getDefaultSource = (type) => (type === 'anime' ? 'dropfile' : 'vidsrc')

  const [src, setSrc] = useState(() => getDefaultSource(mediaType))
  const [dub, setDub] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

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
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
  }, [mediaType, malId, tmdbId, safeSeason, safeEpisode, src, dub])

  const playerUrl = useMemo(() => {
    const audio = dub ? 'dub' : 'sub'

    if (mediaType === 'movie') {
      if (!tmdbId) return ''
      return `https://vidsrc.to/embed/movie/${tmdbId}`
    }

    if (mediaType === 'tv') {
      if (!tmdbId) return ''
      return `https://vidsrc.to/embed/tv/${tmdbId}/${safeSeason}/${safeEpisode}`
    }

    if (!malId) return ''

    switch (src) {
      case 'vidsrc':
        return `https://vidsrc.to/embed/anime/${malId}/${safeSeason}-${safeEpisode}`
      case 'animepahe':
        return `https://animepahe.ru/anime/${malId}`
      case 'gogoanime':
        return `https://gogoanime.tel/search.html?keyword=${encodeURIComponent(title || '')}`
      case 'zoro':
        return `https://aniwatch.to/search?keyword=${encodeURIComponent(title || '')}`
      case 'dropfile':
      default:
        return `https://dropfile.cc/player/tv/mal-${malId}/${safeSeason}/${safeEpisode}?audio=${audio}&lang=en`
    }
  }, [mediaType, src, dub, tmdbId, malId, safeSeason, safeEpisode, title])

  const frameKey = useMemo(() => {
    return [
      mediaType,
      src,
      dub ? 'dub' : 'sub',
      tmdbId || 'no-tmdb',
      malId || 'no-mal',
      safeSeason,
      safeEpisode,
      playerUrl
    ].join(':')
  }, [mediaType, src, dub, tmdbId, malId, safeSeason, safeEpisode, playerUrl])

  const nowPlayingLabel =
    mediaType === 'movie'
      ? 'Movie'
      : mediaType === 'tv'
        ? `S${safeSeason} • E${safeEpisode}`
        : safeSeason && safeSeason > 1
          ? `S${safeSeason} • E${safeEpisode}`
          : `Episode ${safeEpisode}`

  const displayTitle = movieTitle || title

  const sourceOptions =
    mediaType === 'anime'
      ? [
          { value: 'dropfile', label: 'dropfile.cc' },
          { value: 'vidsrc', label: 'vidsrc.to' },
          { value: 'animepahe', label: 'animepahe.ru' },
          { value: 'gogoanime', label: 'gogoanime' },
          { value: 'zoro', label: 'aniwatch' }
        ]
      : [{ value: 'vidsrc', label: 'vidsrc.to' }]

  const openExternalPlayer = () => {
    if (!playerUrl) return
    window.open(playerUrl, '_blank', 'noopener,noreferrer')
  }

  const alwaysExternal =
    mediaType === 'anime' &&
    ['animepahe', 'gogoanime', 'zoro'].includes(src)

  const useExternalMobilePlayer =
    isMobile && (mediaType === 'tv' || mediaType === 'movie')

  const openExternally = alwaysExternal || useExternalMobilePlayer

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

              <DownloadButton
                url={downloadUrl}
                label="Download"
                isMobile={isMobile}
              />
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Watch Now
              </button>
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
              : 'Anime providers may split seasons into separate entries, so source behavior can differ by title.'}
          </div>
        </div>
      </div>
    </div>
  )
}