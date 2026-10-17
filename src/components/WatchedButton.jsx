import { useState } from 'react'
import { udb } from '../lib/udb'
import { toast } from '../lib/toast'
import { useWatched, addWatched, removeWatched, watchedKey } from '../lib/watched'

// Shelf button on detail pages: mark the whole show/movie as watched (and take it off Continue watching).
// build() → the item to save (media_type, ids, title, poster, genres, minutes …).
export default function WatchedButton({ user, build, onAuthRequired }) {
  const { has } = useWatched(user)
  const [busy, setBusy] = useState(false)
  const item = build?.()
  const on = !!item && has(item)

  const click = async () => {
    if (!user) return onAuthRequired?.()
    if (!item || busy) return
    setBusy(true)
    try {
      if (on) { await removeWatched(user, item); toast('Removed from Watched'); return }
      await addWatched(user, item)
      // Finished it: it no longer belongs under Continue watching.
      if (item.media_type === 'anime' && item.mal_id) await udb.from('currently_watching').delete().eq('user_id', user.id).eq('mal_id', item.mal_id)
      else if (item.tmdb_id) await udb.from('currently_watching_tmdb').delete().eq('user_id', user.id).eq('tmdb_id', item.tmdb_id).eq('media_type', item.media_type)
      toast(`Marked “${item.title}” as watched`)
    } finally { setBusy(false) }
  }

  return (
    <button className={'tvh-sc' + (on ? ' on' : '')} onClick={click} aria-pressed={on} disabled={!item}>
      {on
        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></svg>
        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>}
      <span>{on ? 'Watched' : 'Mark watched'}</span>
    </button>
  )
}
export { watchedKey }
