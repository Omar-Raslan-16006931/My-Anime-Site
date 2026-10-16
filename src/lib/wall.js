// Artwork for the Profiles and Sign-up backdrops: popular anime posters + banners.
import { useEffect, useState } from 'react'
import { animeList } from './anime'

let cache = null
export function usePosterWall() {
  const [wall, setWall] = useState(cache || { posters: [], banners: [] })
  useEffect(() => {
    if (cache) return undefined
    let alive = true
    animeList('popular', 30).then((l) => {
      const posters = (l || []).map((a) => a.images?.jpg?.large_image_url).filter(Boolean)
      const banners = (l || []).map((a) => a.banner).filter(Boolean)
      cache = { posters, banners }
      if (alive) setWall(cache)
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return wall
}
