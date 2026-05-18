import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'
import DownloadModal from '../components/DownloadButton'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const IMG = 'https://image.tmdb.org/t/p/w500'
const BACKDROP = 'https://image.tmdb.org/t/p/original'

async function upsertWatching(user, details, seasonNumber, episodeNumber) {
  if (!user || !details) return

  await supabase.from('currently_watching_tmdb').upsert(
    {
      user_id: user.id,
      media_type: 'tv',
      tmdb_id: details.id,
      title: details.name,
      poster: details.poster_path ? `${IMG}${details.poster_path}` : null,
      score: details.vote_average || null,
      season_number: seasonNumber,
      last_episode: episodeNumber,
      total_episodes: details.number_of_episodes || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,media_type,tmdb_id' }
  )
}

export default function TVDetail({ user, onAuthRequired, onDownloadStarted, onSettings }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [details, setDetails] = useState(null)
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [seasonData, setSeasonData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seasonLoading, setSeasonLoading] = useState(false)
  const [playingEpisode, setPlayingEpisode] = useState(null)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [lastWatchedEpisode, setLastWatchedEpisode] = useState(null)
  const [lastWatchedSeason, setLastWatchedSeason] = useState(null)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  const [showDownload, setShowDownload] = useState(false)
  const [downloadEpisode, setDownloadEpisode] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloaderFolder, setDownloaderFolder] = useState('')

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!id) return

    const loadShow = async () => {
      setLoading(true)
      setDetails(null)
      setSeasonData(null)
      setSelectedSeason(null)
      setPlayingEpisode(null)
      setInWatchlist(false)
      setLastWatchedEpisode(null)
      setLastWatchedSeason(null)

      try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}`)
        const json = await res.json()
        setDetails(json)

        const validSeasons = (json.seasons || []).filter(
          s => s && typeof s.season_number === 'number' && s.season_number > 0
        )

        if (validSeasons.length > 0) {
          setSelectedSeason(validSeasons[0].season_number)
        }

        if (user && json?.id) {
          supabase
            .from('watchlist')
            .select('tmdb_id')
            .eq('user_id', user.id)
            .eq('media_type', 'tv')
            .eq('tmdb_id', json.id)
            .single()
            .then(({ data }) => setInWatchlist(!!data))
            .catch(() => setInWatchlist(false))

          supabase
            .from('currently_watching_tmdb')
            .select('season_number,last_episode')
            .eq('user_id', user.id)
            .eq('media_type', 'tv')
            .eq('tmdb_id', json.id)
            .single()
            .then(({ data }) => {
              setLastWatchedSeason(data?.season_number ?? null)
              setLastWatchedEpisode(data?.last_episode ?? null)

              if (data?.season_number) {
                setSelectedSeason(data.season_number)
              }
            })
            .catch(() => {
              setLastWatchedSeason(null)
              setLastWatchedEpisode(null)
            })
        } else {
          setInWatchlist(false)
          setLastWatchedEpisode(null)
          setLastWatchedSeason(null)
        }
      } catch (err) {
        console.error('TV detail load error:', err)
        setDetails(null)
      } finally {
        setLoading(false)
      }
    }

    loadShow()
  }, [id, user])

  useEffect(() => {
    if (selectedSeason == null) return

    const loadSeason = async () => {
      try {
        setSeasonLoading(true)
        setSeasonData(null)

        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${id}/season/${selectedSeason}?api_key=${API_KEY}`
        )
        const data = await res.json()
        setSeasonData(data)
      } catch (err) {
        console.error('Season load error:', err)
        setSeasonData(null)
      } finally {
        setSeasonLoading(false)
      }
    }

    loadSeason()
  }, [id, selectedSeason])

  const getEpisodeDownloadUrl = (seasonNumber, episodeNumber) => {
    const downloads = details?.download_links || details?.downloads || {}
    const seasonDownloads =
      downloads?.[seasonNumber] ||
      downloads?.[String(seasonNumber)] ||
      {}

    return (
      seasonDownloads?.[episodeNumber] ||
      seasonDownloads?.[String(episodeNumber)] ||
      ''
    )
  }

  const handlePlay = (episodeNumber) => {
    setPlayingEpisode(episodeNumber)
    setLastWatchedEpisode(episodeNumber)
    setLastWatchedSeason(selectedSeason)
    if (user) upsertWatching(user, details, selectedSeason, episodeNumber)
  }

  const handleDownload = (ep) => {
    const url = getEpisodeDownloadUrl(selectedSeason, ep.episode_number)
    if (!url) return
    setDownloadEpisode(ep)
    setDownloadUrl(url)
    setShowDownload(true)
  }

  const toggleWatchlist = async () => {
    if (!user) return onAuthRequired?.()

    try {
      if (inWatchlist) {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('media_type', 'tv')
          .eq('tmdb_id', details.id)

        if (!error) setInWatchlist(false)
      } else {
        const { error } = await supabase.from('watchlist').insert({
          user_id: user.id,
          media_type: 'tv',
          tmdb_id: details.id,
          title: details.name,
          poster: details.poster_path ? `${IMG}${details.poster_path}` : null,
          score: details.vote_average,
          season_number: selectedSeason,
          last_episode: lastWatchedEpisode
        })

        if (!error) setInWatchlist(true)
      }
    } catch (err) {
      console.error('Watchlist toggle error:', err)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>
        Loading...
      </div>
    )
  }

  if (!details || details.success === false) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>
        TV show not found.
      </div>
    )
  }

  const seasons = (details.seasons || []).filter(
    s => s && typeof s.season_number === 'number' && s.season_number > 0
  )

  const EpisodeRow = ({ ep }) => {
    const isLastSeen =
      lastWatchedSeason === selectedSeason &&
      lastWatchedEpisode === ep.episode_number

    const hasDownload = !!getEpisodeDownloadUrl(selectedSeason, ep.episode_number)

    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 10 : 14,
          background: isLastSeen ? 'rgba(225,29,72,0.08)' : 'var(--card)',
          border: isLastSeen ? '1px solid rgba(225,29,72,0.35)' : '1px solid var(--border)',
          borderRadius: isMobile ? 10 : 12,
          padding: isMobile ? 8 : 10,
          textAlign: 'left'
        }}
      >
        <button
          type="button"
          onClick={() => handlePlay(ep.episode_number)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 10 : 14,
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            font: 'inherit',
            color: 'inherit',
            cursor: 'pointer',
            appearance: 'none',
            WebkitAppearance: 'none'
          }}
        >
          <div
            style={{
              width: isMobile ? 92 : 140,
              height: isMobile ? 56 : 80,
              flexShrink: 0,
              borderRadius: isMobile ? 8 : 10,
              background: 'var(--bg3)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {ep.still_path ? (
              <img
                src={`${IMG}${ep.still_path}`}
                alt={ep.name || `Episode ${ep.episode_number}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text2)',
                  fontSize: isMobile ? 16 : 20,
                  background: 'var(--bg3)'
                }}
              >
                ▶
              </div>
            )}

            <div
              style={{
                position: 'absolute',
                left: 6,
                bottom: 6,
                background: 'rgba(0,0,0,0.78)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 999,
                lineHeight: 1
              }}
            >
              EP {ep.episode_number}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 3
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: isMobile ? 13 : 14,
                lineHeight: 1.25,
                color: 'var(--text)',
                display: '-webkit-box',
                WebkitLineClamp: isMobile ? 2 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {ep.name || `Episode ${ep.episode_number}`}
            </div>

            <div
              style={{
                fontSize: 11,
                color: 'var(--text2)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap'
              }}
            >
              <span>Episode {ep.episode_number}</span>
              {ep.air_date && <span>• {ep.air_date}</span>}
              {typeof ep.runtime === 'number' && <span>• {ep.runtime} min</span>}
            </div>
          </div>
        </button>

        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexDirection: isMobile ? 'column' : 'row'
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleDownload(ep)
            }}
            disabled={!hasDownload}
            style={{
              minWidth: isMobile ? 42 : 96,
              height: isMobile ? 36 : 40,
              padding: isMobile ? '0 10px' : '0 14px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              fontSize: isMobile ? 12 : 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              cursor: hasDownload ? 'pointer' : 'not-allowed',
              opacity: hasDownload ? 1 : 0.5
            }}
          >
            ⬇ {isMobile ? '' : 'Download'}
          </button>

          <button
            type="button"
            onClick={() => handlePlay(ep.episode_number)}
            style={{
              minWidth: isMobile ? 44 : 72,
              height: isMobile ? 36 : 40,
              padding: isMobile ? '0 10px' : '0 14px',
              borderRadius: 999,
              background: isLastSeen
                ? 'rgba(225,29,72,0.18)'
                : (isMobile ? 'var(--bg3)' : 'rgba(225,29,72,0.14)'),
              border: isLastSeen
                ? '1px solid rgba(225,29,72,0.35)'
                : (isMobile ? '1px solid var(--border)' : '1px solid rgba(225,29,72,0.28)'),
              color: isMobile ? 'var(--text)' : 'var(--accent)',
              fontSize: isMobile ? 12 : 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            {isLastSeen ? (isMobile ? 'Seen' : 'Last seen') : (isMobile ? '▶' : 'Play')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: isMobile ? '12px' : '24px'
      }}
    >
      {/* your existing header/details UI stays the same */}

      <div style={{ marginBottom: 12 }}>
        <h3
          style={{
            fontSize: isMobile ? 16 : 20,
            fontWeight: 800
          }}
        >
          {selectedSeason != null ? `Season ${selectedSeason} Episodes` : 'Episodes'}
        </h3>
      </div>

      {seasonLoading ? (
        <div style={{ color: 'var(--text2)', padding: '18px 0' }}>
          Loading episodes...
        </div>
      ) : seasonData?.episodes?.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {seasonData.episodes.map(ep => (
            <EpisodeRow key={ep.id} ep={ep} />
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--text2)' }}>No episodes found for this season.</div>
      )}

      {playingEpisode && (
        <VideoPlayer
          mediaType="tv"
          tmdbId={details.id}
          title={details.name}
          season={selectedSeason}
          episode={playingEpisode}
          onClose={() => setPlayingEpisode(null)}
        />
      )}

      {showDownload && downloadEpisode && (
        <DownloadModal
          onClose={() => setShowDownload(false)}
          m3u8Url={downloadUrl}
          subtitles={[]}
          mediaName={`${details.name} - S${String(selectedSeason).padStart(2, '0')}E${String(downloadEpisode.episode_number).padStart(2, '0')}`}
          downloaderFolder={downloaderFolder}
          setDownloaderFolder={setDownloaderFolder}
          onOpenSettings={onSettings}
          onDownloadStarted={onDownloadStarted}
          mediaId={details.id}
          mediaType="tv"
          season={selectedSeason}
          episode={downloadEpisode.episode_number}
          posterPath={details.poster_path}
          tmdbId={details.id}
        />
      )}
    </div>
  )
}