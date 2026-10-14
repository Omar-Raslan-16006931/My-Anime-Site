// Resilient anime data layer.
//
// Jikan (the MAL mirror) is heavily rate-limited (~3 req/s, 60/min) and often
// answers 429/5xx — that's what made searches randomly come back empty. AniList
// is fast and reliable, so lists + search go to AniList first and fall back to
// Jikan; full details come from Jikan with AniList filling any gaps.
//
// Adult content (hentai / erotica) is filtered out of EVERYTHING here.

import { HIDDEN_GENRES, isHiddenGenre } from './categories'

const ANILIST = 'https://graphql.anilist.co'
const NOT_GENRES = JSON.stringify(HIDDEN_GENRES) // AniList genre_not_in literal
const JIKAN = 'https://api.jikan.moe/v4'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// fetch + JSON with a hard timeout. Never throws.
async function fetchJson(url, opts = {}, ms = 10000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal })
    let body = null
    try { body = await r.json() } catch { body = null }
    return { ok: r.ok, status: r.status, body }
  } catch {
    return { ok: false, status: 0, body: null }
  } finally {
    clearTimeout(t)
  }
}

// ── Jikan: one global queue, spaced ≥400ms apart, with retry/backoff ────────
// Plus a circuit breaker: Jikan goes down for long stretches, and waiting on it
// used to freeze every anime page. After 3 straight failures we skip it for 60s.
let jikanChain = Promise.resolve()
let lastJikanAt = 0
let jikanFails = 0
let jikanDownUntil = 0

export function jikanGet(path, retries = 3, isCancelled = () => false) {
  const run = async () => {
    for (let i = 0; i <= retries; i++) {
      // Dropped requests (user left the page) and a tripped breaker cost nothing.
      if (isCancelled() || Date.now() < jikanDownUntil) return null
      const wait = 400 - (Date.now() - lastJikanAt)
      if (wait > 0) await sleep(wait)
      lastJikanAt = Date.now()
      const res = await fetchJson(`${JIKAN}${path}`, {}, 8000)
      if (res.ok && res.body) { jikanFails = 0; return res.body }
      if (res.status === 404) { jikanFails = 0; return null }
      if (res.status === 0 || res.status >= 500) {
        jikanFails += 1
        if (jikanFails >= 3) { jikanDownUntil = Date.now() + 60000; jikanFails = 0; return null }
      }
      if (i < retries) await sleep(900 * (i + 1)) // 429 / 5xx / network → back off
    }
    return null
  }
  const p = jikanChain.then(run, run)
  jikanChain = p.catch(() => null)
  return p
}

// ── AniList GraphQL with retry on 429/5xx ───────────────────────────────────
export async function anilist(query, variables = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetchJson(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    if (res.body?.data) return res.body.data // includes "not found" (Media: null)
    if (res.status && res.status !== 429 && res.status < 500) return null
    if (i < retries) await sleep(1000 * (i + 1))
  }
  return null
}

// ── Adult-content filter ────────────────────────────────────────────────────
const ADULT_GENRES = new Set(['hentai', 'erotica'])

export function isAdultAnime(a) {
  if (!a) return false
  if (a.isAdult) return true
  const rating = String(a.rating || '')
  if (/^rx/i.test(rating) || /hentai/i.test(rating)) return true
  const genres = [...(a.genres || []), ...(a.explicit_genres || [])]
    .map((g) => (typeof g === 'string' ? g : g?.name || '').toLowerCase())
  return genres.some((g) => ADULT_GENRES.has(g))
}

// Titles tagged with a site-hidden genre (see lib/categories.js) never show up.
const hasHiddenGenre = (a) =>
  [...(a.genres || []), ...(a.explicit_genres || [])].some((g) => isHiddenGenre(typeof g === 'string' ? g : g?.name))

export const safeList = (arr) =>
  Array.isArray(arr) ? arr.filter((a) => a && a.mal_id && !isAdultAnime(a) && !hasHiddenGenre(a)) : []

// ── AniList → Jikan-shaped object (so pages can use either source) ──────────
const MEDIA_FIELDS = `id idMal isAdult format status episodes seasonYear averageScore genres
  title { english romaji }
  coverImage { extraLarge large }
  bannerImage
  description(asHtml: false)
  startDate { year }
  nextAiringEpisode { episode }`

const FORMAT = { TV: 'TV', TV_SHORT: 'TV', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music' }
const STATUS = {
  FINISHED: 'Finished Airing', RELEASING: 'Currently Airing', NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled', HIATUS: 'On Hiatus',
}

const stripHtml = (s) =>
  (s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export function fromAniList(m) {
  if (!m) return null
  return {
    mal_id: m.idMal || null,
    anilist_id: m.id,
    title: m.title?.romaji || m.title?.english || '',
    title_english: m.title?.english || null,
    images: { jpg: { large_image_url: m.coverImage?.extraLarge || m.coverImage?.large || null, image_url: m.coverImage?.large || null } },
    banner: m.bannerImage || null,
    synopsis: stripHtml(m.description) || null,
    genres: (m.genres || []).map((name) => ({ name })),
    episodes: m.episodes || null,
    score: m.averageScore ? Math.round(m.averageScore) / 10 : null,
    year: m.seasonYear || m.startDate?.year || null,
    type: FORMAT[m.format] || m.format || null,
    status: STATUS[m.status] || null,
    airing: m.status === 'RELEASING',
    next_episode: m.nextAiringEpisode?.episode || null,
    isAdult: !!m.isAdult,
  }
}

const mapAniList = (media) => (Array.isArray(media) ? safeList(media.map(fromAniList)) : null)

// ── Search ──────────────────────────────────────────────────────────────────
// Returns a (possibly empty) array. Throws only when BOTH providers are down,
// so the UI can say "try again" instead of a misleading "no results".
export async function searchAnime(q, limit = 30) {
  const query = String(q || '').trim()
  if (!query) return []

  const d = await anilist(
    `query($s: String, $n: Int) { Page(perPage: $n) {
      media(type: ANIME, isAdult: false, genre_not_in: ${NOT_GENRES}, search: $s, sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${MEDIA_FIELDS} }
    } }`,
    { s: query, n: limit }
  )
  const fromA = mapAniList(d?.Page?.media)
  if (fromA?.length) return fromA

  const j = await jikanGet(`/anime?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 25)}&sfw=true&order_by=popularity`)
  if (j?.data) return safeList(j.data)

  if (fromA) return [] // AniList answered — there just are no matches
  throw new Error('Search is temporarily unavailable')
}

// ── Lists: 'trending' | 'popular' | 'airing' ────────────────────────────────
const LIST_FILTER = {
  trending: 'sort: [TRENDING_DESC, POPULARITY_DESC]',
  popular: 'sort: POPULARITY_DESC',
  airing: 'status: RELEASING, sort: POPULARITY_DESC',
  top: 'sort: SCORE_DESC',
  movies: 'format: MOVIE, sort: POPULARITY_DESC',
}
const LIST_JIKAN = {
  trending: '/top/anime?filter=airing&sfw=true',
  popular: '/top/anime?filter=bypopularity&sfw=true',
  airing: '/seasons/now?sfw=true',
  top: '/top/anime?sfw=true',
  movies: '/top/anime?type=movie&filter=bypopularity&sfw=true',
}

export async function animeList(kind = 'trending', limit = 20) {
  const filter = LIST_FILTER[kind] || LIST_FILTER.trending
  const d = await anilist(
    `query($n: Int) { Page(perPage: $n) { media(type: ANIME, isAdult: false, genre_not_in: ${NOT_GENRES}, ${filter}) { ${MEDIA_FIELDS} } } }`,
    { n: limit }
  )
  const fromA = mapAniList(d?.Page?.media)
  if (fromA?.length) return fromA

  const j = await jikanGet(`${LIST_JIKAN[kind] || LIST_JIKAN.trending}&limit=${limit}`)
  return safeList(j?.data)
}

// ── Cover art for category tiles: the top title of each category ────────────
// One request for all categories. Each gets the most popular title in that
// category (= the first one on its category page); if that title was already
// used for an earlier tile, the next one down is used so tiles don't repeat.
// → { [genre]: { banner, poster, title } }
export async function animeCategoryArt(genres) {
  const parts = genres.map((g, i) =>
    `g${i}: Page(perPage: 6) { media(type: ANIME, isAdult: false, genre: ${JSON.stringify(g)}, genre_not_in: ${NOT_GENRES}, sort: POPULARITY_DESC) { id bannerImage coverImage { extraLarge } title { english romaji } } }`
  ).join('\n')
  const d = await anilist(`query { ${parts} }`)
  const out = {}
  const used = new Set()
  genres.forEach((g, i) => {
    const media = d?.[`g${i}`]?.media || []
    const pick = media.find((m) => !used.has(m.id) && m.bannerImage) || media.find((m) => !used.has(m.id)) || media[0]
    if (!pick) return
    used.add(pick.id)
    out[g] = { banner: pick.bannerImage || null, poster: pick.coverImage?.extraLarge || null, title: pick.title?.english || pick.title?.romaji }
  })
  return out
}

// ── One category (genre), most popular first, paged → { list, hasNext } ─────
export async function animeByGenre(genre, page = 1, perPage = 30) {
  if (isHiddenGenre(genre)) return { list: [], hasNext: false }
  const d = await anilist(
    `query($g: String, $p: Int, $n: Int) { Page(page: $p, perPage: $n) {
      pageInfo { hasNextPage }
      media(type: ANIME, isAdult: false, genre: $g, genre_not_in: ${NOT_GENRES}, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
    } }`,
    { g: genre, p: page, n: perPage }
  )
  if (!d?.Page) return { list: [], hasNext: false, failed: true }
  return { list: mapAniList(d.Page.media) || [], hasNext: !!d.Page.pageInfo?.hasNextPage }
}

// ── Several titles by MAL id, in the given order (hero billboard) ───────────
export async function animeByMalIds(ids) {
  const d = await anilist(
    `query($ids: [Int]) { Page(perPage: 50) { media(type: ANIME, idMal_in: $ids) { ${MEDIA_FIELDS} } } }`,
    { ids }
  )
  const by = new Map((mapAniList(d?.Page?.media) || []).map((a) => [a.mal_id, a]))
  // Backfill anything AniList didn't return (e.g. a brand-new season) from Jikan.
  for (const id of ids) {
    if (by.has(id)) continue
    const j = await jikanGet(`/anime/${id}`)
    if (j?.data && !isAdultAnime(j.data)) by.set(id, j.data)
  }
  return ids.map((id) => by.get(id)).filter(Boolean)
}

// ── Full details for one title ──────────────────────────────────────────────
// → { data, banner, epCount: { n, airing } | null } or null when unavailable.
export async function animeDetails(malId) {
  const id = Number(malId)
  if (!id) return null
  // Both start at once, but the page never waits long on Jikan: AniList alone
  // is enough to render, so Jikan gets at most ~2.5s more to add its extras.
  const jikanP = jikanGet(`/anime/${id}/full`, 1)
  const a = await anilist(`query($id: Int) { Media(idMal: $id, type: ANIME) { ${MEDIA_FIELDS} } }`, { id })
  const ani = fromAniList(a?.Media)
  const j = ani ? await Promise.race([jikanP, sleep(2500).then(() => null)]) : await jikanP
  const jd = j?.data && !Array.isArray(j.data) ? j.data : null
  if (!jd && !ani) return null

  // Jikan has richer MAL fields; AniList fills anything missing.
  const data = jd ? { ...jd } : { ...ani }
  if (jd && ani) {
    if (!data.synopsis) data.synopsis = ani.synopsis
    if (!data.images?.jpg?.large_image_url) data.images = ani.images
    if (!data.episodes) data.episodes = ani.episodes
    if (!data.year) data.year = ani.year
    if (ani.isAdult) data.isAdult = true
  }

  let epCount = null
  if (ani?.next_episode) epCount = { n: ani.next_episode - 1, airing: true }
  else if (ani?.episodes) epCount = { n: ani.episodes, airing: !!ani.airing }

  return { data, banner: ani?.banner || null, epCount }
}

// ── Episode titles (paged Jikan list). Best-effort; [] on failure. ──────────
export async function animeEpisodes(malId, isCancelled = () => false) {
  let page = 1
  let all = []
  while (page < 60) {
    if (isCancelled()) return all
    const j = await jikanGet(`/anime/${malId}/episodes?page=${page}`, 1, isCancelled)
    if (isCancelled()) return all
    if (!j?.data?.length) break
    all = all.concat(j.data)
    if (!j.pagination?.has_next_page) break
    page += 1
  }
  return all
}

// ── Search with category filters ────────────────────────────────────────────
// Text and/or one or more categories. A title must have ALL selected
// categories. AniList can only filter by one genre per query, so we pull three
// pages of the first one and narrow the rest client-side.
export async function searchAnimeFiltered({ q = '', genres = [], minScore = 0 }) {
  const want = genres.filter((g) => !isHiddenGenre(g))
  const query = String(q || '').trim()
  if (!query && !want.length) return []
  const pages = want.length > 1 ? 3 : 1
  const args = [
    'type: ANIME', 'isAdult: false', `genre_not_in: ${NOT_GENRES}`,
    query ? 'search: $s' : null,
    want.length ? 'genre: $g' : null,
    query ? 'sort: [SEARCH_MATCH, POPULARITY_DESC]' : 'sort: POPULARITY_DESC',
  ].filter(Boolean).join(', ')
  const decl = [query ? '$s: String' : null, want.length ? '$g: String' : null].filter(Boolean).join(', ')
  const body = Array.from({ length: pages }, (_, i) =>
    `p${i}: Page(page: ${i + 1}, perPage: 50) { media(${args}) { ${MEDIA_FIELDS} } }`).join('\n')
  const d = await anilist(`query${decl ? `(${decl})` : ''} { ${body} }`, { ...(query ? { s: query } : {}), ...(want.length ? { g: want[0] } : {}) })
  if (!d) throw new Error('Search is temporarily unavailable')
  const all = Array.from({ length: pages }, (_, i) => d[`p${i}`]?.media || []).flat()
  const seen = new Set()
  return safeList(all.map(fromAniList)).filter((a) => {
    if (seen.has(a.mal_id)) return false
    seen.add(a.mal_id)
    const names = (a.genres || []).map((g) => g.name)
    return want.every((g) => names.includes(g)) && (!minScore || (a.score || 0) >= minScore)
  })
}
