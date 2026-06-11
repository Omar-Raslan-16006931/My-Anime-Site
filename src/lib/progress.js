// Local watch tracking — recently watched + per-episode progress.
// Works without auth (localStorage). Supabase remains the source of truth for
// signed-in cross-device sync; this layer guarantees the "Continue watching"
// and "Recently watched" rows always have data on the current device.

const RECENT_KEY = 'recently_watched_v1'
const RECENT_MAX = 30

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || fallback) } catch { return JSON.parse(fallback) }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
}

// item: { kind:'anime'|'tv'|'movie', id, title, poster, backdrop,
//         season?, episode?, totalEpisodes? }
export function recordRecent(item) {
  if (!item?.id) return
  const list = read(RECENT_KEY, '[]')
  const key = `${item.kind}:${item.id}`
  const next = [
    { ...item, key, updatedAt: Date.now() },
    ...list.filter((x) => x.key !== key),
  ].slice(0, RECENT_MAX)
  write(RECENT_KEY, next)
}

export function getRecent() {
  return read(RECENT_KEY, '[]')
}

export function removeRecent(kind, id) {
  const list = read(RECENT_KEY, '[]')
  write(RECENT_KEY, list.filter((x) => x.key !== `${kind}:${id}`))
}

export function hrefFor(item) {
  if (item.kind === 'tv') return `/tv/${item.id}`
  if (item.kind === 'movie') return `/movie/${item.id}`
  return `/anime/${item.id}`
}

export function progressLabel(item) {
  if (item.kind === 'movie') return 'Movie'
  if (item.kind === 'tv') return `S${item.season || 1} · E${item.episode || 1}`
  return `Episode ${item.episode || 1}${item.totalEpisodes ? ` / ${item.totalEpisodes}` : ''}`
}

// Fractional progress for the thin bar under continue-watching cards.
export function progressFraction(item) {
  if (item.kind === 'movie') return 0
  const ep = Number(item.episode) || 0
  const total = Number(item.totalEpisodes) || 0
  if (!total || !ep) return 0
  return Math.min(1, ep / total)
}
