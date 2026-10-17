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

// Line glyphs for the three big tiles.
const glyph = (d) => <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const GLYPH = {
  Anime: glyph(<><path d="M24 5l4.6 12.4L41 22l-12.4 4.6L24 39l-4.6-12.4L7 22l12.4-4.6z" /><path d="M38 34l1.6 4.4L44 40l-4.4 1.6L38 46l-1.6-4.4L32 40l4.4-1.6z" /></>),
  Movies: glyph(<><rect x="5" y="14" width="38" height="27" rx="4" /><path d="M5 22h38M13 14l5 8M24 14l5 8M35 14l5 8" /><path d="M5 14l4-8 34 4-2 4" /></>),
  TV: glyph(<><rect x="5" y="10" width="38" height="26" rx="4" /><path d="M17 43h14M24 36v7" /><path d="M20 17l11 6-11 6z" /></>),
}

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
  const [tick, setTick] = useState(0)

  const sources = useMemo(() => {
    if (!isGenre) return []
    const s = [SOURCES[0]]
    if (TMDB_MOVIE_GENRE[sel]) s.push(SOURCES[1])
    if (TMDB_TV_GENRE[sel]) s.push(SOURCES[2])
    return s
  }, [isGenre, sel])

  // Genre tile art: the top title of each category. (The three big tiles are designed, not photos.)
  useEffect(() => {
    let alive = true
    animeCategoryArt(CATEGORIES).then((a) => { if (alive) setArt(a || {}) }).catch(() => {})
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
          <button key={g.key} type="button" className={'y-bg-tile bg-' + g.key.toLowerCase() + (sel === g.key ? ' on' : '')} onClick={() => pick(g.key)} aria-pressed={sel === g.key}>
            <span className="y-bg-glyph" aria-hidden="true">{GLYPH[g.key]}</span>
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
