import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Hero, { HeroPlaceholder } from '../components/Hero'
import Row from '../components/Row'
import Collapse from '../components/Collapse'
import MediaCard from '../components/MediaCard'
import WideCard from '../components/WideCard'
import ContinueCard from '../components/ContinueCard'
import { NextSimulcast, SurpriseCard, MoodSection } from '../components/HomeBlocks'
import { useProfiles } from '../lib/profiles'
import { getPopularMovies, getPopularTV, getTrendingWeek, getTmdbImage, searchTV } from '../lib/tmdb'
import { recentlyAiredEpisodes } from '../lib/anilist'
import { animeByMalIds, animeList, animeCategoryArt } from '../lib/anime'
import { udb } from '../lib/udb'
import { markWatched } from '../lib/watched'
import { toast } from '../lib/toast'
import { PRIORITY_CATEGORIES, normalizeGenres, categoryPath } from '../lib/categories'

// w1280 is plenty for a full-width billboard; `original` is often 4K and several MB.
const backdrop = (path) => (path ? `https://image.tmdb.org/t/p/w1280${path}` : null)
const IMG = 'https://image.tmdb.org/t/p/w500'

// Nothing rated below this is featured on the billboard.
const MIN_FEATURED = 8
// Nothing rated below this appears anywhere on the home page.
const MIN_HOME = 7
const okA = (a) => (a?.score || 0) >= MIN_HOME
const okT = (x) => (x?.vote_average || 0) >= MIN_HOME

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

// Billboard slides carry what "My List" needs to save them.
const animeHero = (a) => ({
  type: 'Anime',
  title: animeTitle(a),
  poster: a.images?.jpg?.large_image_url,
  backdrop: a.banner || a.images?.jpg?.large_image_url,
  score: a.score,
  year: a.year,
  genres: normalizeGenres(a.genres),
  desc: a.synopsis,
  href: `/anime/${a.mal_id}`,
  save: { key: `anime:${a.mal_id}`, mal_id: a.mal_id, title: animeTitle(a), poster: a.images?.jpg?.large_image_url || null, score: a.score },
})
const movieHero = (m) => ({
  type: 'Movie', title: m.title, backdrop: backdrop(m.backdrop_path), poster: m.poster_path ? `${IMG}${m.poster_path}` : null, score: m.vote_average,
  year: m.release_date?.slice(0, 4), desc: m.overview, href: `/movie/${m.id}`,
  save: { key: `movie:${m.id}`, media_type: 'movie', tmdb_id: m.id, title: m.title, poster: m.poster_path ? `${IMG}${m.poster_path}` : null, score: m.vote_average },
})
const tvHero = (s) => ({
  type: 'Series', title: s.name, backdrop: backdrop(s.backdrop_path), poster: s.poster_path ? `${IMG}${s.poster_path}` : null, score: s.vote_average,
  year: s.first_air_date?.slice(0, 4), desc: s.overview, href: `/tv/${s.id}`,
  save: { key: `tv:${s.id}`, media_type: 'tv', tmdb_id: s.id, title: s.name, poster: s.poster_path ? `${IMG}${s.poster_path}` : null, score: s.vote_average },
})

const HIDE_KEY = 'yoru:cw-hidden'
const readHidden = () => { try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY) || '[]')) } catch { return new Set() } }

// Home rows survive leaving and coming back; they reload only on app open or a full page reload.
const homeCache = {}
// The last billboard is kept on the device, so the slideshow shows instantly on the next app open.
// Fresh picks are fetched quietly in the background and shown the time after (never swapped mid-view).
const HERO_KEY = 'yoru:hero'
const readHero = () => { try { const v = JSON.parse(localStorage.getItem(HERO_KEY) || 'null'); return v && Date.now() - v.at < 7 * 864e5 && v.list?.length ? v.list : null } catch { return null } }
const saveHero = (list) => { try { localStorage.setItem(HERO_KEY, JSON.stringify({ at: Date.now(), list })) } catch { /* ignore */ } }
if (!homeCache.heroList) { const h = readHero(); if (h) { homeCache.heroList = h; homeCache.heroFromDevice = true } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Account data (Continue watching, My List) survives page switches, so coming back to Home shows it
// at once and refreshes quietly, instead of the row popping in again every time.
const acctCache = { uid: null, watching: null, list: null }
// Another profile has its own list and history: drop what was cached for the previous one.
if (typeof window !== 'undefined') window.addEventListener('yoru:profile-data', () => { acctCache.uid = null; acctCache.watching = null; acctCache.list = null })

export default function Home({ user, onAuthRequired }) {
  const navigate = useNavigate()
  const { profiles, active } = useProfiles()
  const me = active || profiles[0]
  const [hidden, setHidden] = useState(readHidden)
  const [heroList, setHeroList] = useState(homeCache.heroList || [])
  const [recentEps, setRecentEps] = useState(homeCache.recentEps || [])
  const [trending, setTrending] = useState(homeCache.trending || [])
  const [airing, setAiring] = useState(homeCache.airing || [])
  const [animeMovies, setAnimeMovies] = useState(homeCache.animeMovies || [])
  const [topRated, setTopRated] = useState(homeCache.topRated || [])
  const [movies, setMovies] = useState(homeCache.movies || [])
  const [tv, setTv] = useState(homeCache.tv || [])
  const [watching, setWatching] = useState(() => (user && acctCache.uid === user.id && acctCache.watching) || [])
  const [watchReady, setWatchReady] = useState(() => !!(user && acctCache.uid === user.id && acctCache.watching))
  const lastWatch = useRef([])
  const [catArt, setCatArt] = useState(homeCache.catArt || {})
  const [listKeys, setListKeys] = useState(() => (user && acctCache.uid === user.id && acctCache.list) || new Set())
  const [weekTop, setWeekTop] = useState(homeCache.weekTop || [])
  const [loading, setLoading] = useState(!homeCache.heroList?.length)

  // Currently Watching — sourced from the database (not local storage).
  useEffect(() => {
    if (!user) { setWatching([]); setWatchReady(false); return }
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
      if (acctCache.uid !== user.id) { acctCache.uid = user.id; acctCache.list = null }
      acctCache.watching = merged
      setWatching(merged); setWatchReady(true)
    })()
    return () => { active = false }
  }, [user])

  // What's already in My List (so the billboard button shows the right state).
  useEffect(() => {
    if (!user) { setListKeys(new Set()); return }
    let active = true
    udb.from('watchlist').select('mal_id, tmdb_id, media_type').eq('user_id', user.id).then(({ data }) => {
      if (!active) return
      const keys = new Set((data || []).map((r) => (r.tmdb_id ? `${r.media_type}:${r.tmdb_id}` : `anime:${r.mal_id}`)))
      if (acctCache.uid !== user.id) { acctCache.uid = user.id; acctCache.watching = null }
      acctCache.list = keys
      setListKeys(keys)
    })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    let active = true
    const sync = () => {
      setHeroList(homeCache.heroList || []); setRecentEps(homeCache.recentEps || []); setTrending(homeCache.trending || [])
      setAiring(homeCache.airing || []); setAnimeMovies(homeCache.animeMovies || []); setTopRated(homeCache.topRated || [])
      setMovies(homeCache.movies || []); setTv(homeCache.tv || []); setCatArt(homeCache.catArt || {}); setWeekTop(homeCache.weekTop || [])
      if (homeCache.heroList?.length) setLoading(false)
    }
    // Already loaded (or loading) in this session: reuse it instead of refetching.
    if (homeCache.promise) {
      sync()
      homeCache.promise.then(() => { if (active) sync() })
      return () => { active = false }
    }
    // Results always land in the cache, even if Home unmounted mid-load.
    const put = (key, setter) => (val) => { homeCache[key] = val; if (active) setter(val) }
    const putMovies = put('movies', setMovies)
    const putTv = put('tv', setTv)
    const putHero = put('heroList', setHeroList)

    // Billboard: popular titles — three popular anime (with wide banners),
    // one popular movie and one popular show, re-picked on every visit.
    const pHero = Promise.all([
      animeList('popular', 30),
      getPopularMovies().catch(() => null),
      getPopularTV().catch(() => null),
    ]).then(async ([pop, m, t]) => {
      putMovies((m?.results || []).filter(okT))
      putTv((t?.results || []).filter(okT))

      // AniList banners are tiny (~1900×400) and look soft when stretched over
      // the billboard, so look up the full-HD TMDB backdrop for the same show.
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
      const hdBackdrop = async (a) => {
        try {
          const names = [a.title_english, a.title].filter(Boolean)
          // Both name lookups at once; first good match wins.
          const found = await Promise.all(names.map(async (n) => {
            const r = await searchTV(n).catch(() => null)
            const hit = (r?.results || []).find((x) => x.backdrop_path && (norm(x.name) === norm(n) || norm(x.original_name) === norm(n) || (norm(n).length > 6 && norm(x.name).includes(norm(n)))))
            return hit ? backdrop(hit.backdrop_path) : null
          }))
          return found.find(Boolean) || null
        } catch { return null }
      }
      const animePicks = await Promise.all(
        shuffle(pop.filter((a) => a.banner && a.synopsis && a.score >= MIN_FEATURED)).slice(0, 3).map(async (a) => {
          const hd = await Promise.race([hdBackdrop(a), sleep(800).then(() => null)])
          const h = animeHero(a)
          return hd ? { ...h, backdrop: hd } : h
        })
      )
      const mv = shuffle((m?.results || []).slice(0, 20).filter((x) => x.backdrop_path && x.overview && x.vote_average >= MIN_FEATURED))[0]
      const sh = shuffle((t?.results || []).slice(0, 20).filter((x) => x.backdrop_path && x.overview && x.vote_average >= MIN_FEATURED))[0]
      let picks = shuffle([...animePicks, mv && movieHero(mv), sh && tvHero(sh)].filter(Boolean))

      if (!picks.length) picks = (await animeByMalIds(HERO_FALLBACK)).filter((a) => a.score >= MIN_FEATURED).map(animeHero)
      saveHero(picks)
      if (homeCache.heroFromDevice) return // already showing last time's slides; these are for next time
      putHero(picks)
      if (active) setLoading(false)
    })
    // Rows further down start once the billboard is in (or after 1.5s), so AniList answers the billboard first.
    const after = Promise.race([pHero.catch(() => {}), sleep(1500)])

    const pTrending = after.then(() => animeList('trending', 50)).then((l) => put('trending', setTrending)(l.filter(okA)))
    const pAiring = after.then(() => animeList('airing', 50)).then((l) => put('airing', setAiring)(l.filter(okA)))
    const pAnimeMovies = after.then(() => animeList('movies', 30)).then((l) => put('animeMovies', setAnimeMovies)(l.filter(okA)))
    const pTop = after.then(() => animeList('top', 20)).then((l) => put('topRated', setTopRated)(l.filter(okA)))
    const pEps = after.then(() => recentlyAiredEpisodes(40)).then((eps) => put('recentEps', setRecentEps)(eps.filter((e) => (e.score || 0) >= MIN_HOME)))
    // Real weekly chart: TMDB's trending-this-week (movies + TV), 7+ only.
    const pWeek = Promise.all([getTrendingWeek(1), getTrendingWeek(2)].map((p) => p.catch(() => null))).then((pages) => {
      const all = pages.flatMap((d) => d?.results || []).filter((x) => (x.media_type === 'movie' || x.media_type === 'tv') && x.poster_path && okT(x))
      put('weekTop', setWeekTop)(all.slice(0, 10))
    })
    const pArt = after.then(() => animeCategoryArt(PRIORITY_CATEGORIES)).then(put('catArt', setCatArt))

    const settle = (p) => p.catch(() => {})
    homeCache.promise = Promise.all([pHero, pTrending, pAiring, pAnimeMovies, pTop, pEps, pWeek, pArt].map(settle)).then(() => {
      if (!homeCache.heroList?.length) delete homeCache.promise // failed: let the next visit retry
    })

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
  const wideAnime = (a) => ({
    href: `/anime/${a.mal_id}`, banner: a.banner, poster: a.images?.jpg?.large_image_url, title: animeTitle(a),
    meta: [a.type, a.episodes ? `${a.episodes} eps` : null].filter(Boolean).join(' · '), score: a.score, genres: normalizeGenres(a.genres),
    save: { key: `anime:${a.mal_id}`, mal_id: a.mal_id, title: animeTitle(a), poster: a.images?.jpg?.large_image_url || null, score: a.score },
  })
  const hideWatch = (item, how) => {
    if (how === 'watched') markWatched(user, item)
    const key = watchKey(item)
    setWatching((prev) => { const n = prev.filter((i) => watchKey(i) !== key); acctCache.watching = n; return n })
    if (user && item.id) udb.from(item.source_table).delete().eq('id', item.id).eq('user_id', user.id).then(({ error }) => { if (error) toast('Could not remove it from your account') })
    setHidden((prev) => {
      const next = new Set(prev); next.add(key)
      try { localStorage.setItem(HIDE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
    if (how !== 'watched') toast('Removed from Continue watching')
  }
  const wideWatch = (i) => ({
    key: watchKey(i),
    href: watchHref(i),
    banner: i.mal_id ? bannerByMal.get(i.mal_id) : null,
    poster: i.poster,
    title: i.title,
    meta: watchMeta(i),
    progress: watchFrac(i) || 0.04,
  })

  const airingWide = airing.filter((a) => a.banner)
  const visibleWatching = watching.filter((i) => !hidden.has(watchKey(i)))
  if (visibleWatching.length) lastWatch.current = visibleWatching
  const shownWatching = visibleWatching.length ? visibleWatching : lastWatch.current
  const fanPosters = trending.slice(0, 3).map((a) => a.images?.jpg?.large_image_url).filter(Boolean)

  return (
    <div className="y-home">
      {loading ? (
        <HeroPlaceholder />
      ) : (
        <Hero items={heroList} onPlay={(h) => navigate(h.href)} isInList={isInList} onToggleList={toggleList} />
      )}

      <div className="y-home-body">
        {user && watchReady && (
          <Collapse open={visibleWatching.length > 0} className="y-cw-wrap">
            <Row title={<><span className="rt-lead">Continue watching for</span><span className="rt-name">{(me?.name || 'you').trim() || 'you'}</span></>} wide onMore={() => navigate('/me')} className="y-cw">
              {shownWatching.map((i) => <ContinueCard key={watchKey(i)} item={wideWatch(i)} onRemove={(_, how) => hideWatch(i, how)} />)}
            </Row>
          </Collapse>
        )}

        <MoodSection />

        <Row title="Top 10 this week" sub="Movies and series" loading={!weekTop.length} className="y-top10">
          {weekTop.map((x, i) => <MediaCard key={x.media_type + x.id} item={{ ...(x.media_type === 'movie' ? movieCard(x) : tvCard({ ...x, name: x.name || x.title })), rank: i + 1 }} />)}
        </Row>

        <div className="y-duo">
          <NextSimulcast />
          <SurpriseCard posters={fanPosters} />
        </div>

        <Row title="Browse by category" wide onMore={() => navigate('/search')} className="y-cats">
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

        <Row title="Trending anime" loading={!trending.length} onMore={() => navigate('/anime')}>
          {trending.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
        </Row>

        <Row title="Currently airing" wide hover loading={!airing.length} onMore={() => navigate('/anime')}>
          {airingWide.map((a) => { const w = wideAnime(a); return <WideCard key={a.mal_id} item={w} inList={isInList(w)} onToggleList={toggleList} /> })}
        </Row>

        <Row title="New episodes" loading={!recentEps.length}>
          {recentEps.map((e) => <MediaCard key={e.malId} item={epCard(e)} />)}
        </Row>

        <Row title="Popular movies" loading={!movies.length} onMore={() => navigate('/movies')}>
          {movies.map((m) => <MediaCard key={m.id} item={movieCard(m)} />)}
        </Row>

        <Row title="Popular TV shows" loading={!tv.length} onMore={() => navigate('/tv')}>
          {tv.map((s) => <MediaCard key={s.id} item={tvCard(s)} />)}
        </Row>

        <Row title="Anime movies" loading={!animeMovies.length}>
          {animeMovies.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
        </Row>

        <Row title="Highest rated anime" loading={!topRated.length}>
          {topRated.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
        </Row>
      </div>
    </div>
  )
}
