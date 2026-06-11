const ANISKIP_API = 'https://api.aniskip.com/v2'
const CACHE_KEY = 'aniskip_cache_v1'
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function getCache() {
  if (!hasStorage()) return {}
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function setCache(cache) {
  if (!hasStorage()) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

export function clearAniSkipCache() {
  if (!hasStorage()) return
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {}
}

export async function fetchAniSkipTimings(malId, episodeNumber) {
  if (!malId || !episodeNumber) return null

  const cacheKey = `${malId}_${episodeNumber}`
  const cache = getCache()
  const hit = cache[cacheKey]

  if (hit && Date.now() < hit.expiresAt) {
    return hit.data
  }

  try {
    const url =
      `${ANISKIP_API}/skip-times/${malId}/${episodeNumber}` +
      `?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=0`

    const res = await fetch(url)

    if (res.status === 404) {
      cache[cacheKey] = { data: null, expiresAt: Date.now() + CACHE_TTL }
      setCache(cache)
      return null
    }

    if (!res.ok) return null

    const data = await res.json()

    if (!data.found || !Array.isArray(data.results) || data.results.length === 0) {
      cache[cacheKey] = { data: null, expiresAt: Date.now() + CACHE_TTL }
      setCache(cache)
      return null
    }

    const result = {}

    for (const entry of data.results) {
      const { skipType, interval } = entry
      if (!interval) continue

      if (skipType === 'op' || skipType === 'mixed-op') {
        result.intro = {
          startTime: interval.startTime,
          endTime: interval.endTime
        }
      } else if (skipType === 'ed' || skipType === 'mixed-ed') {
        result.outro = {
          startTime: interval.startTime,
          endTime: interval.endTime
        }
      } else if (skipType === 'recap') {
        result.recap = {
          startTime: interval.startTime,
          endTime: interval.endTime
        }
      }
    }

    const timings = Object.keys(result).length ? result : null
    cache[cacheKey] = { data: timings, expiresAt: Date.now() + CACHE_TTL }
    setCache(cache)
    return timings
  } catch {
    return null
  }
}