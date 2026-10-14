import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Hero from '../components/Hero'
import Row from '../components/Row'
import MediaCard from '../components/MediaCard'
import WideCard from '../components/WideCard'
import { getPopularMovies, getPopularTV, getTmdbImage } from '../lib/tmdb'
import { recentlyAiredEpisodes } from '../lib/anilist'
import { animeByMalIds, animeList } from '../lib/anime'
import { udb } from '../lib/udb'
import { PRIORITY_CATEGORIES, normalizeGenres, categoryPath } from '../lib/categories'

const backdrop = (path) => (path ? `https://image.tmdb.org/t/p/original${path}` : null)

// Fallback billboard if the random picks can't load.
const HERO_FALLBACK = [57658, 37991, 16498, 21, 5114]

// "just now" / "3h ago" / "2d ago" from a unix-seconds timestamp.
function timeAgo(unix) {
  if (!unix) return ''
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unix)
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const shuffle = (arr) => arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1])
const animeTitle = (a) => a.title_english || a.title
const animeMeta = (a) => [a.score ? `★ ${Number(a.score).toFixed(1)}` : null, a.type, a.episodes ? `${a.episodes} eps` : null].filter(Boolean).join(' · ')

const animeHero = (a) => ({
  kind: 'FEATURED TODAY',
  title: animeTitle(a),
  backdrop: a.banner || a.images?.jpg?.large_image_url,
  score: a.score,
  year: a.year,
  genres: normalizeGenres(a.genres),
  desc: a.synopsis,
  href: `/anime/${a.mal_id}`,
})

export default function Home({ user }) {
  const navigate = useNavigate()
  const [heroList, setHeroList] = useState([])
  const [recentEps, setRecentEps] = useState([])
  const [trending, setTrending] = useState([])
  const [airing, setAiring] = useState([])
  const [animeMovies, setAnimeMovies] = useState([])
  const [topRated, setTopRated] = useState([])
  const [movies, setMovies] = useState([])
  const [tv, setTv] = useState([])
  const [watching, setWatching] = useState([])
  const [loading, setLoading] = useState(true)

  // Currently Watching — sourced from the database (not local storage).
  useEffect(() => {
    if (!user) { setWatching([]); return }
    let active = true
    ;(async () => {
      const [a, t] = await Promise.all([
        udb.from('currently_watching').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        udb.from('currently_watching_tmdb').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      ])
      if (!active) return
      const merged = [
        ...(a.data || []).map((i) => ({ ...i, source_table: 'currently_watching' })),
        ...(t.data || []).map((i) => ({ ...i, source_table: 'currently_watching_tmdb' })),
      ]
        .filter((i) => !i.is_completed)
        .sort((x, y) => new Date(y.updated_at) - new Date(x.updated_at))
      setWatching(merged)
    })()
    return () => { active = false }
  }, [user])

  useEffect(() => {
    let active = true

    // Billboard: a random mix of trending anime (with wide banners) plus one
    // popular movie and one popular show. New picks on every visit.
    Promise.all([
      animeList('trending', 30),
      getPopularMovies().catch(() => null),
      getPopularTV().catch(() => null),
    ]).then(async ([tr, m, t]) => {
      if (!active) return
      setTrending(tr)
      setMovies(m?.results || [])
      setTv(t?.results || [])

      const animePicks = shuffle(tr.filter((a) => a.banner && a.synopsis)).slice(0, 3).map(animeHero)
      const mv = shuffle((m?.results || []).filter((x) => x.backdrop_path && x.overview))[0]
      const sh = shuffle((t?.results || []).filter((x) => x.backdrop_path && x.overview))[0]
      const extra = [
        mv && { kind: 'FEATURED MOVIE', title: mv.title, backdrop: backdrop(mv.backdrop_path), score: mv.vote_average, year: mv.release_date?.slice(0, 4), desc: mv.overview, href: `/movie/${mv.id}` },
        sh && { kind: 'FEATURED SERIES', title: sh.name, backdrop: backdrop(sh.backdrop_path), score: sh.vote_average, year: sh.first_air_date?.slice(0, 4), desc: sh.overview, href: `/tv/${sh.id}` },
      ].filter(Boolean)
      let picks = shuffle([...animePicks, ...extra])

      if (!picks.length) {
        const list = await animeByMalIds(HERO_FALLBACK)
        picks = list.map(animeHero)
      }
      if (!active) return
      setHeroList(picks)
      setLoading(false)
    })

    animeList('airing', 30).then((l) => { if (active) setAiring(l) })
    animeList('movies', 20).then((l) => { if (active) setAnimeMovies(l) })
    animeList('top', 20).then((l) => { if (active) setTopRated(l) })
    recentlyAiredEpisodes(24).then((eps) => { if (active) setRecentEps(eps) })

    return () => { active = false }
  }, [])

  // Wide banner art we already have, keyed by MAL id (for Continue watching).
  const bannerByMal = useMemo(() => {
    const m = new Map()
    for (const a of [...trending, ...airing, ...topRated, ...animeMovies]) if (a.banner) m.set(a.mal_id, a.banner)
    return m
  }, [trending, airing, topRated, animeMovies])

  // Art for the category tiles: banners (PC) + posters (phone), no repeats.
  const catArt = useMemo(() => {
    const seen = new Set()
    return [...trending, ...airing, ...topRated].filter((a) => a.banner && !seen.has(a.mal_id) && seen.add(a.mal_id))
  }, [trending, airing, topRated])

  const watchKey = (i) => `${i.source_table}-${i.id}`
  const watchHref = (i) => (i.media_type === 'tv' && i.tmdb_id ? `/tv/${i.tmdb_id}` : i.media_type === 'movie' && i.tmdb_id ? `/movie/${i.tmdb_id}` : i.mal_id ? `/anime/${i.mal_id}` : '/')
  const watchMeta = (i) => i.media_type === 'tv' ? `S${i.season_number || 1} · E${i.last_episode || 1}` : i.media_type === 'movie' ? 'Movie' : `Ep. ${i.last_episode || 1}${i.total_episodes ? ` / ${i.total_episodes}` : ''}`
  const watchFrac = (i) => (i.total_episodes && i.last_episode ? Math.min(1, i.last_episode / i.total_episodes) : 0)

  const animeCard = (a) => ({
    href: `/anime/${a.mal_id}`,
    poster: a.images?.jpg?.large_image_url,
    title: animeTitle(a),
    score: a.score,
    kind: a.type,
  })
  const epCard = (e) => ({
    href: `/anime/${e.malId}`,
    poster: e.poster,
    title: e.title,
    score: e.score,
    kind: `EP ${e.episode}`,
    sub: timeAgo(e.airingAt),
  })
  const movieCard = (m) => ({ href: `/movie/${m.id}`, poster: getTmdbImage(m.poster_path), title: m.title, score: m.vote_average, sub: m.release_date?.slice(0, 4) })
  const tvCard = (s) => ({ href: `/tv/${s.id}`, poster: getTmdbImage(s.poster_path), title: s.name, score: s.vote_average, sub: s.first_air_date?.slice(0, 4) })
  const wideAnime = (a) => ({ href: `/anime/${a.mal_id}`, banner: a.banner, poster: a.images?.jpg?.large_image_url, title: animeTitle(a), meta: animeMeta(a) })
  const wideWatch = (i) => ({
    href: watchHref(i),
    banner: i.mal_id ? bannerByMal.get(i.mal_id) : null,
    poster: i.poster,
    title: i.title,
    meta: watchMeta(i),
    progress: watchFrac(i) || 0.04,
  })

  const airingWide = airing.filter((a) => a.banner)

  return (
    <div className="page home" style={{ paddingTop: 0 }}>
      {loading ? (
        <div className="skel" style={{ height: 'clamp(420px,56vw,82vh)', margin: '0 calc(-1 * clamp(16px,4vw,60px))', borderRadius: 0 }} />
      ) : (
        <Hero items={heroList} onPlay={(h) => navigate(h.href)} />
      )}

      {watching.length > 0 && (
        <Row title="Continue Watching" wide onMore={() => navigate('/currently-watching')}>
          {watching.map((i) => <WideCard key={watchKey(i)} item={wideWatch(i)} />)}
        </Row>
      )}

      <Row title="Browse by Category" wide>
        {PRIORITY_CATEGORIES.map((g, i) => {
          const a = catArt.length ? catArt[(i * 2) % catArt.length] : null
          return (
            <Link key={g} to={categoryPath(g)} className="cat-tile">
              {a?.banner && <img className="cat-tile-banner" src={a.banner} alt="" loading="lazy" />}
              {a && <img className="cat-tile-poster" src={a.images?.jpg?.large_image_url} alt="" loading="lazy" />}
              <span>{g}</span>
            </Link>
          )
        })}
      </Row>

      <Row title="Top 10 This Week" loading={!trending.length}>
        {trending.slice(0, 10).map((a, i) => <MediaCard key={a.mal_id} item={{ ...animeCard(a), rank: i + 1 }} />)}
      </Row>

      <Row title="Trending Now" loading={!trending.length} onMore={() => navigate('/anime')}>
        {trending.slice(10).map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
      </Row>

      <Row title="Currently Airing" wide loading={!airing.length} onMore={() => navigate('/anime')}>
        {airingWide.map((a) => <WideCard key={a.mal_id} item={wideAnime(a)} />)}
      </Row>

      <Row title="New Episodes" loading={!recentEps.length}>
        {recentEps.map((e) => <MediaCard key={e.malId} item={epCard(e)} />)}
      </Row>

      <Row title="Anime Movies" loading={!animeMovies.length}>
        {animeMovies.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
      </Row>

      <Row title="Popular Movies" loading={!movies.length} onMore={() => navigate('/movies')}>
        {movies.map((m) => <MediaCard key={m.id} item={movieCard(m)} />)}
      </Row>

      <Row title="Popular TV Shows" loading={!tv.length} onMore={() => navigate('/tv')}>
        {tv.map((s) => <MediaCard key={s.id} item={tvCard(s)} />)}
      </Row>

      <Row title="Highest Rated Anime" loading={!topRated.length}>
        {topRated.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
      </Row>
    </div>
  )
}
