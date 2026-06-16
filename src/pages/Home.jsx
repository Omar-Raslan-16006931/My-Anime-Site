import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Hero from '../components/Hero'
import Row from '../components/Row'
import MediaCard from '../components/MediaCard'
import { getPopularMovies, getPopularTV, getTmdbImage } from '../lib/tmdb'
import { animeArtFromMal, recentlyAiredEpisodes } from '../lib/anilist'
import { supabase } from '../supabase'

const backdrop = (path) => (path ? `https://image.tmdb.org/t/p/original${path}` : null)

// Curated billboard line-up. Order = rotation order in the hero.
const HERO_PICKS = [
  { mal_id: 57658, kind: 'ANIME · SEASON 3', banner: '/jjk-hero.avif' },   // Jujutsu Kaisen: The Culling Game
  { mal_id: 37991, kind: 'ANIME' },              // JoJo's Bizarre Adventure: Golden Wind (Part 5)
  { mal_id: 16498, kind: 'ANIME' },              // Attack on Titan
  { mal_id: 21,    kind: 'ANIME' },              // One Piece
  { mal_id: 5114,  kind: 'ANIME' },              // Fullmetal Alchemist: Brotherhood
]

// "just now" / "3h ago" / "2d ago" from a unix-seconds timestamp.
function timeAgo(unix) {
  if (!unix) return ''
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unix)
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

async function jikan(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url)
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 800 * (i + 1))); continue }
    if (res.ok) return res.json()
    return { data: [] }
  }
  return { data: [] }
}

export default function Home({ user }) {
  const navigate = useNavigate()
  const [heroList, setHeroList] = useState([])
  const [recentEps, setRecentEps] = useState([])
  const [topAnime, setTopAnime] = useState([])
  const [airing, setAiring] = useState([])
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
        supabase.from('currently_watching').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('currently_watching_tmdb').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
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
    ;(async () => {
      // Build the curated billboard from the hand-picked MAL ids. Fetched
      // sequentially so we stay under Jikan's rate limit.
      for (let n = 0; n < HERO_PICKS.length; n++) {
        const pick = HERO_PICKS[n]
        const res = await jikan(`https://api.jikan.moe/v4/anime/${pick.mal_id}`)
        if (!active) return
        const h = res.data
        if (!h || Array.isArray(h) || !h.mal_id) continue
        const item = {
          kind: pick.kind,
          title: h.title_english || h.title,
          backdrop: pick.banner || h.images?.jpg?.large_image_url,
          score: h.score,
          year: h.year || h.aired?.prop?.from?.year,
          genres: (h.genres || []).map((g) => g.name),
          desc: h.synopsis,
          href: `/anime/${h.mal_id}`,
        }
        setHeroList((prev) => [...prev, item])
        setLoading(false)
        // A custom local banner wins; otherwise upgrade the stretched portrait
        // poster to AniList's true wide banner.
        if (!pick.banner) {
          animeArtFromMal(pick.mal_id).then((art) => {
            if (!active || !art?.banner) return
            setHeroList((prev) => prev.map((x) => (x.href === item.href ? { ...x, backdrop: art.banner } : x)))
          })
        }
      }

      const top = await jikan('https://api.jikan.moe/v4/top/anime?limit=20&filter=bypopularity')
      if (active) setTopAnime(top.data || [])

      const air = await jikan('https://api.jikan.moe/v4/seasons/now?limit=20')
      if (active) setAiring(air.data || [])
    })()

    Promise.all([getPopularMovies().catch(() => null), getPopularTV().catch(() => null)]).then(([m, t]) => {
      if (!active) return
      setMovies(m?.results || [])
      setTv(t?.results || [])
    })

    recentlyAiredEpisodes(24).then((eps) => { if (active) setRecentEps(eps) })

    return () => { active = false }
  }, [])

  const watchKey = (i) => `${i.source_table}-${i.id}`
  const watchHref = (i) => (i.media_type === 'tv' && i.tmdb_id ? `/tv/${i.tmdb_id}` : i.media_type === 'movie' && i.tmdb_id ? `/movie/${i.tmdb_id}` : i.mal_id ? `/anime/${i.mal_id}` : '/')
  const watchMeta = (i) => i.media_type === 'tv' ? `S${i.season_number || 1} · E${i.last_episode || 1}` : i.media_type === 'movie' ? 'Movie' : `Ep. ${i.last_episode || 1}${i.total_episodes ? ` / ${i.total_episodes}` : ''}`
  const watchFrac = (i) => (i.total_episodes && i.last_episode ? Math.min(1, i.last_episode / i.total_episodes) : 0)

  const animeCard = (a) => ({
    href: `/anime/${a.mal_id}`,
    poster: a.images?.jpg?.large_image_url,
    title: a.title_english || a.title,
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

  // Currently watching → standard full-size poster card with progress + meta.
  const watchCard = (i) => ({
    href: watchHref(i),
    poster: i.poster,
    title: i.title,
    sub: watchMeta(i),
    progress: watchFrac(i),
  })

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      {loading ? (
        <div className="skel" style={{ height: 'clamp(420px,56vw,82vh)', margin: '0 calc(-1 * clamp(16px,4vw,60px))', borderRadius: 0 }} />
      ) : (
        <Hero items={heroList} onPlay={(h) => navigate(h.href)} />
      )}

      {watching.length > 0 && (
        <Row title="Currently Watching" onMore={() => navigate('/currently-watching')}>
          {watching.map((i) => (
            <MediaCard key={watchKey(i)} item={watchCard(i)} />
          ))}
        </Row>
      )}

      <Row title="Trending Anime" loading={loading} onMore={() => navigate('/anime')}>
        {topAnime.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
      </Row>

      <Row title="Airing This Season" loading={!airing.length} onMore={() => navigate('/anime')}>
        {airing.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
      </Row>

      <Row title="Recently Released Episodes" loading={!recentEps.length}>
        {recentEps.map((e) => <MediaCard key={e.malId} item={epCard(e)} />)}
      </Row>

      <Row title="Popular Movies" loading={!movies.length} onMore={() => navigate('/movies')}>
        {movies.map((m) => <MediaCard key={m.id} item={movieCard(m)} />)}
      </Row>

      <Row title="Popular TV Shows" loading={!tv.length} onMore={() => navigate('/tv')}>
        {tv.map((s) => <MediaCard key={s.id} item={tvCard(s)} />)}
      </Row>
    </div>
  )
}