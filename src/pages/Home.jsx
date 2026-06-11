import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Hero from '../components/Hero'
import Row from '../components/Row'
import MediaCard from '../components/MediaCard'
import { getPopularMovies, getPopularTV, getTmdbImage } from '../lib/tmdb'
import { getRecent, hrefFor, progressLabel, progressFraction } from '../lib/progress'
import { animeArtFromMal } from '../lib/anilist'
import Icon from '../components/Icons'

const backdrop = (path) => (path ? `https://image.tmdb.org/t/p/original${path}` : null)

async function jikan(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url)
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 800 * (i + 1))); continue }
    if (res.ok) return res.json()
    return { data: [] }
  }
  return { data: [] }
}

export default function Home() {
  const navigate = useNavigate()
  const [hero, setHero] = useState(null)
  const [topAnime, setTopAnime] = useState([])
  const [airing, setAiring] = useState([])
  const [movies, setMovies] = useState([])
  const [tv, setTv] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { setRecent(getRecent()) }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const top = await jikan('https://api.jikan.moe/v4/top/anime?limit=20&filter=bypopularity')
      if (!active) return
      const list = top.data || []
      setTopAnime(list)
      const h = list[Math.floor(Math.random() * Math.min(5, list.length))] || list[0]
      if (h) {
        setHero({
          kind: 'ANIME',
          title: h.title_english || h.title,
          backdrop: h.images?.jpg?.large_image_url,
          score: h.score,
          year: h.year || h.aired?.prop?.from?.year,
          genres: (h.genres || []).map((g) => g.name),
          desc: h.synopsis,
          href: `/anime/${h.mal_id}`,
        })
        // Upgrade the stretched portrait poster to AniList's true wide banner.
        animeArtFromMal(h.mal_id).then((art) => {
          if (!active || !art?.banner) return
          setHero((prev) => (prev ? { ...prev, backdrop: art.banner } : prev))
        })
      }
      setLoading(false)

      const air = await jikan('https://api.jikan.moe/v4/seasons/now?limit=20')
      if (active) setAiring(air.data || [])
    })()

    Promise.all([getPopularMovies().catch(() => null), getPopularTV().catch(() => null)]).then(([m, t]) => {
      if (!active) return
      setMovies(m?.results || [])
      setTv(t?.results || [])
    })

    return () => { active = false }
  }, [])

  const animeCard = (a) => ({
    href: `/anime/${a.mal_id}`,
    poster: a.images?.jpg?.large_image_url,
    title: a.title_english || a.title,
    score: a.score,
    kind: a.type,
  })
  const movieCard = (m) => ({ href: `/movie/${m.id}`, poster: getTmdbImage(m.poster_path), title: m.title, score: m.vote_average, sub: m.release_date?.slice(0, 4) })
  const tvCard = (s) => ({ href: `/tv/${s.id}`, poster: getTmdbImage(s.poster_path), title: s.name, score: s.vote_average, sub: s.first_air_date?.slice(0, 4) })

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      {loading ? (
        <div className="skel" style={{ height: 'clamp(420px,56vw,82vh)', margin: '0 calc(-1 * clamp(16px,4vw,60px))', borderRadius: 0 }} />
      ) : (
        <Hero item={hero} onPlay={(h) => navigate(h.href)} />
      )}

      {recent.length > 0 && (
        <Row title="Continue Watching">
          {recent.map((r) => (
            <div key={r.key} className="pcard" onClick={() => navigate(hrefFor(r))}>
              <div className="pcard-img">
                {r.backdrop || r.poster ? <img src={r.backdrop || r.poster} alt={r.title} /> : null}
                <div className="pcard-play"><Icon.play width="34" height="34" /></div>
                <div className="pcard-badge">{progressLabel(r)}</div>
                {progressFraction(r) > 0 && (
                  <div className="card-progress"><span style={{ width: `${Math.round(progressFraction(r) * 100)}%` }} /></div>
                )}
              </div>
              <div className="card-title" style={{ marginTop: 6 }}>{r.title}</div>
            </div>
          ))}
        </Row>
      )}

      <Row title="Trending Anime" loading={loading} onMore={() => navigate('/anime')}>
        {topAnime.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
      </Row>

      <Row title="Airing This Season" loading={!airing.length} onMore={() => navigate('/anime')}>
        {airing.map((a) => <MediaCard key={a.mal_id} item={animeCard(a)} />)}
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
