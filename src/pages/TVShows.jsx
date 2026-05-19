import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPopularTV, searchTV, getTmdbImage } from '../lib/tmdb'

export default function TVShows() {
  const navigate = useNavigate()
  const [shows, setShows] = useState([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setErrorMsg('')
      try {
        const data = query
          ? await searchTV(query)
          : await getPopularTV()

        setShows(data?.results || [])
      } catch (err) {
        console.error('TV load error:', err)
        setErrorMsg(err.message || 'Failed to load TV shows.')
        setShows([])
      }
      setLoading(false)
    }

    load()
  }, [query])

  const handleSearch = (e) => {
    e.preventDefault()
    setQuery(search.trim())
  }

  return (
    <div
      style={{
        maxWidth: 1300,
        margin: '0 auto',
        padding: isMobile ? '12px' : '28px 24px'
      }}
    >
      <div style={{ marginBottom: isMobile ? 18 : 28 }}>
        <h1
          style={{
            fontSize: isMobile ? 24 : 38,
            fontWeight: 900,
            marginBottom: 8
          }}
        >
          TV Shows
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: isMobile ? 13 : 15 }}>
          Browse popular TV shows or search for a title.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 22,
          flexDirection: isMobile ? 'column' : 'row'
        }}
      >
        <input
          placeholder="Search TV shows..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: 8
          }}
        />
        <button
          type="submit"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 8,
            fontWeight: 700
          }}
        >
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setQuery('')
            }}
            style={{
              background: 'var(--bg3)',
              color: 'var(--text)',
              padding: '12px 16px',
              borderRadius: 8
            }}
          >
            Clear
          </button>
        )}
      </form>

      <h2
        style={{
          fontSize: isMobile ? 16 : 22,
          fontWeight: 800,
          marginBottom: 16
        }}
      >
        {query ? `Results for "${query}"` : 'Popular TV Shows'}
      </h2>

      {errorMsg ? (
        <div style={{ color: '#ef4444', padding: 40, textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, border: '1px solid #ef4444' }}>
          {errorMsg}
        </div>
      ) : loading ? (
        <div style={{ color: 'var(--text2)', padding: 40, textAlign: 'center' }}>
          Loading...
        </div>
      ) : shows.length === 0 ? (
        <div style={{ color: 'var(--text2)', padding: 40, textAlign: 'center' }}>
          No TV shows found.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'repeat(2, minmax(0, 1fr))'
              : 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: isMobile ? 12 : 18
          }}
        >
          {shows.map(show => (
            <div
              key={show.id}
              onClick={() => navigate(`/tv/${show.id}`)}
              style={{
                cursor: 'pointer',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                overflow: 'hidden'
              }}
            >
              <img
                src={getTmdbImage(show.poster_path)}
                alt={show.name}
                style={{
                  width: '100%',
                  aspectRatio: '2 / 3',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
              <div style={{ padding: 12 }}>
                <div
                  style={{
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    marginBottom: 6,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {show.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {show.first_air_date ? show.first_air_date.slice(0, 4) : 'N/A'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}