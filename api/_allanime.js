// Shared AllManga / AllAnime resolver (server-side).
// Used by the Vercel serverless function (api/allanime.js) and the Vite dev
// middleware (vite.config.js). Runs server-side because AllAnime requires a
// `Referer: https://allmanga.to` header that browsers cannot set cross-origin.

import crypto from 'node:crypto'

const GQL = 'https://api.allanime.day/api'
const CLOCK_HOST = 'https://allanime.day'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
const BASE_HEADERS = {
  'User-Agent': UA,
  Referer: 'https://allmanga.to',
  Origin: 'https://allmanga.to',
  Accept: '*/*',
}

const SEARCH_GQL =
  'query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name englishName thumbnail availableEpisodes __typename}}}'
const EPISODE_GQL =
  'query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}'
// SHA-256 of EPISODE_GQL — enables the APQ GET path (ani-cli fix) that bypasses
// the Cloudflare block that breaks POST-only clients.
const EPISODE_GQL_HASH =
  'd405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec'

const PROVIDER_PRIORITY = ['Default', 'S-mp4', 'Luf-Mp4', 'Sl-Hls', 'Uv-mp4', 'Yt-mp4']

// ── Decoders (ported from ani-cli / streambert) ──────────────────────────────
const HEX_MAP = {
  79:'A','7a':'B','7b':'C','7c':'D','7d':'E','7e':'F','7f':'G',70:'H',71:'I',72:'J',
  73:'K',74:'L',75:'M',76:'N',77:'O',68:'P',69:'Q','6a':'R','6b':'S','6c':'T','6d':'U',
  '6e':'V','6f':'W',60:'X',61:'Y',62:'Z',59:'a','5a':'b','5b':'c','5c':'d','5d':'e',
  '5e':'f','5f':'g',50:'h',51:'i',52:'j',53:'k',54:'l',55:'m',56:'n',57:'o',48:'p',
  49:'q','4a':'r','4b':'s','4c':'t','4d':'u','4e':'v','4f':'w',40:'x',41:'y',42:'z',
  '08':'0','09':'1','0a':'2','0b':'3','0c':'4','0d':'5','0e':'6','0f':'7','00':'8',
  '01':'9',15:'-',16:'.',67:'_',46:'~','02':':',17:'/','07':'?','1b':'#',63:'[',
  65:']',78:'@',19:'!','1c':'$','1e':'&',10:'(',11:')',12:'*',13:'+',14:',','03':';','05':'=','1d':'%',
}
function decodeUrl(enc) {
  if (enc.startsWith('--')) enc = enc.slice(2)
  let out = ''
  for (let i = 0; i < enc.length; i += 2) {
    const pair = enc.slice(i, i + 2)
    out += HEX_MAP[pair] !== undefined ? HEX_MAP[pair] : pair
  }
  return out.replace(/\\u002F/gi, '/').replace(/\\\|/g, '')
}

const AES_KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest()
function decodeTobeparsed(blob) {
  try {
    const buf = Buffer.from(blob, 'base64')
    const iv = Buffer.concat([buf.slice(1, 13), Buffer.from([0, 0, 0, 2])])
    const ct = buf.slice(13, buf.length - 16)
    const d = crypto.createDecipheriv('aes-256-ctr', AES_KEY, iv)
    d.setAutoPadding(false)
    const plain = Buffer.concat([d.update(ct), d.final()]).toString('utf8')
    const out = []
    for (const chunk of plain.split(/[{}]/)) {
      const u = chunk.match(/"sourceUrl"\s*:\s*"(--[^"]+)"/)
      const n = chunk.match(/"sourceName"\s*:\s*"([^"]+)"/)
      const p = chunk.match(/"priority"\s*:\s*([0-9.]+)/)
      if (u) out.push({ sourceUrl: u[1], sourceName: n ? n[1] : '', priority: p ? parseFloat(p[1]) : 0 })
    }
    return out
  } catch {
    return []
  }
}

function parseSourceUrls(body) {
  const tb = body.match(/"tobeparsed"\s*:\s*"([^"]+)"/)
  if (tb) {
    const s = decodeTobeparsed(tb[1])
    if (s.length) return s
  }
  try {
    const u = JSON.parse(body)?.data?.episode?.sourceUrls
    return u?.length ? u : null
  } catch {
    return null
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
// Every outbound request is bounded so a single hanging upstream can't stall
// the whole resolve (which fans out across several shows × providers).
function timeout(ms = 9000) {
  try { return AbortSignal.timeout(ms) } catch { return undefined }
}

async function gqlPost(variables, query) {
  const r = await fetch(GQL, {
    method: 'POST',
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ variables, query }),
    signal: timeout(8000),
  })
  return { status: r.status, body: await r.text() }
}

async function gqlEpisode(variables) {
  // Try APQ GET first (Origin must be youtu-chan.com for this path).
  try {
    const v = encodeURIComponent(JSON.stringify(variables))
    const e = encodeURIComponent(
      JSON.stringify({ persistedQuery: { version: 1, sha256Hash: EPISODE_GQL_HASH } })
    )
    const r = await fetch(`${GQL}?variables=${v}&extensions=${e}`, {
      headers: { ...BASE_HEADERS, Origin: 'https://youtu-chan.com' },
      signal: timeout(8000),
    })
    const body = await r.text()
    if (body.includes('tobeparsed') || body.includes('sourceUrls')) return { status: r.status, body }
  } catch {
    /* fall through */
  }
  return gqlPost(variables, EPISODE_GQL)
}

async function getText(url) {
  const r = await fetch(url, { headers: BASE_HEADERS, redirect: 'follow', signal: timeout(8000) })
  return { status: r.status, body: await r.text(), finalUrl: r.url }
}

// ── wixmp repackager → direct mp4 (highest quality) ─────────────────────────
function wixmpDirect(link) {
  if (!link.includes('repackager.wixmp.com')) return null
  const m = link.match(/,([^/]*),\//)
  if (!m) return null
  const qualities = m[1].split(',').filter(Boolean)
  const best = qualities[qualities.length - 1] || qualities[0]
  // `link` already carries its scheme (https://repackager.wixmp.com/...); after
  // stripping the repackager host + `.urlset` suffix the base keeps that scheme.
  const base = link.replace('repackager.wixmp.com/', '').replace(/\.urlset.*$/, '')
  const direct = base.replace(/,[^/]*,\//, best + '/')
  return { url: direct, quality: best, type: 'mp4' }
}

// ── Resolve a decoded clock source into playable link(s) ─────────────────────
async function resolveClockSource(src) {
  let path = decodeUrl(src.sourceUrl).replace('/clock', '/clock.json')

  // Yt-mp4 / fast4speed: redirect chain to a direct CDN url.
  if (path.includes('fast4speed.rsvp') || src.sourceName === 'Yt-mp4') {
    let url = path
    if (url.startsWith('//')) url = 'https:' + url
    else if (url.startsWith('/')) url = CLOCK_HOST + url
    try {
      const r = await fetch(url, { method: 'GET', headers: BASE_HEADERS, redirect: 'follow', signal: timeout(8000) })
      const finalUrl = r.url
      if (/\.(mp4|webm|m3u8)(\?|$)/i.test(finalUrl) || !finalUrl.includes('youtube')) {
        return [{
          sourceName: src.sourceName,
          url: finalUrl,
          quality: 'auto',
          type: finalUrl.includes('.m3u8') ? 'hls' : 'mp4',
        }]
      }
    } catch { /* ignore */ }
    return []
  }

  let url = path
  if (url.startsWith('//')) url = 'https:' + url
  else if (url.startsWith('/')) url = CLOCK_HOST + url
  else if (!url.startsWith('http')) url = CLOCK_HOST + '/' + url

  const res = await getText(url)
  if (res.status !== 200 || !res.body) return []
  let json
  try { json = JSON.parse(res.body) } catch { return [] }
  const links = (json?.links || []).filter((l) => l.link)
  if (!links.length) return []

  const out = []
  for (const l of links) {
    const direct = wixmpDirect(l.link)
    if (direct) {
      out.push({ sourceName: src.sourceName, ...direct })
      continue
    }
    out.push({
      sourceName: src.sourceName,
      url: l.link,
      quality: l.resolutionStr || 'auto',
      type: l.link.includes('.m3u8') || l.hls ? 'hls' : 'mp4',
    })
  }
  return out
}

// ── Public ops ───────────────────────────────────────────────────────────────
export async function searchShows({ query, translationType = 'sub', countryOrigin = 'ALL', limit = 26, page = 1 }) {
  const vars = {
    search: { allowAdult: false, allowUnknown: false, query: String(query || '').toLowerCase() },
    limit, page, translationType, countryOrigin,
  }
  const r = await gqlPost(vars, SEARCH_GQL)
  try {
    return JSON.parse(r.body)?.data?.shows?.edges || []
  } catch {
    return []
  }
}

function sanitize(t = '') {
  return t.replace(/[''`´]/g, '').replace(/[:!.]/g, '').replace(/\s+/g, ' ').trim()
}

// Pull and resolve playable streams for one show + episode.
async function streamsForShow(showId, epStr, trans) {
  const epCandidates = epStr.includes('.') ? [epStr] : [epStr, epStr + '.0']
  let sourceUrls = null
  for (const attempt of epCandidates) {
    const r = await gqlEpisode({ showId, translationType: trans, episodeString: attempt })
    if (!r.body) continue
    const urls = parseSourceUrls(r.body)
    if (urls?.length) { sourceUrls = urls; break }
  }
  if (!sourceUrls?.length) return []

  const decoded = sourceUrls
    .filter((s) => s.sourceUrl?.startsWith('--'))
    .sort((a, b) => {
      const ai = PROVIDER_PRIORITY.indexOf(a.sourceName)
      const bi = PROVIDER_PRIORITY.indexOf(b.sourceName)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  // Resolve every provider's clock in parallel so one slow CDN doesn't gate the
  // others — return whatever resolves, ordered by provider priority.
  const settled = await Promise.allSettled(decoded.map((s) => resolveClockSource(s)))
  const streams = []
  for (const r of settled) {
    if (r.status === 'fulfilled') for (const g of r.value) if (g?.url) streams.push(g)
  }
  return streams
}

// Rank candidate shows: exact title match first, then those that actually have
// the requested episode available, then by how close the name is.
function rankShows(edges, titles, episode, trans) {
  const wanted = (Array.isArray(titles) ? titles : [titles]).map((t) => String(t).toLowerCase().trim()).filter(Boolean)
  return [...edges]
    .map((e) => {
      const names = [e.englishName, e.name].filter(Boolean).map((n) => n.toLowerCase())
      const avail = e.availableEpisodes?.[trans] || 0
      let score = 0
      if (names.some((n) => wanted.includes(n))) score += 100
      if (names.some((n) => wanted.some((w) => n.includes(w) || w.includes(n)))) score += 40
      if (avail >= episode) score += 20
      score += Math.min(avail, 30) / 30 // prefer fuller catalogues as a tiebreak
      return { e, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e)
}

// Resolve playable streams for a title + episode (+ sub/dub).
// Returns { ok, streams: [{sourceName,url,quality,type}], showId, matched } or { ok:false, error }.
export async function resolveEpisode({ title, alt, showId, episode = 1, translationType = 'sub' }) {
  // Other names for the show ("a|b|c"): AllManga often lists anime under the
  // romaji title, so an English-only search can miss it entirely.
  const altTitles = String(alt || '').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 4)
  const allTitles = [title, ...altTitles].filter(Boolean)
  const trans = translationType === 'dub' ? 'dub' : translationType === 'raw' ? 'raw' : 'sub'
  const epStr = String(episode)
  const epNum = Number(episode) || 1

  if (showId) {
    const streams = await streamsForShow(showId, epStr, trans)
    if (streams.length) return { ok: true, showId, matched: title, streams }
    return { ok: false, error: 'No playable links found' }
  }

  const queries = [...new Set(allTitles.flatMap((t) => [t, sanitize(t)]).filter(Boolean))].slice(0, 6)
  // Gather candidates from every name (deduped), not just the first that hits.
  const byId = new Map()
  for (const q of queries) {
    const edges = await searchShows({ query: q, translationType: trans })
    for (const e of edges || []) if (!byId.has(e._id)) byId.set(e._id, e)
    if (byId.size >= 12) break
  }
  if (!byId.size) return { ok: false, reason: 'no_show', error: `AllManga has no show called "${title}"` }

  // Try the top-ranked candidate shows until one yields a playable stream.
  const ranked = rankShows([...byId.values()], allTitles, epNum, trans).slice(0, 3)
  for (const show of ranked) {
    const streams = await streamsForShow(show._id, epStr, trans)
    if (streams.length) {
      return { ok: true, showId: show._id, matched: show.englishName || show.name, streams }
    }
  }
  const best = ranked[0]
  return {
    ok: false,
    reason: 'no_episode',
    matched: best?.englishName || best?.name,
    error: `AllManga found "${best?.englishName || best?.name}" but has no ${trans.toUpperCase()} files for episode ${epStr}`,
  }
}

// Single dispatcher used by both the Vercel handler and the dev middleware.
export async function handleAllanime(action, params) {
  if (action === 'search') {
    const results = await searchShows(params)
    return { results }
  }
  if (action === 'resolve') {
    return await resolveEpisode(params)
  }
  return { ok: false, error: 'Unknown action: ' + action }
}
