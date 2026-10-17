import { useEffect, useState } from 'react'
import Row from './Row'
import MediaCard from './MediaCard'
import { anilist, animeByGenre } from '../lib/anime'
import { isHiddenGenre } from '../lib/categories'
import { tmdbFetch, getTmdbImage, isAdultTmdb } from '../lib/tmdb'

const ANIME_Q = `query($id:Int){ Media(idMal:$id, type:ANIME){ recommendations(sort:RATING_DESC, perPage:24){ nodes{ mediaRecommendation{
  idMal format averageScore seasonYear isAdult genres title{ romaji english } coverImage{ extraLarge large } } } } } }`

async function animeLike(id, genres) {
  const d = await anilist(ANIME_Q, { id: Number(id) }).catch(() => null)
  const nodes = d?.Media?.recommendations?.nodes || []
  let items = nodes.map((n) => n.mediaRecommendation).filter((m) => m && m.idMal && !m.isAdult && !(m.genres || []).some(isHiddenGenre))
    .map((m) => ({ href: `/anime/${m.idMal}`, poster: m.coverImage?.extraLarge || m.coverImage?.large, title: m.title?.english || m.title?.romaji, score: m.averageScore ? m.averageScore / 10 : null, kind: m.format }))
    .filter((c) => c.poster)
  if (items.length < 6 && genres?.length) {
    const r = await animeByGenre(genres[0], 1, 24).catch(() => null)
    const have = new Set(items.map((i) => i.href))
    const extra = (r?.list || []).filter((a) => String(a.mal_id) !== String(id)).map((a) => ({
      href: `/anime/${a.mal_id}`, poster: a.images?.jpg?.large_image_url, title: a.title_english || a.title, score: a.score, kind: a.type,
    })).filter((c) => c.poster && !have.has(c.href))
    items = [...items, ...extra]
  }
  return items.slice(0, 24)
}

async function tvLike(id) {
  let res = await tmdbFetch(`/tv/${id}/recommendations`).catch(() => null)
  if (!res?.results?.length) res = await tmdbFetch(`/tv/${id}/similar`).catch(() => null)
  return (res?.results || []).filter((s) => s.poster_path && !isAdultTmdb(s)).slice(0, 24)
    .map((s) => ({ href: `/tv/${s.id}`, poster: getTmdbImage(s.poster_path), title: s.name, score: s.vote_average, sub: s.first_air_date?.slice(0, 4) }))
}

// "More like this" row for anime and TV detail pages (movies fetch theirs with the details).
export default function MoreLikeThis({ kind, id, genres }) {
  const [items, setItems] = useState(null)
  const gkey = (genres || []).join('|')
  useEffect(() => {
    let alive = true
    setItems(null)
    ;(kind === 'anime' ? animeLike(id, genres) : tvLike(id)).then((r) => { if (alive) setItems(r) }).catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, gkey])
  if (!items || !items.length) return null
  return (
    <div className="mv-more">
      <Row title="More like this">
        {items.map((it) => <MediaCard key={it.href} item={it} />)}
      </Row>
    </div>
  )
}
