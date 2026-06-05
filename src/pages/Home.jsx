import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import { supabase } from '../supabase'

async function fetchJikan(url, retries = 3) {
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

export default function Home({ user, onAuthRequired }) {
  const navigate = useNavigate()

  const [anime, setAnime] = useState([])
  const [watching, setWatching] = useState([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [watchingLoading, setWatchingLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const [watchingExpanded, setWatchingExpanded] = useState(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setWatchingExpanded(!isMobile)
  }, [isMobile])

  useEffect(() => {
    setLoading(true)

    const url = query
      ? `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20&sfw=true`
      : `https://api.jikan.moe/v4/top/anime?limit=20`

    fetchJikan(url)
      .then(r => r.json())
      .then(d => {
        setAnime(d.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
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
    setQuery(search.trim())
  }

  const getWatchingHref = (item) => {
    if (item.media_type === 'tv' && item.tmdb_id) return `/tv/${item.tmdb_id}`
    if (item.media_type === 'movie' && item.tmdb_id) return `/movie/${item.tmdb_id}`
    if (item.mal_id) return `/anime/${item.mal_id}`
    return '/'
  }

  const getWatchingMeta = (item) => {
    if (item.media_type === 'tv') {
      return `S${item.season_number || 1} • E${item.last_episode || 1}`
    }

    if (item.media_type === 'movie') {
      return 'Movie'
    }

    return `Ep. ${item.last_episode || 1}${item.total_episodes ? ` / ${item.total_episodes}` : ''}`
  }

  const getWatchingType = (item) => {
    if (item.media_type === 'tv') return 'TV'
    if (item.media_type === 'movie') return 'Movie'
    return 'Anime'
  }

  

  const renderSearch = () => (
    <form
      onSubmit={handleSearch}
      style={{
        display: 'flex',
        gap: 8,
        maxWidth: isMobile ? '100%' : 560,
        margin: '0 auto 20px',
        flexDirection: isMobile ? 'column' : 'row'
      }}
    >
      <input
        placeholder="Search anime..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          flex: 1,
          padding: isMobile ? '12px 14px' : '10px 14px',
          background: 'var(--bg3)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          outline: 'none',
          fontSize: 14,
          minHeight: 44
        }}
      />

      <button
        type="submit"
        style={{
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 10,
          fontWeight: 700,
          fontSize: 14,
          whiteSpace: 'nowrap',
          width: isMobile ? '100%' : 'auto',
          minHeight: 44
        }}
      >
        Search
      </button>

      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('')
            setSearch('')
          }}
          style={{
            background: 'var(--bg3)',
            color: 'var(--text2)',
            border: '1px solid var(--border)',
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            width: isMobile ? '100%' : 'auto',
            minHeight: 44
          }}
        >
          Clear
        </button>
      )}
    </form>
  )

  const renderWatching = () => {
    const mobilePreviewCount = 3
    const visibleItems =
      isMobile && !watchingExpanded ? watching.slice(0, mobilePreviewCount) : watching

    return (
      <div
        style={{
          width: isMobile ? '100%' : 260,
          flexShrink: 0,
          background: 'var(--bg3)',
          borderRadius: 16,
          padding: isMobile ? 12 : 20,
          border: '1px solid var(--border)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: isMobile ? 8 : 12
          }}
        >
          <div>
            <h3
              style={{
                fontSize: isMobile ? 14 : 16,
                fontWeight: 700,
                color: 'var(--text2)',
                marginBottom: 2
              }}
            >
              Currently Watching
            </h3>

            {user && !watchingLoading && watching.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                {watching.length} active
              </div>
            )}
          </div>

          {isMobile && user && watching.length > 0 && (
            <button
              type="button"
              onClick={() => setWatchingExpanded(prev => !prev)}
              style={{
                background: 'var(--bg2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1
              }}
            >
              {watchingExpanded ? 'Hide' : 'Show'}
            </button>
          )}
        </div>

        {!user ? (
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>
            Sign in to see your active titles.
          </div>
        ) : watchingLoading ? (
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>Loading...</div>
        ) : watching.length === 0 ? (
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>
            No currently watching titles yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleItems.map(item => (
              <div
                key={item.id}
                onClick={() => navigate(getWatchingHref(item))}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: isMobile ? 7 : 8,
                  borderRadius: 12,
                  background: 'var(--bg2)',
                  cursor: 'pointer',
                  alignItems: 'center'
                }}
              >
                <img
                  src={item.poster || '/placeholder.jpg'}
                  alt={item.title}
                  style={{
                    width: isMobile ? 38 : 48,
                    height: isMobile ? 54 : 72,
                    borderRadius: 6,
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 2
                    }}
                  >
                    <div
                      style={{
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.title}
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--accent)',
                        background: 'rgba(225,29,72,0.12)',
                        border: '1px solid rgba(225,29,72,0.2)',
                        borderRadius: 999,
                        padding: '2px 6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      {getWatchingType(item)}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text2)',
                      marginTop: 2
                    }}
                  >
                    {getWatchingMeta(item)}
                  </div>
                </div>
              </div>
            ))}

            {isMobile && watching.length > mobilePreviewCount && !watchingExpanded && (
              <button
                type="button"
                onClick={() => setWatchingExpanded(true)}
                style={{
                  marginTop: 2,
                  background: 'transparent',
                  color: 'var(--accent)',
                  border: '1px dashed rgba(225,29,72,0.28)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Show {watching.length - mobilePreviewCount} more
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderBrowseButtons = () => (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: isMobile ? 14 : 20,
        justifyContent: isMobile ? 'stretch' : 'flex-start'
      }}
    >
      <button
        type="button"
        onClick={() => navigate('/tv')}
        style={{
          flex: isMobile ? '1 1 0' : '0 0 auto',
          background: 'var(--bg3)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          padding: isMobile ? '10px 12px' : '10px 16px',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          minHeight: 42
        }}
      >
        📺 TV Shows
      </button>

      <button
        type="button"
        onClick={() => navigate('/movies')}
        style={{
          flex: isMobile ? '1 1 0' : '0 0 auto',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          color: '#fff',
          padding: isMobile ? '10px 12px' : '10px 16px',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          minHeight: 42
        }}
      >
        🎬 Movies
      </button>
    </div>
  )

  const renderAnimeGrid = () => (
    <div style={{ flex: 1, minWidth: 0 }}>
      {renderBrowseButtons()}

      <h2
        style={{
          fontSize: isMobile ? 16 : 20,
          fontWeight: 700,
          marginBottom: isMobile ? 14 : 24,
          color: 'var(--text2)'
        }}
      >
        {query ? `Results for "${query}"` : '🔥 Top Anime'}
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
          Loading...
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'repeat(2, minmax(0, 1fr))'
              : 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: isMobile ? 10 : 20
          }}
        >
          {anime.map(a => (
            <AnimeCard
              key={a.mal_id}
              anime={a}
              user={user}
              onAuthRequired={onAuthRequired}
              compact={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ padding: isMobile ? 12 : 24 }}>
      
      {renderSearch()}
      <div style={{ display: 'flex', gap: 24, flexDirection: isMobile ? 'column' : 'row' }}>
        {renderWatching()}
        {renderAnimeGrid()}
      </div>
    </div>
  )
}