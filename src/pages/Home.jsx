import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Hero from '../components/Hero'
import Row from '../components/Row'
import MediaCard from '../components/MediaCard'
import WideCard from '../components/WideCard'
import { getPopularMovies, getPopularTV, getTmdbImage, searchTV } from '../lib/tmdb'
import { recentlyAiredEpisodes } from '../lib/anilist'
import { animeByMalIds, animeList, animeCategoryArt } from '../lib/anime'
import { udb } from '../lib/udb'
import { toast } from '../lib/toast'
import { PRIORITY_CATEGORIES, normalizeGenres, categoryPath } from '../lib/categories'

const backdrop = (path) => (path ? `https://image.tmdb.org/t/p/original${path}` : null)
const IMG = 'https://image.tmdb.org/t/p/w500'

// Fallback billboard if the popular picks can't load.
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

// Billboard slides carry what "My List" needs to save them.
const animeHero = (a) => ({
  kind: 'FEATURED ANIME',
  title: animeTitle(a),
  backdrop: a.banner || a.images?.jpg?.large_image_url,
  score: a.score,
  year: a.year,
  genres: normalizeGenres(a.genres),
  desc: a.synopsis,
  href: `/anime/${a.mal_id}`,
  save: { key: `anime:${a.mal_id}`, mal_id: a.mal_id, title: animeTitle(a), poster: a.images?.jpg?.large_image_url || null, score: a.score },
})
const movieHero = (m) => ({
  kind: 'FEATURED MOVIE', title: m.title, backdrop: backdrop(m.backdrop_path), score: m.vote_average,
  year: m.release_date?.slice(0, 4), desc: m.overview, href: `/movie/${m.id}`,
  save: { key: `movie:${m.id}`, media_type: 'movie', tmdb_id: m.id, title: m.title, poster: m.poster_path ? `${IMG}${m.poster_path}` : null, score: m.vote_average },
})
const tvHero = (s) => ({
  kind: 'FEATURED SERIES', title: s.name, backdrop: backdrop(s.backdrop_path), score: s.vote_average,
  year: s.first_air_date?.slice(0, 4), desc: s.overview, href: `/tv/${s.id}`,
  save: { key: `tv:${s.id}`, media_type: 'tv', tmdb_id: s.id, title: s.name, poster: s.poster_path ? `${IMG}${s.poster_path}` : null, score: s.vote_average },
})

export default function Home({ user, onAuthRequired }) {
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
  const [catArt, setCatArt] = useState({})
  const [listKeys, setListKeys] = useState(() => new Set())
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

  // What's already in My List (so the billboard button shows the right state).
  useEffect(() => {
    if (!user) { setListKeys(new Set()); return }
    let active = true
    udb.from('watchlist').select('mal_id, tmdb_id, media_type').eq('user_id', user.id).then(({ data }) => {
      if (!active) return
      setListKeys(new Set((data || []).map((r) => (r.tmdb_id ? `${r.media_type}:${r.tmdb_id}` : `anime:${r.mal_id}`))))
    })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    let active = true

    // Billboard: popular titles — three popular anime (with wide banners),
    // one popular movie and one popular show, re-picked on every visit.
    Promise.all([
      animeList('popular', 30),
      getPopularMovies().catch(() => null),
      getPopularTV().catch(() => null),
    ]).then(async ([pop, m, t]) => {
      if (!active) return
      setMovies(m?.results || [])
      setTv(t?.results || [])

      // AniList banners are tiny (~1900×400) and look soft when stretched over
      // the billboard, so look up the full-HD TMDB backdrop for the same show.
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
      const hdBackdrop = async (a) => {
        try {
          const names = [a.title_english, a.title].filter(Boolean)
          for (const n of names) {
            const r = await searchTV(n)
            const hit = (r?.results || []).find((x) => x.backdrop_path && (norm(x.name) === norm(n) || norm(x.original_name) === norm(n) || (norm(n).length > 6 && norm(x.name).includes(norm(n)))))
            if (hit) return backdrop(hit.backdrop_path)
          }
        } catch { /* keep the banner */ }
        return null
      }
      const animePicks = await Promise.all(
        shuffle(pop.filter((a) => a.banner && a.synopsis)).slice(0, 3).map(async (a) => {
          const hd = await hdBackdrop(a)
          const h = animeHero(a)
          return hd ? { ...h, backdrop: hd } : h
        })
      )
      const mv = shuffle((m?.results || []).slice(0, 10).filter((x) => x.backdrop_path && x.overview))[0]
      const sh = shuffle((t?.results || []).slice(0, 10).filter((x) => x.backdrop_path && x.overview))[0]
      let picks = shuffle([...animePicks, mv && movieHero(mv), sh && tvHero(sh)].filter(Boolean))

      if (!picks.length) picks = (await animeByMalIds(HERO_FALLBACK)).map(animeHero)
      if (!active) return
      setHeroList(picks)
      setLoading(false)
    })

    animeList('trending', 30).then((l) => { if (active) setTrending(l) })
    animeList('airing', 30).then((l) => { if (active) setAiring(l) })
    animeList('movies', 20).then((l) => { if (active) setAnimeMovies(l) })
    animeList('top', 20).then((l) => { if (active) setTopRated(l) })
    recentlyAiredEpisodes(24).then((eps) => { if (active) setRecentEps(eps) })
    animeCategoryArt(PRIORITY_CATEGORIES).then((art) => { if (active) setCatArt(art) })

    return () => { active = false }
  }, [])

  const isInList = useCallback((h) => !!h?.save && listKeys.has(h.save.key), [listKeys])

  const toggleList = async (h) => {
    if (!user) return onAuthRequired?.()
    const s = h?.save
    if (!s) return
    const has = listKeys.has(s.key)
    let error
    if (has) {
      const q = udb.from('watchlist').delete().eq('user_id', user.id)
      ;({ error } = await (s.tmdb_id ? q.eq('media_type', s.media_type).eq('tmdb_id', s.tmdb_id) : q.eq('mal_id', s.mal_id)))
    } else {
      const row = s.tmdb_id
        ? { user_id: user.id, media_type: s.media_type, tmdb_id: s.tmdb_id, title: s.title, poster: s.poster, score: s.score }
        : { user_id: user.id, mal_id: s.mal_id, title: s.title, poster: s.poster, score: s.score }
      ;({ error } = await udb.from('watchlist').insert(row))
    }
    if (error) { toast('Couldn’t update My List'); return }
    setListKeys((prev) => {
      const next = new Set(prev)
      if (has) next.delete(s.key); else next.add(s.key)
      return next
    })
    toast(has ? 'Removed from My List' : 'Added to My List')
  }

  // Wide banner art we already have, keyed by MAL id (for Continue watching).
  const bannerByMal = useMemo(() => {
    const m = new Map()
    for (const a of [...trending, ...airing, ...topRated, ...animeMovies]) if (a.banner) m.set(a.mal_id, a.banner)
    return m
  }, [trending, airing, topRated, animeMovies])

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
        <Hero items={heroList} onPlay={(h) => navigate(h.href)} isInList={isInList} onToggleList={toggleList} />
      )}

      {watching.length > 0 && (
        <Row title="Continue Watching" wide onMore={() => navigate('/currently-watching')}>
          {watching.map((i) => <WideCard key={watchKey(i)} item={wideWatch(i)} />)}
        </Row>
      )}

      <Row title="Browse by Category" wide>
        {PRIORITY_CATEGORIES.map((g) => {
          const a = catArt[g]
          return (
            <Link key={g} to={categoryPath(g)} className="cat-tile" title={a?.title ? `${g} · ${a.title}` : g}>
              {a?.banner && <img className="cat-tile-banner" src={a.banner} alt="" loading="lazy" />}
              {a?.poster && <img className={'cat-tile-poster' + (a.banner ? '' : ' only')} src={a.poster} alt="" loading="lazy" />}
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

      <Row title="Popular Movies" loading={!movies.length} onMore={() => navigate('/movies')}>
        {movies.map((m) => <MediaCard key={m.id} item={movieCard(m)} />)}
      </Row>

      <Row title="Popular TV Shows" loading={!tv.length} onMore={() => navigate('/tv')}>
        {tv.map((s) => <MediaCard key={s.id} item={tvCard(s)} />)}
      </Row>

      <Row title="Anime Movies" loading={!animeMovies.length}>
        {animeMovies.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
      </Row>

      <Row title="Highest Rated Anime" loading={!topRated.length}>
        {topRated.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
      </Row>
    </div>
  )
}
