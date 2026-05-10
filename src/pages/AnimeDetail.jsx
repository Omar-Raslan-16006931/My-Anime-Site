import { useState, useEffect } from 'react'
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
  await supabase.from('currently_watching').upsert({
    user_id: user.id,
    mal_id: details.mal_id,
    title: details.title_english || details.title,
    poster: details.images?.jpg?.large_image_url,
    score: details.score,
    last_episode: epNum,
    total_episodes: details.episodes || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,mal_id' })
}

export default function AnimeDetail({ anime, user, onAuthRequired, onBack }) {
  const [details, setDetails] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [epCount, setEpCount] = useState(null)
  const [isAiring, setIsAiring] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [loading, setLoading] = useState(true)
  const [epLoading, setEpLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [playingEp, setPlayingEp] = useState(null)
  const [epPage, setEpPage] = useState(1)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setLoading(true)
    setEpisodes([])
    setEpCount(null)
    setIsAiring(false)
    setEpPage(1)

    fetch(`https://api.jikan.moe/v4/anime/${anime.mal_id}/full`)
      .then(r => r.json())
      .then(d => {
        setDetails(d.data)
        setLoading(false)
      })

    const fetchAllEpisodes = async () => {
      setEpLoading(true)
      let page = 1
      let all = []
      while (true) {
        const r = await fetch(`https://api.jikan.moe/v4/anime/${anime.mal_id}/episodes?page=${page}`)
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

    getEpCount(anime.mal_id).then(data => {
      if (data) {
        setEpCount(data.n)
        setIsAiring(data.airing)
      }
    })

    if (user) {
      supabase.from('watchlist').select('mal_id')
        .eq('user_id', user.id).eq('mal_id', anime.mal_id)
        .single().then(({ data }) => setInWatchlist(!!data))
    }
  }, [anime.mal_id, user])

  const handlePlay = (epNum) => {
    setPlayingEp(epNum)
    if (user) upsertWatching(user, details, epNum)
  }

  const toggleWatchlist = async () => {
    if (!user) return onAuthRequired()
    if (inWatchlist) {
      await supabase.from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('mal_id', anime.mal_id)
      setInWatchlist(false)
    } else {
      await supabase.from('watchlist').insert({
        user_id: user.id,
        mal_id: details.mal_id,
        title: details.title_english || details.title,
        japanese_title: details.title,
        poster: details.images?.jpg?.large_image_url,
        score: details.score
      })
      setInWatchlist(true)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>Loading...</div>
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
    const yt = details?.trailer?.youtube_id ? `https://img.youtube.com/vi/${details.trailer.youtube_id}/hqdefault.jpg` : null
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

  const EpisodeRow = ({ epNum, title, romanji, aired, epObj }) => (
    <div
      onClick={() => handlePlay(epNum)}
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 8 : 16,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.15s'
      }}
    >
      <div style={{
        width: isMobile ? '100%' : 160,
        height: isMobile ? 120 : 90,
        flexShrink: 0,
        background: 'var(--bg3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
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
            fontSize: 22,
            background: 'var(--bg3)'
          }}
        >
          ▶
        </div>
        <div style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 4
        }}>EP {epNum}</div>
      </div>

      <div style={{ flex: 1, padding: isMobile ? '0 10px 10px' : '8px 0' }}>
        <div style={{ fontWeight: 600, fontSize: isMobile ? 13 : 14, marginBottom: 3 }}>
          {title || `Episode ${epNum}`}
        </div>
        {romanji && romanji !== title && (
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 3 }}>
            {romanji}
          </div>
        )}
        {aired && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{aired.split('T')[0]}</div>}
      </div>

      {!isMobile && (
        <div style={{ paddingRight: 16 }}>
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff',
            padding: '7px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>▶ Play</span>
        </div>
      )}
    </div>
  )

  const contentPadding = isMobile ? '12px' : '24px 24px'

  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      padding: contentPadding
    }}>
      <button onClick={onBack} style={{
        background: 'var(--bg3)',
        color: 'var(--text2)',
        padding: isMobile ? '6px 12px' : '8px 16px',
        borderRadius: 8,
        fontSize: 14,
        marginBottom: isMobile ? 14 : 24,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}>← Back</button>

      <div style={{
        display: 'flex',
        gap: isMobile ? 16 : 32,
        marginBottom: isMobile ? 18 : 32,
        flexWrap: 'wrap',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        <img
          src={details?.images?.jpg?.large_image_url || details?.images?.jpg?.image_url}
          alt={details?.title_english || details?.title}
          style={{
            width: isMobile ? '100%' : 200,
            maxWidth: isMobile ? '100%' : 200,
            borderRadius: 'var(--radius)',
            flexShrink: 0,
            objectFit: 'cover'
          }}
        />

        <div style={{ flex: 1, minWidth: isMobile ? 0 : 280 }}>
          <h1 style={{
            fontSize: isMobile ? 20 : 28,
            fontWeight: 800,
            marginBottom: 8,
            lineHeight: 1.15
          }}>
            {details?.title_english || details?.title}
          </h1>

          {details?.title && details?.title_english && details.title_english !== details.title && (
            <p style={{ color: 'var(--text2)', marginBottom: 12, fontSize: isMobile ? 12 : 14 }}>
              {details.title}
            </p>
          )}

          <div style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 14
          }}>
            {[
              { label: '⭐ Score', value: details?.score || 'N/A' },
              { label: '📺 Episodes', value: `${totalEps}${isAiring ? ' aired' : ''}` },
              { label: '📅 Status', value: details?.status || 'N/A' },
              { label: '🎬 Type', value: details?.type || 'N/A' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: isMobile ? '6px 10px' : '8px 14px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{s.label}</div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {isAiring && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#16a34a22',
              color: '#4ade80',
              border: '1px solid #4ade8044',
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 12
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
              Airing · {totalEps} eps out
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {details?.genres?.map(g => (
              <span key={g.mal_id} style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(225,29,72,0.15)',
                color: 'var(--accent)',
                border: '1px solid rgba(225,29,72,0.3)'
              }}>
                {g.name}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={toggleWatchlist} style={{
              background: inWatchlist ? 'rgba(225,29,72,0.15)' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: inWatchlist ? 'var(--accent)' : '#fff',
              border: inWatchlist ? '1px solid var(--accent)' : 'none',
              padding: isMobile ? '9px 16px' : '10px 24px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              width: isMobile ? '100%' : 'auto'
            }}>
              {inWatchlist ? '★ In Watchlist' : '☆ Add to Watchlist'}
            </button>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        borderBottom: '1px solid var(--border)',
        overflowX: isMobile ? 'auto' : 'visible'
      }}>
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
            {tab === 'episodes' ? `Episodes${totalEps !== '?' ? ` (${totalEps})` : ''}` : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <p style={{
          color: 'var(--text2)',
          lineHeight: 1.8,
          fontSize: isMobile ? 14 : 15,
          maxWidth: 800
        }}>
          {details?.synopsis || 'No synopsis available.'}
        </p>
      )}

      {activeTab === 'episodes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>Loading episodes...</div>
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
            <div style={{
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              maxWidth: 800,
              aspectRatio: isMobile ? '16 / 9' : 'auto'
            }}>
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