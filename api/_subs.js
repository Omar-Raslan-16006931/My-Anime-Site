// Shared English-subtitle fetcher (server-side only).
// Used by the Vercel function (api/subs.js) and the Vite dev middleware.
//
// Source: Wyzie Subs (https://docs.wyzie.io). The API key lives ONLY here, read
// from the WYZIE_API_KEY env var — it is never sent to the browser.
// Uses the one-call /download endpoint: search + best match + conversion
// (to=vtt for browsers/VidLink, to=srt for uploading into other players).

const WYZIE_DOWNLOAD = 'https://sub.wyzie.io/download'

export async function fetchSubtitle(query = {}, key) {
  if (!key) {
    return { status: 503, json: { error: 'Subtitles are not set up yet (missing WYZIE_API_KEY).' } }
  }

  const id = String(query.id || '').trim()
  if (!/^(tt\d{5,10}|\d{1,9})$/.test(id)) return { status: 400, json: { error: 'Invalid id' } }

  const to = query.to === 'srt' ? 'srt' : 'vtt'
  const lang = /^[a-z]{2}$/.test(String(query.lang || '')) ? String(query.lang) : 'en'

  const params = new URLSearchParams({ id, language: lang, to, source: 'charlie,lima', key })

  const season = query.season != null ? String(query.season) : ''
  const episode = query.episode != null ? String(query.episode) : ''
  if (season || episode) {
    if (!/^\d{1,3}$/.test(season) || !/^\d{1,5}$/.test(episode)) {
      return { status: 400, json: { error: 'Both season and episode are required' } }
    }
    params.set('season', season)
    params.set('episode', episode)
  }

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 15000)
  try {
    const r = await fetch(`${WYZIE_DOWNLOAD}?${params}`, { signal: ctl.signal })
    if (!r.ok) {
      let message = ''
      try { message = (await r.json())?.message || '' } catch { /* not JSON */ }
      // Wyzie answers 400 "No subtitles found" when nothing matches.
      const status = r.status === 400 ? 404 : r.status
      return { status, json: { error: message || `Subtitle service error (${r.status})` } }
    }
    const body = await r.text()
    if (!body.trim()) return { status: 404, json: { error: 'No subtitles found' } }
    return {
      status: 200,
      body,
      ext: to,
      type: to === 'srt' ? 'application/x-subrip; charset=utf-8' : 'text/vtt; charset=utf-8',
    }
  } catch {
    return { status: 504, json: { error: 'Subtitle service timed out' } }
  } finally {
    clearTimeout(timer)
  }
}

// "Some Show S1E2" → "Some Show S1E2" made filename-safe.
export function safeFileName(name) {
  return String(name || 'subtitles').replace(/[^\w .()-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 90) || 'subtitles'
}
