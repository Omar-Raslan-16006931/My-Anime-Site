import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'

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
    season_number: selectedSeason,
    last_episode: episodeNumber,
    total_episodes: details.number_of_episodes || null,
    updated_at: new Date().toISOString()
  },
  { onConflict: 'user_id,media_type,tmdb_id' }
)
}

async function fetchRetry(url, retries = 3) {
  let res;
  for (let i = 0; i < retries; i++) {
    res = await fetch(url);
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (i + 1);
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }
    return res;
  }
  return res;
}

export default function TVDetail({ user, onAuthRequired }) {
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
        const res = await fetchRetry(`https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}`)
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
            .from('currently_watching')
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

        const res = await fetchRetry(
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

  const handlePlay = (episodeNumber) => {
    setPlayingEpisode(episodeNumber)
    setLastWatchedEpisode(episodeNumber)
    setLastWatchedSeason(selectedSeason)
    if (user) upsertWatching(user, details, selectedSeason, episodeNumber)
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

    return (
      <button
        type="button"
        onClick={() => handlePlay(ep.episode_number)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 10 : 14,
          background: isLastSeen ? 'rgba(225,29,72,0.08)' : 'var(--card)',
          border: isLastSeen ? '1px solid rgba(225,29,72,0.35)' : '1px solid var(--border)',
          borderRadius: isMobile ? 10 : 12,
          padding: isMobile ? 8 : 10,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.2s ease, border-color 0.2s ease'
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
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap'
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

            {isLastSeen && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: 999,
                  background: 'rgba(225,29,72,0.14)',
                  border: '1px solid rgba(225,29,72,0.28)',
                  color: 'var(--accent)',
                  whiteSpace: 'nowrap'
                }}
              >
                Last seen
              </span>
            )}
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

        <div style={{ flexShrink: 0, alignSelf: 'center' }}>
          <span
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
              whiteSpace: 'nowrap'
            }}
          >
            {isLastSeen ? (isMobile ? 'Seen' : 'Last seen') : (isMobile ? '▶' : 'Play')}
          </span>
        </div>
      </button>
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
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          background: 'var(--bg3)',
          color: 'var(--text2)',
          padding: isMobile ? '6px 12px' : '8px 16px',
          borderRadius: 8,
          fontSize: 14,
          marginBottom: isMobile ? 14 : 24,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        ← Back
      </button>

      {details.backdrop_path && (
        <div
          style={{
            width: isMobile ? '50%' : '100%',
            margin: isMobile ? '0 auto 16px' : '0 0 24px',
            borderRadius: 18,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--bg3)'
          }}
        >
          <img
            src={`${BACKDROP}${details.backdrop_path}`}
            alt={details.name}
            style={{
              width: '100%',
              height: isMobile ? 90 : 360,
              objectFit: 'cover',
              display: 'block'
            }}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 16 : 28,
          marginBottom: 24,
          alignItems: isMobile ? 'center' : 'flex-start'
        }}
      >
        <img
          src={details.poster_path ? `${IMG}${details.poster_path}` : '/placeholder.jpg'}
          alt={details.name}
          style={{
            width: isMobile ? '50%' : 240,
            maxWidth: isMobile ? '50%' : 240,
            borderRadius: 16,
            objectFit: 'cover',
            border: '1px solid var(--border)',
            background: 'var(--bg3)'
          }}
        />

        <div style={{ flex: 1, minWidth: 0, textAlign: isMobile ? 'center' : 'left', width: '100%' }}>
          <h1
            style={{
              fontSize: isMobile ? 24 : 36,
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: 10
            }}
          >
            {details.name}
          </h1>

          {details.original_name && details.original_name !== details.name && (
            <p
              style={{
                color: 'var(--text2)',
                fontSize: isMobile ? 13 : 15,
                marginBottom: 12
              }}
            >
              {details.original_name}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 16
            }}
          >
            {[
              { label: '⭐ Score', value: details.vote_average ? details.vote_average.toFixed(1) : 'N/A' },
              { label: '📺 Seasons', value: details.number_of_seasons || seasons.length || 'N/A' },
              { label: '🎞 Episodes', value: details.number_of_episodes || 'N/A' },
              { label: '📅 Status', value: details.status || 'N/A' }
            ].map(item => (
              <div
                key={item.label}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: isMobile ? '7px 10px' : '9px 14px'
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {details.genres?.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 16
              }}
            >
              {details.genres.map(genre => (
                <span
                  key={genre.id}
                  style={{
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: 999,
                    background: 'rgba(225,29,72,0.14)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(225,29,72,0.28)'
                  }}
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 18
            }}
          >
            <button
              type="button"
              onClick={toggleWatchlist}
              style={{
                background: inWatchlist
                  ? 'rgba(225,29,72,0.15)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: inWatchlist ? 'var(--accent)' : '#fff',
                border: inWatchlist ? '1px solid var(--accent)' : 'none',
                padding: isMobile ? '10px 14px' : '12px 18px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 14,
                minHeight: 44
              }}
            >
              {inWatchlist ? '★ In Watchlist' : '☆ Add to Watchlist'}
            </button>

            {lastWatchedEpisode && lastWatchedSeason && (
              <div
                style={{
                  minHeight: 44,
                  padding: isMobile ? '10px 14px' : '12px 18px',
                  borderRadius: 10,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                Last seen: S{lastWatchedSeason} • E{lastWatchedEpisode}
              </div>
            )}
          </div>

          <p
            style={{
              color: 'var(--text2)',
              lineHeight: 1.8,
              fontSize: isMobile ? 14 : 15,
              maxWidth: 780
            }}
          >
            {details.overview || 'No overview available.'}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <h2
          style={{
            fontSize: isMobile ? 18 : 22,
            fontWeight: 800,
            marginBottom: 12
          }}
        >
          Seasons
        </h2>

        {seasons.length === 0 ? (
          <div style={{ color: 'var(--text2)' }}>No seasons available.</div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 20
            }}
          >
            {seasons.map(season => {
              const active = selectedSeason === season.season_number

              return (
                <button
                  type="button"
                  key={season.id || season.season_number}
                  onClick={() => setSelectedSeason(season.season_number)}
                  style={{
                    padding: isMobile ? '9px 12px' : '10px 16px',
                    borderRadius: 999,
                    border: active
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                    background: active
                      ? 'rgba(225,29,72,0.16)'
                      : 'var(--bg3)',
                    color: active ? 'var(--accent)' : 'var(--text)',
                    fontWeight: active ? 700 : 600,
                    fontSize: 13,
                    minHeight: 40,
                    whiteSpace: 'nowrap'
                  }}
                >
                  Season {season.season_number}
                </button>
              )
            })}
          </div>
        )}
      </div>

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
    </div>
  )
}