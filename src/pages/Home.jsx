import { useState, useEffect } from 'react'
import AnimeCard from '../components/AnimeCard'
import { supabase } from '../supabase'

export default function Home({ user, onAuthRequired, onSelect }) {
  const [anime, setAnime] = useState([])
  const [watching, setWatching] = useState([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [watchingLoading, setWatchingLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const url = query
      ? `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20&sfw=true`
      : `https://api.jikan.moe/v4/top/anime?limit=20`

    let cancelled = false

    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setAnime(d.data || [])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [query])

  useEffect(() => {
    const loadWatching = async () => {
      if (!user) {
        setWatching([])
        setWatchingLoading(false)
        return
      }

      setWatchingLoading(true)
      const { data } = await supabase
        .from('currently_watching')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      setWatching(data || [])
      setWatchingLoading(false)
    }

    loadWatching()
  }, [user])

  const handleSearch = (e) => {
    e.preventDefault()
    setLoading(true)
    setQuery(search.trim())
  }

  const renderBanner = () => (
    <section style={{
      marginBottom: isMobile ? 16 : 32,
      borderRadius: isMobile ? 14 : 18,
      overflow: 'hidden',
      position: 'relative',
      minHeight: isMobile ? 140 : 260,
      background: 'linear-gradient(135deg, rgba(225,29,72,0.15), rgba(168,85,247,0.18))',
      border: '1px solid var(--border)'
    }}>
      <img
        src="/LuffyCrunchyroll.png"
        alt="Banner"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          opacity: 0.72
        }}
      />
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: isMobile ? '14px 12px' : '28px 24px',
        minHeight: isMobile ? 140 : 210,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        textAlign: 'center',
        backdropFilter: 'blur(0px)'
      }}>
        <p style={{
          fontSize: isMobile ? 11 : 13,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text2)',
          marginBottom: 8,
          fontWeight: 700,
          textShadow: '0 4px 4px rgba(0,0,0,0.4)'
        }}>
         
        </p>
        <h2 style={{
          fontSize: isMobile ? 18 : 'clamp(21px, 4vw, 41px)',
          lineHeight: 1.05,
          fontWeight: 900,
          color: '#f2a049',
          marginBottom: 8,
          textShadow: '0 4px 4px rgba(0,0,0,0.4)'
        }}>
          Anime, without the noise
        </h2>
        <p style={{
          maxWidth: 700,
          margin: '0 auto',
          color: 'rgba(255,255,255,0.78)',
          fontSize: isMobile ? 12 : 15,
          textShadow: '0 4px 8px rgba(0,0,0,0.4)'
        }}>
          Discover, track, and organize your watch list from one place.
        </p>
      </div>
    </section>
  )

  const renderSearch = () => (
    <form onSubmit={handleSearch} style={{
      display: 'flex',
      gap: 8,
      maxWidth: isMobile ? '100%' : 560,
      margin: '0 auto 20px',
      flexDirection: isMobile ? 'column' : 'row'
    }}>
      <input
        placeholder="Search anime..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          flex: 1,
          padding: isMobile ? '10px 12px' : undefined
        }}
      />
      <button type="submit" style={{
        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
        color: '#fff',
        padding: '10px 18px',
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: 'nowrap',
        width: isMobile ? '100%' : 'auto'
      }}>
        Search
      </button>
      {query && (
        <button
          type="button"
          onClick={() => { setLoading(true); setQuery(''); setSearch('') }}
          style={{
            background: 'var(--bg3)',
            color: 'var(--text2)',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 14,
            width: isMobile ? '100%' : 'auto'
          }}
        >
          Clear
        </button>
      )}
    </form>
  )

  const renderWatching = () => (
    <div style={{
      width: isMobile ? '100%' : 240,
      flexShrink: 0,
      background: 'var(--bg3)',
      borderRadius: 16,
      padding: isMobile ? 12 : 20,
      border: '1px solid var(--border)'
    }}>
      <h3 style={{
        fontSize: isMobile ? 14 : 16,
        fontWeight: 700,
        marginBottom: 12,
        color: 'var(--text2)'
      }}>
        Currently Watching
      </h3>

      {!user ? (
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>
          Sign in to see your active shows.
        </div>
      ) : watchingLoading ? (
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>Loading...</div>
      ) : watching.length === 0 ? (
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>
          No currently watching shows yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {watching.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 8,
                padding: 8,
                borderRadius: 12,
                background: 'var(--bg2)',
                cursor: 'pointer'
              }}
              onClick={() => onSelect({
                mal_id: item.mal_id,
                title: item.title,
                title_english: item.title,
                images: { jpg: { large_image_url: item.poster, image_url: item.poster } }
              })}
            >
              <img
                src={item.poster || '/placeholder.jpg'}
                alt={item.title}
                style={{
                  width: isMobile ? 40 : 48,
                  height: isMobile ? 60 : 72,
                  borderRadius: 6,
                  objectFit: 'cover'
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text2)',
                  marginTop: 2
                }}>
                  Ep. {item.last_episode}
                  {item.total_episodes ? ` / ${item.total_episodes}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderAnimeGrid = () => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h2 style={{
        fontSize: isMobile ? 16 : 20,
        fontWeight: 700,
        marginBottom: isMobile ? 14 : 24,
        color: 'var(--text2)'
      }}>
        {query ? `Results for "${query}"` : '🔥 Top Anime'}
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>Loading...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: isMobile ? 10 : 20
        }}>
          {anime.map(a => (
            <AnimeCard
              key={a.mal_id}
              anime={a}
              user={user}
              onAuthRequired={onAuthRequired}
              onSelect={onSelect}
              compact={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: isMobile ? '12px' : '32px 24px'
    }}>
      {renderBanner()}
      {!query && (
        <div style={{
          textAlign: 'center',
          marginBottom: isMobile ? 20 : 48
        }}>
          <h1 style={{
            fontSize: isMobile ? 22 : 'clamp(32px, 6vw, 56px)',
            fontWeight: 900,
            marginBottom: 10,
            background: 'linear-gradient(135deg, #fff 30%, var(--accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Discover & Track Anime
          </h1>
          <p style={{
            color: 'var(--text2)',
            fontSize: isMobile ? 13 : 18,
            marginBottom: 0
          }}>
            Browse thousands of anime, build your watchlist, track your progress.
          </p>
        </div>
      )}
      {renderSearch()}

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {renderWatching()}
          {renderAnimeGrid()}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 24, minHeight: 400 }}>
          {renderAnimeGrid()}
          {renderWatching()}
        </div>
      )}
    </div>
  )
}