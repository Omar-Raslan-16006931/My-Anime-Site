import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import { fetchGroup, fetchPage } from '../lib/browse'
import { animeCategoryArt, animeList } from '../lib/anime'
import { CATEGORIES, TMDB_MOVIE_GENRE, TMDB_TV_GENRE } from '../lib/categories'
import { getPopularMovies, getPopularTV, getTmdbImage } from '../lib/tmdb'

const GROUPS = [
  { key: 'Anime', to: '/anime', blurb: 'Simulcasts, classics and everything between.' },
  { key: 'Movies', to: '/movies', blurb: 'Features, premieres and anime films.' },
  { key: 'TV', to: '/tv', blurb: 'Series from around the world.' },
]
const SOURCES = [{ key: 'anime', label: 'Anime' }, { key: 'movie', label: 'Movies' }, { key: 'tv', label: 'TV' }]

// Browse: three big tiles (Anime / Movies / TV), a tile per genre and a grid of
// whatever is selected underneath.
export default function Browse({ embedded = false }) {
  const [params, setParams] = useSearchParams()
  const sel = params.get('c') || 'Anime'
  const isGenre = CATEGORIES.includes(sel)
  const [source, setSource] = useState('anime')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState(false)
  const [art, setArt] = useState({})
  const [groupArt, setGroupArt] = useState({})
  const [tick, setTick] = useState(0)

  const sources = useMemo(() => {
    if (!isGenre) return []
    const s = [SOURCES[0]]
    if (TMDB_MOVIE_GENRE[sel]) s.push(SOURCES[1])
    if (TMDB_TV_GENRE[sel]) s.push(SOURCES[2])
    return s
  }, [isGenre, sel])

  // Tile art: the top title of each category + a backdrop for each group.
  useEffect(() => {
    let alive = true
    animeCategoryArt(CATEGORIES).then((a) => { if (alive) setArt(a || {}) }).catch(() => {})
    Promise.all([animeList('trending', 12).catch(() => []), getPopularMovies().catch(() => null), getPopularTV().catch(() => null)]).then(([a, m, t]) => {
      if (!alive) return
      const bd = (x) => (x?.backdrop_path ? getTmdbImage(x.backdrop_path, 'w780') : null)
      setGroupArt({
        Anime: (a || []).find((x) => x.banner)?.banner || null,
        Movies: bd((m?.results || []).find((x) => x.backdrop_path)),
        TV: bd((t?.results || []).find((x) => x.backdrop_path)),
      })
    })
    return () => { alive = false }
  }, [])

  useEffect(() => { setSource('anime') }, [sel])

  useEffect(() => {
    let alive = true
    setLoading(true); setError(false); setItems([]); setPage(1); setHasNext(false)
    ;(async () => {
      try {
        const r = isGenre ? await fetchPage(source, sel, 1) : await fetchGroup(sel, 1)
        if (!alive) return
        setItems(r.items); setHasNext(r.hasNext); setError(!!r.failed)
      } catch {
        if (alive) setError(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [sel, source, isGenre, tick])

  const loadMore = async () => {
    setMore(true)
    try {
      const r = isGenre ? await fetchPage(source, sel, page + 1) : await fetchGroup(sel, page + 1)
      setItems((cur) => {
        const seen = new Set(cur.map((i) => i.href))
        return [...cur, ...r.items.filter((i) => !seen.has(i.href))]
      })
      setHasNext(r.hasNext); setPage((p) => p + 1)
    } catch { /* keep what we have */ }
    setMore(false)
  }

  const pick = (c) => setParams({ c }, { replace: true })

  return (
    <div className={embedded ? 'y-browse y-browse-embed' : 'y-page y-browse'}>
      {!embedded && <h1 className="y-title-xl">Browse</h1>}

      <div className="y-bg-grid">
        {GROUPS.map((g) => (
          <button key={g.key} type="button" className={'y-bg-tile' + (sel === g.key ? ' on' : '')} onClick={() => pick(g.key)} aria-pressed={sel === g.key}>
            {groupArt[g.key] && <img src={groupArt[g.key]} alt="" loading="lazy" />}
            <span className="y-bg-word" aria-hidden="true">{g.key}</span>
            <span className="y-bg-name">{g.key}</span>
            <span className="y-bg-blurb">{g.blurb}</span>
          </button>
        ))}
      </div>

      <div className="y-gen-grid">
        {CATEGORIES.map((g) => (
          <button key={g} type="button" className={'y-gen-tile' + (sel === g ? ' on' : '')} onClick={() => pick(g)} aria-pressed={sel === g}>
            {art[g]?.banner || art[g]?.poster ? <img src={art[g].banner || art[g].poster} alt="" loading="lazy" className={art[g].banner ? '' : 'poster'} /> : null}
            <span>{g}</span>
          </button>
        ))}
      </div>

      <div className="y-bg-head">
        <h2>{sel}</h2>
        {!loading && !error && items.length > 0 && <span className="y-eyebrow">{items.length}{hasNext ? '+' : ''} titles</span>}
        {sources.length > 1 && (
          <div className="y-chips y-bg-src">
            {sources.map((s) => <button key={s.key} type="button" className={'y-chip' + (source === s.key ? ' on' : '')} onClick={() => setSource(s.key)}>{s.label}</button>)}
          </div>
        )}
        {!isGenre && <Link className="y-bg-all" to={GROUPS.find((g) => g.key === sel)?.to || '/anime'}>See everything →</Link>}
      </div>

      {loading ? (
        <div className="grid y-grid">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="y-skel skel-poster" />)}</div>
      ) : error ? (
        <div className="y-empty"><div className="y-empty-h">Couldn’t load this.</div><button type="button" className="y-btn solid" onClick={() => setTick((n) => n + 1)}>Retry</button></div>
      ) : !items.length ? (
        <div className="y-empty"><div className="y-empty-h">Nothing here yet.</div></div>
      ) : (
        <>
          <div className="grid y-grid">{items.map((it) => <MediaCard key={it.href} item={it} />)}</div>
          {hasNext && (
            <div style={{ textAlign: 'center', margin: '18px 0 8px' }}>
              <button type="button" className="y-btn" onClick={loadMore} disabled={more}>{more ? 'Loading…' : 'Load more'}</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
