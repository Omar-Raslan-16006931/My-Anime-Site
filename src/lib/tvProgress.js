// Per-episode "watched" state for TV shows.
//
// Stored in Supabase (public.tv_episode_progress, see db/tv_episode_progress.sql)
// AND mirrored in localStorage. If the table hasn't been created yet, everything
// keeps working from localStorage on this device — nothing breaks.
import { supabase } from '../supabase'

const LS_KEY = 'aw:tvseen'
const TABLE = 'tv_episode_progress'
let tableMissing = false

const epKey = (season, episode) => `${Number(season)}:${Number(episode)}`

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function lsSave(all) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)) } catch { /* ignore */ }
}

// PostgREST says the relation doesn't exist → stop asking, use localStorage.
function noteMissing(error) {
  if (!error) return
  const code = String(error.code || '')
  if (code === 'PGRST205' || code === '42P01' || /does not exist|schema cache/i.test(error.message || '')) tableMissing = true
}

// → Set of "season:episode" strings marked as watched.
export async function loadTvSeen(userId, tmdbId) {
  const id = String(tmdbId)
  const seen = new Set(lsLoad()[id] || [])
  if (userId && !tableMissing) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('season_number, episode_number')
      .eq('user_id', userId).eq('tmdb_id', Number(tmdbId)).eq('seen', true)
    if (error) noteMissing(error)
    else (data || []).forEach((r) => seen.add(epKey(r.season_number, r.episode_number)))
  }
  return seen
}

export async function setTvSeen(userId, tmdbId, season, episode, isSeen = true) {
  const id = String(tmdbId)
  const k = epKey(season, episode)

  const all = lsLoad()
  const list = new Set(all[id] || [])
  if (isSeen) list.add(k); else list.delete(k)
  all[id] = [...list]
  lsSave(all)

  if (!userId || tableMissing) return
  const base = { user_id: userId, tmdb_id: Number(tmdbId), season_number: Number(season), episode_number: Number(episode) }
  if (isSeen) {
    const now = new Date().toISOString()
    const { error } = await supabase.from(TABLE).upsert(
      { ...base, seen: true, seen_at: now, updated_at: now },
      { onConflict: 'user_id,tmdb_id,season_number,episode_number' }
    )
    noteMissing(error)
  } else {
    const { error } = await supabase.from(TABLE).delete()
      .eq('user_id', userId).eq('tmdb_id', base.tmdb_id)
      .eq('season_number', base.season_number).eq('episode_number', base.episode_number)
    noteMissing(error)
  }
}

export const tvEpKey = epKey
