import { supabase } from '../supabase'

export async function addToWatching(user, anime, episode = 1) {
  if (!user) return
  await supabase.from('currently_watching').upsert({
    user_id: user.id,
    mal_id: anime.mal_id,
    title: anime.title_english || anime.title,
    poster: anime.images?.jpg?.large_image_url,
    score: anime.score,
    last_episode: episode,
    total_episodes: anime.episodes || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,mal_id' })
}

export async function removeFromWatching(userId, malId) {
  await supabase.from('currently_watching')
    .delete()
    .eq('user_id', userId)
    .eq('mal_id', malId)
}

export async function getWatchingList(userId) {
  const { data } = await supabase
    .from('currently_watching')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  return data || []
}