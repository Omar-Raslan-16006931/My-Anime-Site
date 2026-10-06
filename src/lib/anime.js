// Resilient anime data layer.
//
// Jikan (the MAL mirror) is heavily rate-limited (~3 req/s, 60/min) and often
// answers 429/5xx — that's what made searches randomly come back empty. AniList
// is fast and reliable, so lists + search go to AniList first and fall back to
// Jikan; full details come from Jikan with AniList filling any gaps.
//
// Adult content (hentai / erotica) is filtered out of EVERYTHING here.

const ANILIST = 'https://graphql.anilist.co'
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
let jikanChain = Promise.resolve()
let lastJikanAt = 0

export function jikanGet(path, retries = 3) {
  const run = async () => {
    for (let i = 0; i <= retries; i++) {
      const wait = 400 - (Date.now() - lastJikanAt)
      if (wait > 0) await sleep(wait)
      lastJikanAt = Date.now()
      const res = await fetchJson(`${JIKAN}${path}`)
      if (res.ok && res.body) return res.body
      if (res.status === 404) return null
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

export const safeList = (arr) => (Array.isArray(arr) ? arr.filter((a) => a && a.mal_id && !isAdultAnime(a)) : [])

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
      media(type: ANIME, isAdult: false, search: $s, sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${MEDIA_FIELDS} }
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
}
const LIST_JIKAN = {
  trending: '/top/anime?filter=airing&sfw=true',
  popular: '/top/anime?filter=bypopularity&sfw=true',
  airing: '/seasons/now?sfw=true',
}

export async function animeList(kind = 'trending', limit = 20) {
  const filter = LIST_FILTER[kind] || LIST_FILTER.trending
  const d = await anilist(
    `query($n: Int) { Page(perPage: $n) { media(type: ANIME, isAdult: false, ${filter}) { ${MEDIA_FIELDS} } } }`,
    { n: limit }
  )
  const fromA = mapAniList(d?.Page?.media)
  if (fromA?.length) return fromA

  const j = await jikanGet(`${LIST_JIKAN[kind] || LIST_JIKAN.trending}&limit=${limit}`)
  return safeList(j?.data)
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
  const [j, a] = await Promise.all([
    jikanGet(`/anime/${id}/full`, 2),
    anilist(`query($id: Int) { Media(idMal: $id, type: ANIME) { ${MEDIA_FIELDS} } }`, { id }),
  ])
  const ani = fromAniList(a?.Media)
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
    const j = await jikanGet(`/anime/${malId}/episodes?page=${page}`, 2)
    if (isCancelled()) return all
    if (!j?.data?.length) break
    all = all.concat(j.data)
    if (!j.pagination?.has_next_page) break
    page += 1
  }
  return all
}
