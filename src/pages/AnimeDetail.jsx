import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'

async function getEpCount(malId) {
  try {
    const query = `
      query ($id: Int) {
        Media(idMal: $id, type: ANIME) {
          episodes
          status
          nextAiringEpisode {
            episode
          }
        }
      }
    `

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: malId } })
    })

    const json = await res.json()
    const media = json?.data?.Media

    if (!media) return null
    if (media.nextAiringEpisode?.episode) {
      return { n: media.nextAiringEpisode.episode - 1, airing: true }
    }
    if (media.episodes) {
      return { n: media.episodes, airing: false }
    }

    return null
  } catch {
    return null
  }
}

async function upsertWatching(user, details, epNum) {
  if (!user || !details) return

  await supabase.from('currently_watching').upsert(
    {
      user_id: user.id,
      mal_id: details.mal_id,
      title: details.title_english || details.title,
      poster: details.images?.jpg?.large_image_url || details.images?.jpg?.image_url || null,
      score: details.score,
      last_episode: epNum,
      total_episodes: details.episodes || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,mal_id' }
  )
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export default function AnimeDetail({ user, onAuthRequired, onBack }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const malId = Number(id)

  const tabStorageKey = `anime-detail-tab-${malId}`
  const playerStorageKey = `anime-detail-player-${malId}`

  const [details, setDetails] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [epCount, setEpCount] = useState(null)
  const [isAiring, setIsAiring] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [episodeProgress, setEpisodeProgress] = useState({})
  const [lastWatchedEpisode, setLastWatchedEpisode] = useState(null)
  const [lastWatchedAt, setLastWatchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [epLoading, setEpLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [playingEp, setPlayingEp] = useState(null)
  const [epPage, setEpPage] = useState(1)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedTab = sessionStorage.getItem(tabStorageKey)
    const savedPlayer = sessionStorage.getItem(playerStorageKey)

    if (savedTab) setActiveTab(savedTab)
    if (savedPlayer) {
      const ep = Number(savedPlayer)
      if (Number.isFinite(ep)) {
        setPlayingEp(ep)
        setActiveTab('episodes')
      }
    }
  }, [tabStorageKey, playerStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(tabStorageKey, activeTab)
  }, [activeTab, tabStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (playingEp != null) {
      sessionStorage.setItem(playerStorageKey, String(playingEp))
    } else {
      sessionStorage.removeItem(playerStorageKey)
    }
  }, [playingEp, playerStorageKey])

  useEffect(() => {
    if (!malId) return

    let cancelled = false

    setLoading(true)
    setEpLoading(false)
    setLoadError('')
    setEpisodes([])
    setEpCount(null)
    setIsAiring(false)
    setEpPage(1)
    setDetails(null)
    setInWatchlist(false)
    setEpisodeProgress({})
    setLastWatchedEpisode(null)
    setLastWatchedAt(null)

    const fetchDetails = async () => {
      try {
        const r = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`)
        const d = await r.json()

        if (cancelled) return
        if (!r.ok || !d?.data) throw new Error('DETAILS_FAILED')

        setDetails(d.data)
      } catch {
        if (!cancelled) setLoadError('Failed to load anime details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const fetchAllEpisodes = async () => {
      setEpLoading(true)
      let page = 1
      let all = []

      try {
        while (true) {
          const r = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`)
          const d = await r.json()

          if (cancelled) return
          if (!r.ok) break
          if (!d.data || d.data.length === 0) break

          all = [...all, ...d.data]

          if (!d.pagination?.has_next_page) break
          page += 1
          await new Promise(res => setTimeout(res, 350))
        }

        if (!cancelled) setEpisodes(all)
      } catch {
        if (!cancelled) setEpisodes([])
      } finally {
        if (!cancelled) setEpLoading(false)
      }
    }

    fetchDetails()
    fetchAllEpisodes()

    getEpCount(malId).then(data => {
      if (cancelled || !data) return
      setEpCount(data.n)
      setIsAiring(data.airing)
    })

    if (user) {
      supabase
        .from('watchlist')
        .select('mal_id')
        .eq('user_id', user.id)
        .eq('mal_id', malId)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setInWatchlist(!!data)
        })
        .catch(() => {
          if (!cancelled) setInWatchlist(false)
        })

      supabase
        .from('anime_episode_progress')
        .select('episode_number, seen, seen_at')
        .eq('user_id', user.id)
        .eq('mal_id', malId)
        .eq('seen', true)
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            setEpisodeProgress({})
            return
          }

          const map = {}
          ;(data || []).forEach(row => {
            map[Number(row.episode_number)] = {
              seen: true,
              seen_at: row.seen_at || null
            }
          })
          setEpisodeProgress(map)
        })
        .catch(() => {
          if (!cancelled) setEpisodeProgress({})
        })

      supabase
        .from('currently_watching')
        .select('last_episode, updated_at')
        .eq('user_id', user.id)
        .eq('mal_id', malId)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) {
            setLastWatchedEpisode(data?.last_episode ?? null)
            setLastWatchedAt(data?.updated_at ?? null)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLastWatchedEpisode(null)
            setLastWatchedAt(null)
          }
        })
    }

    return () => {
      cancelled = true
    }
  }, [malId, user])

  const trailer = details?.trailer?.embed_url
  const totalEps = epCount || details?.episodes || '?'
  const EP_GROUP = 100
  const totalEpsNumber = typeof totalEps === 'number' ? totalEps : null
  const totalForPaging = totalEpsNumber ?? episodes.length
  const pageCount = totalForPaging ? Math.ceil(totalForPaging / EP_GROUP) : 1
  const hasPagedDropdown = totalForPaging > EP_GROUP
  const pageStart = (epPage - 1) * EP_GROUP + 1
  const pageEnd = totalEpsNumber
    ? Math.min(epPage * EP_GROUP, totalEpsNumber)
    : Math.min(epPage * EP_GROUP, episodes.length || epPage * EP_GROUP)

  const pageNumbers = totalEpsNumber && pageEnd >= pageStart
    ? Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i)
    : []

  const episodesByNumber = useMemo(() => {
    return new Map(
      episodes
        .filter(ep => typeof ep.episode === 'number')
        .map(ep => [ep.episode, ep])
    )
  }, [episodes])

  const pageItems = totalEpsNumber
    ? pageNumbers.map(num => ({ num, ep: episodesByNumber.get(num) || null }))
    : episodes
        .slice((epPage - 1) * EP_GROUP, epPage * EP_GROUP)
        .map(ep => ({ num: ep.episode ?? ep.mal_id, ep }))

  const markEpisodeSeen = async (epNum) => {
    if (!user) return onAuthRequired?.()
    if (!details) return

    const nowIso = new Date().toISOString()

    const payload = {
      user_id: user.id,
      mal_id: malId,
      episode_number: Number(epNum),
      seen: true,
      seen_at: nowIso,
      updated_at: nowIso
    }

    const { error } = await supabase
      .from('anime_episode_progress')
      .upsert(payload, { onConflict: 'user_id,mal_id,episode_number' })

    if (!error) {
      setEpisodeProgress(prev => ({
        ...prev,
        [Number(epNum)]: {
          seen: true,
          seen_at: nowIso
        }
      }))
    } else {
      console.error('markEpisodeSeen error:', error)
    }
  }

  const toggleEpisodeSeen = async (epNum, isSeen) => {
    if (!user) return onAuthRequired?.()
    if (!details) return

    if (!isSeen) {
      await markEpisodeSeen(epNum)
      return
    }

    const { error } = await supabase
      .from('anime_episode_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('mal_id', malId)
      .eq('episode_number', Number(epNum))

    if (!error) {
      setEpisodeProgress(prev => {
        const next = { ...prev }
        delete next[Number(epNum)]
        return next
      })
    } else {
      console.error('toggleEpisodeSeen delete error:', error)
    }
  }

  const handlePlay = async (epNum) => {
    const exactEp = Number(epNum)
    if (!Number.isFinite(exactEp)) return

    setPlayingEp(exactEp)
    setActiveTab('episodes')

    if (user && details) {
      const nowIso = new Date().toISOString()
      setLastWatchedEpisode(exactEp)
      setLastWatchedAt(nowIso)
      await upsertWatching(user, details, exactEp)
      await markEpisodeSeen(exactEp)
    }
  }

  const handleClosePlayer = () => {
    setPlayingEp(null)
  }

  const toggleWatchlist = async () => {
    if (!user) return onAuthRequired?.()
    if (!details) return

    try {
      if (inWatchlist) {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('mal_id', malId)

        if (!error) setInWatchlist(false)
      } else {
        const { error } = await supabase.from('watchlist').insert({
          user_id: user.id,
          mal_id: malId,
          title: details.title_english || details.title,
          poster: details.images?.jpg?.large_image_url || details.images?.jpg?.image_url || null,
          score: details.score
        })

        if (!error) setInWatchlist(true)
      }
    } catch (err) {
      console.error('Watchlist toggle error:', err)
    }
  }

  const renderThumb = (epNum, ep) => {
    const poster =
      ep?.images?.jpg?.image_url ||
      details?.images?.jpg?.large_image_url ||
      details?.images?.jpg?.image_url ||
      null

    if (!poster) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text2)',
            fontSize: 20,
            background: 'var(--bg3)'
          }}
        >
          ▶
        </div>
      )
    }

    return (
      <img
        src={poster}
        alt={`Episode ${epNum}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }

  const EpisodeRow = ({ epNum, title, romanji, aired, epObj }) => {
    const mobileLayout = isMobile
    const progress = episodeProgress[Number(epNum)]
    const isSeen = progress?.seen === true

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: mobileLayout ? 10 : 16,
          background: isSeen ? 'rgba(225,29,72,0.06)' : 'var(--card)',
          border: isSeen ? '1px solid rgba(225,29,72,0.24)' : '1px solid var(--border)',
          borderRadius: mobileLayout ? 10 : 12,
          overflow: 'hidden',
          minHeight: mobileLayout ? 72 : 90,
          padding: mobileLayout ? 8 : 0
        }}
      >
        <div
          onClick={() => handlePlay(epNum)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: mobileLayout ? 10 : 16,
            flex: 1,
            minWidth: 0,
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              width: mobileLayout ? 58 : 160,
              height: mobileLayout ? 58 : 90,
              flexShrink: 0,
              background: 'var(--bg3)',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: mobileLayout ? 8 : 0
            }}
          >
            {renderThumb(epNum, epObj)}

            <div
              style={{
                position: 'absolute',
                bottom: 4,
                left: 4,
                background: 'rgba(0,0,0,0.75)',
                color: '#fff',
                fontSize: mobileLayout ? 9 : 11,
                fontWeight: 700,
                padding: mobileLayout ? '1px 5px' : '2px 6px',
                borderRadius: 4
              }}
            >
              EP {epNum}
            </div>

            {isSeen && (
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'rgba(225,29,72,0.92)',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 999
                }}
              >
                SEEN
              </div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              paddingRight: mobileLayout ? 2 : 0
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: mobileLayout ? 13 : 14,
                marginBottom: mobileLayout ? 2 : 4,
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: mobileLayout ? 2 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {title || `Episode ${epNum}`}
            </div>

            {romanji && romanji !== title && !mobileLayout && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text2)',
                  marginBottom: 4
                }}
              >
                {romanji}
              </div>
            )}

            <div
              style={{
                fontSize: 11,
                color: isSeen ? 'var(--accent)' : 'var(--text2)',
                lineHeight: 1.2,
                fontWeight: isSeen ? 700 : 400
              }}
            >
              {isSeen
                ? `Seen${progress?.seen_at ? ` • ${formatDate(progress.seen_at)}` : ''}`
                : aired
                  ? aired.split('T')[0]
                  : `Episode ${epNum}`}
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'center',
              paddingRight: mobileLayout ? 4 : 16
            }}
          >
            <span
              style={{
                background: mobileLayout ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: mobileLayout ? 'var(--accent)' : '#fff',
                border: mobileLayout ? '1px solid rgba(225,29,72,0.22)' : 'none',
                padding: mobileLayout ? '6px 8px' : '7px 16px',
                borderRadius: 8,
                fontSize: mobileLayout ? 11 : 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                lineHeight: 1
              }}
            >
              {mobileLayout ? '▶' : isSeen ? '▶ Seen' : '▶ Play'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleEpisodeSeen(epNum, isSeen)}
          style={{
            marginRight: mobileLayout ? 0 : 12,
            background: isSeen ? 'rgba(225,29,72,0.14)' : 'var(--bg3)',
            color: isSeen ? 'var(--accent)' : 'var(--text2)',
            border: isSeen ? '1px solid rgba(225,29,72,0.28)' : '1px solid var(--border)',
            borderRadius: 8,
            padding: mobileLayout ? '8px 10px' : '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}
        >
          {isSeen ? 'Unsee' : 'Seen'}
        </button>
      </div>
    )
  }

  const contentPadding = isMobile ? '12px' : '24px'

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>
        Loading...
      </div>
    )
  }

  if (loadError || !details) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: contentPadding }}>
        <button
          onClick={() => (onBack ? onBack() : navigate(-1))}
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

        <div
          style={{
            border: '1px solid var(--border)',
            background: 'var(--bg2)',
            borderRadius: 14,
            padding: isMobile ? 16 : 24,
            color: 'var(--text)'
          }}
        >
          <h2 style={{ marginBottom: 8, fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>
            Anime unavailable
          </h2>
          <p style={{ color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
            Failed to load this anime right now.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: contentPadding
      }}
    >
      <button
        onClick={() => (onBack ? onBack() : navigate(-1))}
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

      <div
        style={{
          display: 'flex',
          gap: isMobile ? 16 : 32,
          marginBottom: isMobile ? 18 : 32,
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row'
        }}
      >
        <img
          src={details.images?.jpg?.large_image_url || details.images?.jpg?.image_url}
          alt={details.title_english || details.title}
          style={{
            width: isMobile ? '50%' : 220,
            maxWidth: isMobile ? '50%' : 220,
            borderRadius: 12,
            flexShrink: 0,
            objectFit: 'cover',
            alignSelf: isMobile ? 'center' : 'auto'
          }}
        />

        <div style={{ flex: 1, minWidth: isMobile ? 0 : 280, textAlign: isMobile ? 'center' : 'left' }}>
          <h1 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, marginBottom: 8, lineHeight: 1.15 }}>
            {details.title_english || details.title}
          </h1>

          {details.title && details.title_english && details.title_english !== details.title && (
            <p style={{ color: 'var(--text2)', marginBottom: 12, fontSize: isMobile ? 12 : 14 }}>
              {details.title}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { label: '⭐ Score', value: details.score || 'N/A' },
              { label: '📺 Episodes', value: `${totalEps}${isAiring ? ' aired' : ''}` },
              { label: '📅 Status', value: details.status || 'N/A' },
              { label: '🎬 Type', value: details.type || 'N/A' }
            ].map(s => (
              <div
                key={s.label}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: isMobile ? '6px 10px' : '8px 14px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{s.label}</div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {lastWatchedEpisode && (
            <div
              style={{
                marginBottom: 14,
                background: 'rgba(225,29,72,0.08)',
                border: '1px solid rgba(225,29,72,0.22)',
                color: 'var(--text)',
                borderRadius: 10,
                padding: isMobile ? '10px 12px' : '12px 14px'
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
                Last watched
              </div>
              <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 14 }}>
                Episode {lastWatchedEpisode}
              </div>
              {lastWatchedAt && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {formatDate(lastWatchedAt)}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {details.genres?.map(g => (
              <span
                key={g.mal_id}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(225,29,72,0.15)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(225,29,72,0.3)'
                }}
              >
                {g.name}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {lastWatchedEpisode && (
              <button
                onClick={() => handlePlay(lastWatchedEpisode)}
                style={{
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  padding: isMobile ? '9px 16px' : '10px 20px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                ▶ Resume Episode {lastWatchedEpisode}
              </button>
            )}

            <button
              onClick={toggleWatchlist}
              style={{
                background: inWatchlist
                  ? 'rgba(225,29,72,0.15)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: inWatchlist ? 'var(--accent)' : '#fff',
                border: inWatchlist ? '1px solid var(--accent)' : 'none',
                padding: isMobile ? '9px 16px' : '10px 24px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                width: isMobile ? '100%' : 'auto'
              }}
            >
              {inWatchlist ? '★ In Watchlist' : '☆ Add to Watchlist'}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          borderBottom: '1px solid var(--border)',
          overflowX: isMobile ? 'auto' : 'visible'
        }}
      >
        {['overview', 'episodes', 'trailer'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: isMobile ? '8px 14px' : '10px 20px',
              borderRadius: '8px 8px 0 0',
              background: activeTab === tab ? 'var(--bg3)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text2)',
              fontWeight: activeTab === tab ? 700 : 500,
              fontSize: 14,
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap'
            }}
          >
            {tab === 'episodes'
              ? `Episodes${totalEps !== '?' ? ` (${totalEps})` : ''}`
              : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <p
          style={{
            color: 'var(--text2)',
            lineHeight: 1.8,
            fontSize: isMobile ? 14 : 15,
            maxWidth: 800
          }}
        >
          {details.synopsis || 'No synopsis available.'}
        </p>
      )}

      {activeTab === 'episodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
          {hasPagedDropdown && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <select
                value={epPage}
                onChange={e => setEpPage(Number(e.target.value))}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p}>
                    {`${(p - 1) * EP_GROUP + 1}-${Math.min(
                      p * EP_GROUP,
                      totalEpsNumber ?? totalForPaging
                    )}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {epLoading && episodes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
              Loading episodes...
            </div>
          ) : pageItems.length > 0 ? (
            pageItems.map(({ num, ep }) => (
              <EpisodeRow
                key={`${malId}-${num}`}
                epNum={num}
                title={ep?.title}
                romanji={ep?.title_romanji}
                aired={ep?.aired}
                epObj={ep}
              />
            ))
          ) : (
            <p style={{ color: 'var(--text2)' }}>No episode data available.</p>
          )}
        </div>
      )}

      {activeTab === 'trailer' && (
        <div>
          {trailer ? (
            <div
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                maxWidth: 800,
                aspectRatio: isMobile ? '16 / 9' : 'auto'
              }}
            >
              <iframe
                src={trailer}
                width="100%"
                height={isMobile ? '220' : '450'}
                frameBorder="0"
                allowFullScreen
                title={`${details.title_english || details.title} trailer`}
                style={{ display: 'block', borderRadius: 12 }}
              />
            </div>
          ) : (
            <p style={{ color: 'var(--text2)' }}>No trailer available.</p>
          )}
        </div>
      )}

      {playingEp != null && (
        <VideoPlayer
          key={`anime-player-${malId}-${playingEp}`}
          mediaType="anime"
          malId={details.mal_id}
          title={details.title_english || details.title}
          episode={playingEp}
          season={1}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  )
}