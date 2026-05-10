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

  useEffect(() => {
    setLoading(true)
    const url = query
      ? `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20&sfw=true`
      : `https://api.jikan.moe/v4/top/anime?limit=20`

    fetch(url)
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

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <section style={{
        marginBottom: 32,
        borderRadius: 18,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 180,
        background: 'linear-gradient(135deg, rgba(225,29,72,0.15), rgba(168,85,247,0.18))',
        border: '1px solid var(--border)'
      }}>
        <img
          src="/FuckCrunchyroll.png"
          alt="Banner"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.22
          }}
        />
        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '28px 24px',
          minHeight: 180,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
          backdropFilter: 'blur(2px)'
        }}>
          <p style={{
            fontSize: 13,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text2)',
            marginBottom: 10,
            fontWeight: 700
          }}>
            Gojo3mk
          </p>
          <h2 style={{
            fontSize: 'clamp(21px, 4vw, 41px)',
            lineHeight: 1.05,
            fontWeight: 900,
            color: '#fff',
            marginBottom: 10
          }}>
            Fuck Crunchyroll & Netflix, Watch Anime Your Way
          </h2>
          <p style={{
            maxWidth: 700,
            margin: '0 auto',
            color: 'rgba(255,255,255,0.78)',
            fontSize: 15
          }}>
            Discover new series, track episodes, and keep your watchlist in one place.
          </p>
        </div>
      </section>

      {!query && (
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 900,
            marginBottom: 16,
            background: 'linear-gradient(135deg, #fff 30%, var(--accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Discover & Track Anime
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 18, marginBottom: 32 }}>
            Browse thousands of anime, build your watchlist, track your progress.
          </p>
        </div>
      )}

      <form onSubmit={handleSearch} style={{
        display: 'flex',
        gap: 12,
        maxWidth: 560,
        margin: '0 auto 28px'
      }}>
        <input
          placeholder="Search anime..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" style={{
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          color: '#fff',
          padding: '10px 24px',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 14,
          whiteSpace: 'nowrap'
        }}>
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSearch('') }}
            style={{
              background: 'var(--bg3)',
              color: 'var(--text2)',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14
            }}
          >
            Clear
          </button>
        )}
      </form>

      <div style={{ display: 'flex', gap: 24, minHeight: 400 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 24,
            color: 'var(--text2)'
          }}>
            {query ? `Results for "${query}"` : '🔥 Top Anime'}
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>Loading...</div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 20
            }}>
              {anime.map(a => (
                <AnimeCard
                  key={a.mal_id}
                  anime={a}
                  user={user}
                  onAuthRequired={onAuthRequired}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{
          width: 240,
          flexShrink: 0,
          background: 'var(--bg3)',
          borderRadius: 16,
          padding: 20,
          border: '1px solid var(--border)'
        }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 16,
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {watching.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    padding: 8,
                    borderRadius: 12,
                    background: 'var(--bg2)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
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
                      width: 48,
                      height: 72,
                      borderRadius: 6,
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
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
      </div>
    </div>
  )
}