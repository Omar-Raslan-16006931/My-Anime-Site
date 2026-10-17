// "Watched": whole shows and movies a user has finished (never single episodes).
//   • Stored in the `watched` table through udb (so Private history covers it too). Until db/watched.sql
//     has been run, it falls back to this browser (localStorage) so the feature works straight away.
//   • One tiny shared store: every button and page that shows Watched stays in sync.
import { useEffect, useSyncExternalStore } from 'react'
import { udb } from './udb'
import { toast } from './toast'
import { animeDetails } from './anime'
import { getMovieDetails, getTVDetails, getTmdbImage } from './tmdb'
import { normalizeGenres } from './categories'

export const watchedKey = (i) => (i.media_type === 'tv' && i.tmdb_id ? `tv:${i.tmdb_id}` : i.media_type === 'movie' && i.tmdb_id ? `movie:${i.tmdb_id}` : `anime:${i.mal_id}`)

const lsKey = (uid) => `yoru:watched:${uid}`
const readLocal = (uid) => { try { return JSON.parse(localStorage.getItem(lsKey(uid)) || '[]') } catch { return [] } }
const writeLocal = (uid, items) => { try { localStorage.setItem(lsKey(uid), JSON.stringify(items)) } catch { /* ignore */ } }

let uid = null
let items = null // null = not loaded yet
let local = false // true once the table turned out to be missing
let snap = { items: null, keys: new Set() }
const subs = new Set()
const publish = () => {
  snap = { items, keys: new Set((items || []).map(watchedKey)) }
  subs.forEach((s) => s())
}
const subscribe = (cb) => { subs.add(cb); return () => subs.delete(cb) }
const getSnap = () => snap

let loading = null
async function load(user) {
  if (!user) { uid = null; items = null; local = false; publish(); return }
  if (uid === user.id && items) return
  if (uid !== user.id) { uid = user.id; items = null; local = false; publish() }
  if (loading) return loading
  loading = (async () => {
    const { data, error } = await udb.from('watched').select('*').eq('user_id', user.id).order('watched_at', { ascending: false })
    if (error) { local = true; items = readLocal(user.id) } else items = data || []
    publish()
  })().finally(() => { loading = null })
  return loading
}

export async function addWatched(user, item) {
  if (!user || !item) return false
  await load(user)
  const key = watchedKey(item)
  if ((items || []).some((x) => watchedKey(x) === key)) return true
  const row = {
    media_type: item.media_type, tmdb_id: item.tmdb_id || null, mal_id: item.mal_id || null, title: item.title,
    poster: item.poster || null, score: item.score || null, genres: item.genres || [], year: item.year || null,
    minutes: item.minutes || null, episodes: item.episodes || null, watched_at: new Date().toISOString(),
  }
  if (!local) {
    const { data, error } = await udb.from('watched').insert({ ...row, user_id: user.id }).select('*')
    if (error) { local = true } else { items = [data?.[0] || { ...row, user_id: user.id }, ...(items || [])]; publish(); return true }
  }
  items = [{ ...row, id: `l-${Date.now()}` }, ...(items || [])]
  writeLocal(user.id, items); publish()
  return true
}

export async function removeWatched(user, item) {
  if (!user || !item) return
  await load(user)
  const key = watchedKey(item)
  const gone = (items || []).filter((x) => watchedKey(x) === key)
  items = (items || []).filter((x) => watchedKey(x) !== key)
  publish()
  if (local) { writeLocal(user.id, items); return }
  for (const g of gone) if (g.id) await udb.from('watched').delete().eq('id', g.id).eq('user_id', user.id)
}

// ── Build a complete item (genres, runtime, …) from just an id ──────────────────────────────────
export const fromAnime = (d, malId) => {
  const per = parseInt(String(d.duration || '').match(/\d+/)?.[0] || '24', 10) || 24
  const eps = d.episodes || 12
  return {
    media_type: 'anime', mal_id: Number(malId || d.mal_id), title: d.title_english || d.title, poster: d.images?.jpg?.large_image_url || d.images?.jpg?.image_url || null,
    score: d.score || null, genres: normalizeGenres(d.genres), year: d.year || null, episodes: d.episodes || null, minutes: eps * per,
  }
}
export const fromMovie = (m) => ({
  media_type: 'movie', tmdb_id: m.id, title: m.title, poster: m.poster_path ? getTmdbImage(m.poster_path) : null, score: m.vote_average || null,
  genres: normalizeGenres((m.genres || []).map((g) => g.name)), year: Number((m.release_date || '').slice(0, 4)) || null, episodes: null, minutes: m.runtime || 100,
})
export const fromTV = (t) => ({
  media_type: 'tv', tmdb_id: t.id, title: t.name, poster: t.poster_path ? getTmdbImage(t.poster_path) : null, score: t.vote_average || null,
  genres: normalizeGenres((t.genres || []).map((g) => g.name)), year: Number((t.first_air_date || '').slice(0, 4)) || null,
  episodes: t.number_of_episodes || null, minutes: (t.number_of_episodes || 10) * ((t.episode_run_time || [])[0] || 42),
})

// From a saved row (My List / Continue watching): fetch the details, fall back to what the row has.
export async function buildFromRow(row) {
  const basic = { media_type: row.media_type || 'anime', tmdb_id: row.tmdb_id || null, mal_id: row.mal_id || null, title: row.title, poster: row.poster || null, score: row.score || null, genres: [], episodes: row.total_episodes || null, minutes: null }
  try {
    if (row.media_type === 'movie' && row.tmdb_id) return fromMovie(await getMovieDetails(row.tmdb_id))
    if (row.media_type === 'tv' && row.tmdb_id) return fromTV(await getTVDetails(row.tmdb_id))
    if (row.mal_id) { const r = await animeDetails(row.mal_id); if (r?.data) return fromAnime(r.data, row.mal_id) }
  } catch { /* use the basics */ }
  return basic
}

// "Mark as watched" from anywhere: builds the item, saves it and tells the user.
export async function markWatched(user, source, { onAuth } = {}) {
  if (!user) { onAuth?.(); return false }
  const item = source.media_type && source.genres ? source : await buildFromRow(source)
  const ok = await addWatched(user, item)
  if (ok) toast(`Marked “${item.title}” as watched`)
  return ok
}

export function useWatched(user) {
  const s = useSyncExternalStore(subscribe, getSnap)
  useEffect(() => { load(user) }, [user])
  return { items: s.items, ready: !!s.items, keys: s.keys, has: (i) => s.keys.has(watchedKey(i)) }
}
