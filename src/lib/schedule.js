// Simulcast schedule (what airs when), from AniList's airing schedule.
// Times are unix seconds; pages convert to the viewer's local time.
import { anilist } from './anime'
import { isHiddenGenre } from './categories'

const FIELDS = `episode airingAt
  media {
    idMal format countryOfOrigin isAdult popularity averageScore genres bannerImage
    title { english romaji }
    coverImage { extraLarge large }
  }`

const OK_FORMAT = new Set(['TV', 'TV_SHORT', 'ONA'])

function mapItem(s) {
  const m = s?.media
  if (!m || !m.idMal || m.isAdult) return null
  if (m.countryOfOrigin && m.countryOfOrigin !== 'JP') return null
  if (m.format && !OK_FORMAT.has(m.format)) return null
  if ((m.genres || []).some(isHiddenGenre)) return null
  return {
    malId: m.idMal,
    title: m.title?.english || m.title?.romaji || '',
    poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
    banner: m.bannerImage || null,
    score: m.averageScore ? m.averageScore / 10 : null,
    popularity: m.popularity || 0,
    genres: m.genres || [],
    episode: s.episode,
    airingAt: s.airingAt,
  }
}

const cache = new Map()
const fresh = (k, ms) => { const c = cache.get(k); return c && Date.now() - c.at < ms ? c.data : null }

// Monday 00:00 (local) of the week containing `d`.
export function weekStartOf(d = new Date()) {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  return s
}

// Simulcasts airing in the `span` days from `start` (local midnight), the
// most popular shows per day. → [{ ...item, day: 0..span-1 }] sorted by time.
export async function weekSchedule(start = weekStartOf(), perDay = 10, span = 7) {
  const key = 'week:' + start.getTime() + ':' + span
  const hit = fresh(key, 10 * 60 * 1000)
  if (hit) return hit
  const from = Math.floor(start.getTime() / 1000)
  const to = from + span * 86400
  const q = `query($a:Int,$b:Int,$p:Int){ Page(page:$p, perPage:50){ pageInfo{hasNextPage} airingSchedules(airingAt_greater:$a, airingAt_lesser:$b, sort:TIME){ ${FIELDS} } } }`
  // Pages one after another (with one retry) so AniList's burst limit doesn't reject them.
  // Two waves of three pages: fast, but gentle enough for AniList's burst limit.
  const get = (p) => anilist(q, { a: from, b: to, p }).catch(() => null)
  const pages = []
  for (const wave of [[1, 2, 3], [4, 5, 6]]) {
    const got = await Promise.all(wave.map(get))
    pages.push(...got)
    if (got.some((d) => d && d.Page?.pageInfo?.hasNextPage === false)) break
  }
  const seen = new Set()
  const all = []
  for (const d of pages) {
    for (const s of d?.Page?.airingSchedules || []) {
      const it = mapItem(s)
      if (!it) continue
      const k = it.malId + ':' + it.episode
      if (seen.has(k)) continue
      seen.add(k)
      all.push({ ...it, day: Math.min(span - 1, Math.max(0, Math.floor((it.airingAt - from) / 86400))) })
    }
  }
  // Keep the most popular few per day, then order by air time.
  const out = []
  for (let day = 0; day < span; day++) {
    out.push(...all.filter((x) => x.day === day).sort((a, b) => b.popularity - a.popularity).slice(0, perDay))
  }
  out.sort((a, b) => a.airingAt - b.airingAt)
  if (out.length) cache.set(key, { at: Date.now(), data: out })
  return out
}

// The next popular episode to air → item or null.
export async function nextSimulcast() {
  const hit = fresh('next', 5 * 60 * 1000)
  if (hit) return hit
  const now = Math.floor(Date.now() / 1000)
  const q = `query($a:Int){ Page(perPage:50){ airingSchedules(airingAt_greater:$a, sort:TIME){ ${FIELDS} } } }`
  const d = await anilist(q, { a: now }).catch(() => null)
  const items = (d?.Page?.airingSchedules || []).map(mapItem).filter(Boolean)
  const pick = items.find((x) => x.popularity >= 8000 && x.banner) || items.find((x) => x.popularity >= 4000) || items[0] || null
  if (pick) cache.set('next', { at: Date.now(), data: pick })
  return pick
}
