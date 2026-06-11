// Minimal AniList helper — resolve an AniList id (for embed sources that key on
// AniList) from a MAL id, with localStorage caching.

const ANILIST = 'https://graphql.anilist.co'
const CACHE_KEY = 'anilist_id_by_mal'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function saveCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* ignore */ }
}

// ── ani.zip mappings ─────────────────────────────────────────────────────────
// Maps an AniList anime + episode number to TMDB/IMDB ids with the correct
// TV season/episode numbering, so TMDB-keyed embed sources work for anime.

const anizipCache = new Map()

async function anizip(anilistId) {
  if (anizipCache.has(anilistId)) return anizipCache.get(anilistId)
  try {
    const r = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistId}`)
    if (!r.ok) throw new Error('anizip ' + r.status)
    const j = await r.json()
    anizipCache.set(anilistId, j)
    return j
  } catch {
    anizipCache.set(anilistId, null)
    return null
  }
}

// ── High-res hero art ────────────────────────────────────────────────────────
// AniList exposes a true wide banner (bannerImage) plus a hi-res cover, which
// look far sharper in the billboard than Jikan's portrait poster stretched wide.
const artCache = new Map()

export async function animeArtFromMal(malId) {
  if (!malId) return null
  if (artCache.has(malId)) return artCache.get(malId)
  const query = `query($id:Int){Media(idMal:$id,type:ANIME){bannerImage coverImage{extraLarge}}}`
  try {
    const r = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { id: Number(malId) } }),
    })
    const m = (await r.json())?.data?.Media
    const art = m ? { banner: m.bannerImage || null, cover: m.coverImage?.extraLarge || null } : null
    artCache.set(malId, art)
    return art
  } catch {
    artCache.set(malId, null)
    return null
  }
}

// → { id, imdb, season, episode } or null when no TMDB mapping exists.
export async function animeTmdbInfo(anilistId, episode) {
  if (!anilistId) return null
  const data = await anizip(anilistId)
  const raw = data?.mappings?.themoviedb_id ?? data?.mappings?.themoviedb
  const id = Number(raw)
  if (!id || Number.isNaN(id)) return null
  const ep = data?.episodes?.[String(episode)]
  return {
    id,
    imdb: data?.mappings?.imdb_id || null,
    season: ep?.seasonNumber > 0 ? ep.seasonNumber : 1,
    episode: ep?.episodeNumber ?? Number(episode) ?? 1,
  }
}

export async function anilistIdFromMal(malId) {
  if (!malId) return null
  const cache = loadCache()
  if (cache[malId] !== undefined) return cache[malId]

  const query = `query($id:Int){Media(idMal:$id,type:ANIME){id}}`
  try {
    const r = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { id: Number(malId) } }),
    })
    const j = await r.json()
    const id = j?.data?.Media?.id ?? null
    cache[malId] = id
    saveCache(cache)
    return id
  } catch {
    return null
  }
}
