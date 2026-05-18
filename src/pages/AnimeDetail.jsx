import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'

async function getEpCount(malId) {
  try {
    const q = `query($id:Int){Media(idMal:$id,type:ANIME){episodes status nextAiringEpisode{episode}}}`
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, variables: { id: malId } })
    })
    const d = await r.json()
    const m = d?.data?.Media
    if (!m) return null
    if (m.nextAiringEpisode?.episode) return { n: m.nextAiringEpisode.episode - 1, airing: true }
    if (m.episodes) return { n: m.episodes, airing: false }
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
      poster: details.images?.jpg?.large_image_url,
      score: details.score,
      last_episode: epNum,
      total_episodes: details.episodes || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,mal_id' }
  )
}

export default function AnimeDetail({ user, onAuthRequired }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const malId = Number(id)

  const [details, setDetails] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [epCount, setEpCount] = useState(null)
  const [isAiring, setIsAiring] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [lastWatchedEp, setLastWatchedEp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [epLoading, setEpLoading] = useState(false)
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
    if (!malId) return

    setLoading(true)
    setEpisodes([])
    setEpCount(null)
    setIsAiring(false)
    setEpPage(1)
    setLastWatchedEp(null)

    fetch(`https://api.jikan.moe/v4/anime/${malId}/full`)
      .then(r => r.json())
      .then(d => {
        setDetails(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    const fetchAllEpisodes = async () => {
      setEpLoading(true)
      let page = 1
      let all = []

      while (true) {
        const r = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`)
        const d = await r.json()

        if (!d.data || d.data.length === 0) break

        all = [...all, ...d.data]

        if (!d.pagination?.has_next_page) break

        page++
        await new Promise(res => setTimeout(res, 400))
      }

      setEpisodes(all)
      setEpLoading(false)
    }

    fetchAllEpisodes()

    getEpCount(malId).then(data => {
      if (data) {
        setEpCount(data.n)
        setIsAiring(data.airing)
      }
    })

    if (user) {
      supabase
        .from('watchlist')
        .select('mal_id')
        .eq('user_id', user.id)
        .eq('mal_id', malId)
        .single()
        .then(({ data }) => setInWatchlist(!!data))

      supabase
        .from('currently_watching')
        .select('last_episode')
        .eq('user_id', user.id)
        .eq('mal_id', malId)
        .single()
        .then(({ data }) => setLastWatchedEp(data?.last_episode ?? null))
    } else {
      setInWatchlist(false)
      setLastWatchedEp(null)
    }
  }, [malId, user])

  const handlePlay = (epNum) => {
    setPlayingEp(epNum)
    setLastWatchedEp(epNum)
    if (user) upsertWatching(user, details, epNum)
  }

  const toggleWatchlist = async () => {
    if (!user) return onAuthRequired()

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
          poster: details.images?.jpg?.large_image_url,
          score: details.score
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

  if (!details) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>
        Anime not found.
      </div>
    )
  }

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

  const episodesByNumber = new Map(
    episodes
      .filter(ep => typeof ep.episode === 'number')
      .map(ep => [ep.episode, ep])
  )

  const pageItems = totalEpsNumber
    ? pageNumbers.map(num => ({ num, ep: episodesByNumber.get(num) }))
    : episodes
        .slice((epPage - 1) * EP_GROUP, epPage * EP_GROUP)
        .map(ep => ({ num: ep.episode ?? ep.mal_id, ep }))

  const renderThumb = (epNum, ep) => {
    const yt = details?.trailer?.youtube_id
      ? `https://img.youtube.com/vi/${details.trailer.youtube_id}/hqdefault.jpg`
      : null

    const poster = details?.images?.jpg?.large_image_url || details?.images?.jpg?.image_url || null
    const epThumb = ep?.images?.jpg?.image_url || null
    const src = yt || poster || epThumb

    if (!src) return null

    return (
      <img
        src={src}
        alt={`EP ${epNum}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={e => {
          e.currentTarget.style.display = 'none'
          const badge = e.currentTarget.parentElement.querySelector('.thumb-fallback')
          if (badge) badge.style.display = 'flex'
        }}
      />
    )
  }

  const EpisodeRow = ({ epNum, title, romanji, aired, epObj }) => {
    const isLastSeen = lastWatchedEp === epNum

    return (
      <button
        onClick={() => handlePlay(epNum)}
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
          transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.2s ease'
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
          {renderThumb(epNum, epObj)}

          <div
            className="thumb-fallback"
            style={{
              display: 'none',
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text2)',
              fontSize: isMobile ? 16 : 20,
              background: 'var(--bg3)'
            }}
          >
            ▶
          </div>

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
            EP {epNum}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 4
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
              {title || `Episode ${epNum}`}
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

          {romanji && romanji !== title && !isMobile && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {romanji}
            </div>
          )}

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
            <span>Episode {epNum}</span>
            {aired && <span>• {aired.split('T')[0]}</span>}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            alignSelf: 'center'
          }}
        >
          <span
            style={{
              minWidth: isMobile ? 44 : 64,
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

  const contentPadding = isMobile ? '12px' : '24px 24px'

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: contentPadding
      }}
    >
      <button
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

      <div
        style={{
          display: 'flex',
          gap: isMobile ? 12 : 32,
          marginBottom: isMobile ? 16 : 32,
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'stretch'
        }}
      >
        <img
          src={details?.images?.jpg?.large_image_url || details?.images?.jpg?.image_url}
          alt={details?.title_english || details?.title}
          style={{
            width: isMobile ? 124 : 200,
            maxWidth: isMobile ? 124 : 200,
            borderRadius: 'var(--radius)',
            flexShrink: 0,
            objectFit: 'cover',
            alignSelf: isMobile ? 'center' : 'flex-start'
          }}
        />

        <div style={{ flex: 1, minWidth: isMobile ? 0 : 280, width: '100%' }}>
          <h1
            style={{
              fontSize: isMobile ? 18 : 28,
              fontWeight: 800,
              marginBottom: 6,
              lineHeight: 1.18,
              textAlign: isMobile ? 'center' : 'left'
            }}
          >
            {details?.title_english || details?.title}
          </h1>

          {details?.title && details?.title_english && details.title_english !== details.title && (
            <p
              style={{
                color: 'var(--text2)',
                marginBottom: 10,
                fontSize: isMobile ? 11 : 14,
                textAlign: isMobile ? 'center' : 'left'
              }}
            >
              {details.title}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 12,
              justifyContent: isMobile ? 'center' : 'flex-start'
            }}
          >
            {[
              { label: '⭐ Score', value: details?.score || 'N/A' },
              { label: '📺 Episodes', value: `${totalEps}${isAiring ? ' aired' : ''}` },
              { label: '📅 Status', value: details?.status || 'N/A' },
              { label: '🎬 Type', value: details?.type || 'N/A' }
            ].map(s => (
              <div
                key={s.label}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: isMobile ? '5px 8px' : '8px 14px',
                  textAlign: 'center',
                  minWidth: isMobile ? 86 : 'auto'
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text2)' }}>{s.label}</div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 12 : 15 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {isAiring && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#16a34a22',
                color: '#4ade80',
                border: '1px solid #4ade8044',
                borderRadius: 999,
                padding: isMobile ? '4px 10px' : '4px 12px',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#4ade80'
                }}
              />
              Airing · {totalEps} eps out
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 14,
              justifyContent: isMobile ? 'center' : 'flex-start'
            }}
          >
            {details?.genres?.map(g => (
              <span
                key={g.mal_id}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'rgba(225,29,72,0.15)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(225,29,72,0.3)'
                }}
              >
                {g.name}
              </span>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'center' : 'flex-start'
            }}
          >
            <button
              onClick={toggleWatchlist}
              style={{
                background: inWatchlist
                  ? 'rgba(225,29,72,0.15)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                color: inWatchlist ? 'var(--accent)' : '#fff',
                border: inWatchlist ? '1px solid var(--accent)' : 'none',
                padding: isMobile ? '8px 14px' : '10px 24px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: isMobile ? 13 : 14,
                width: isMobile ? '100%' : 'auto',
                maxWidth: isMobile ? 260 : 'none'
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
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 14,
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
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
          {details?.synopsis || 'No synopsis available.'}
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
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p}>
                    {`${(p - 1) * EP_GROUP + 1}-${Math.min(p * EP_GROUP, totalEpsNumber ?? totalForPaging)}`}
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
                key={num}
                epNum={num}
                title={ep?.title}
                romanji={ep?.title_romanji}
                aired={ep?.aired}
                epObj={ep || null}
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
                borderRadius: 'var(--radius)',
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
                style={{ display: 'block', borderRadius: 'var(--radius)' }}
              />
            </div>
          ) : (
            <p style={{ color: 'var(--text2)' }}>No trailer available.</p>
          )}
        </div>
      )}

      {playingEp && (
        <VideoPlayer
          malId={details?.mal_id}
          title={details?.title_english || details?.title}
          episode={playingEp}
          onClose={() => setPlayingEp(null)}
        />
      )}
    </div>
  )
}