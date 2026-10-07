// Shared AllManga / AllAnime resolver (server-side).
// Used by the Vercel serverless function (api/allanime.js) and the Vite dev
// middleware (vite.config.js). Runs server-side because AllAnime requires
// Referer/Origin headers that browsers can't set cross-origin.
//
// Ported from ani-cli 4.15 (github.com/pystardust/ani-cli), which tracks
// AllAnime's changes. As of that version AllAnime:
//   • moved its API to api.mkissa.net and expects Referer/Origin https://mkissa.to
//   • requires an encrypted "aaReq" token on every episode request
//     (AES-256-GCM with a key rebuilt from their site's own JS bundle)
//   • returns episode sources AES-256-GCM-encrypted in a "tobeparsed" field

import crypto from 'node:crypto'

const API = 'https://api.mkissa.net/api'
const REFR = 'https://mkissa.to'
const CDN = 'https://cdn.mkissa.net/all/mk/_app/immutable'
const CLOCK_HOST = 'https://allanime.day' // provider "clock" links still live here
const QUERY_HASH = 'f4662f4b7510b26795dd53ef824a0bf1740fbbc5d1273fab18222ac831bca8d0'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0'
const BASE_HEADERS = { 'User-Agent': UA, Referer: REFR, Origin: REFR, Accept: '*/*' }

const SEARCH_GQL =
  'query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name englishName thumbnail availableEpisodes __typename}}}'

// Best first. Default = wixmp (multi-quality mp4), S-mp4 = sharepoint,
// Yt-mp4 = fast4speed, Mp4 = mp4upload.
const PROVIDER_PRIORITY = ['Default', 'S-mp4', 'Yt-mp4', 'Mp4', 'Luf-Mp4', 'Sl-Hls', 'Uv-mp4']

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function timeout(ms = 9000) {
  try { return AbortSignal.timeout(ms) } catch { return undefined }
}
async function getText(url, headers = BASE_HEADERS, ms = 8000) {
  const r = await fetch(url, { headers, redirect: 'follow', signal: timeout(ms) })
  return { status: r.status, body: await r.text(), finalUrl: r.url }
}

// ── Key (rebuilt from AllAnime's own site, like ani-cli's fetch_keys) ───────
// key = mask (a 64-hex constant inside their JS chunks) XOR base64(partB from the page)
let keyCache = { at: 0, key: null, epoch: null }

async function fetchKeys(force = false) {
  if (!force && keyCache.key && Date.now() - keyCache.at < 30 * 60 * 1000) return keyCache
  const page = (await getText(REFR, { 'User-Agent': UA }, 10000)).body
  const epoch = page.match(/"epoch":(\d+)/)?.[1]
  const partB = page.match(/"partB":"([^"]*)"/)?.[1]
  const cdnRe = new RegExp(`${CDN.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}/entry/app\\.[A-Za-z0-9_.-]+\\.js`)
  const appUrl = page.match(cdnRe)?.[0]
  if (!epoch || !partB || !appUrl) throw new Error('AllAnime key: page layout changed')

  const appJs = (await getText(appUrl, { 'User-Agent': UA }, 10000)).body
  const chunks = [...appJs.matchAll(/"[.][.]\/chunks\/([A-Za-z0-9_.-]+\.js)"/g)].slice(0, 5).map((m) => `${CDN}/chunks/${m[1]}`)
  const bodies = await Promise.all(chunks.map((u) => getText(u, { 'User-Agent': UA }, 10000).then((r) => r.body).catch(() => '')))
  const maskHex = bodies.join('\n').match(/[0-9a-f]{64}/)?.[0]
  if (!maskHex) throw new Error('AllAnime key: mask not found')

  const mask = Buffer.from(maskHex, 'hex')
  const pb = Buffer.from(partB, 'base64')
  const key = Buffer.alloc(32)
  for (let i = 0; i < 32; i++) key[i] = mask[i] ^ (pb[i] ?? 0)

  keyCache = { at: Date.now(), key, epoch: Number(epoch) }
  return keyCache
}

// aaReq = base64( 0x01 | iv(12) | AES-256-GCM(payload) | tag(16) )
// iv = first 12 bytes of sha256("epoch:queryHash:ts"), ts rounded to 5 min.
function buildAaReq({ key, epoch }) {
  const ts = Math.floor(Date.now() / 1000 / 300) * 300 * 1000
  const iv = crypto.createHash('sha256').update(`${epoch}:${QUERY_HASH}:${ts}`).digest().subarray(0, 12)
  const payload = JSON.stringify({ v: 1, ts, epoch, qh: QUERY_HASH })
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([c.update(payload, 'utf8'), c.final()])
  return Buffer.concat([Buffer.from([1]), iv, ct, c.getAuthTag()]).toString('base64')
}

// "tobeparsed" = base64( 0x01 | iv(12) | ciphertext | tag(16) ), AES-256-GCM
function decryptTobeparsed(blob, key) {
  try {
    const buf = Buffer.from(blob, 'base64')
    const iv = buf.subarray(1, 13)
    const body = buf.subarray(13)
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv)
    d.setAuthTag(body.subarray(body.length - 16))
    return Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()]).toString('utf8')
  } catch {
    return null
  }
}

// ── Source-URL decoder (hex substitution, same table as ani-cli) ─────────────
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
  if (!enc.startsWith('--')) return enc
  enc = enc.slice(2)
  let out = ''
  for (let i = 0; i < enc.length; i += 2) {
    const pair = enc.slice(i, i + 2)
    out += HEX_MAP[pair] !== undefined ? HEX_MAP[pair] : pair
  }
  return out.replace('/clock', '/clock.json')
}

// Pull { sourceUrl, sourceName } pairs out of the (decrypted) episode JSON.
function parseSources(text) {
  const out = []
  const clean = String(text).replace(/\\u002F/gi, '/').replace(/\\/g, '')
  for (const chunk of clean.split(/[{}]/)) {
    const u = chunk.match(/sourceUrl":"([^"]*)"/)
    const n = chunk.match(/sourceName":"([^"]*)"/)
    if (u && n) out.push({ sourceUrl: u[1], sourceName: n[1] })
  }
  return out
}

// ── Episode request (persisted query + aaReq) ────────────────────────────────
async function fetchEpisodeSources(showId, trans, episodeString) {
  let keys = await fetchKeys()
  for (let attempt = 0; attempt < 2; attempt++) {
    const variables = JSON.stringify({ showId, translationType: trans, episodeString })
    const extensions = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: QUERY_HASH }, aaReq: buildAaReq(keys) })
    const url = `${API}?variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`
    const { body } = await getText(url, BASE_HEADERS, 9000)
    const tb = body.match(/"tobeparsed"\s*:\s*"([^"]+)"/)?.[1]
    const plain = tb ? decryptTobeparsed(tb, keys.key) : body
    if (plain) {
      const sources = parseSources(plain)
      if (sources.length) return sources
    }
    // Key may have rotated — rebuild it once and retry.
    if (attempt === 0) keys = await fetchKeys(true)
  }
  return []
}

// ── wixmp repackager → direct mp4 (highest quality) ─────────────────────────
function wixmpDirect(link) {
  if (!link.includes('repackager.wixmp.com')) return null
  const m = link.match(/,([^/]*),\//)
  if (!m) return null
  const qualities = m[1].split(',').filter(Boolean)
  const best = qualities[qualities.length - 1] || qualities[0]
  const base = link.replace('repackager.wixmp.com/', '').replace(/\.urlset.*$/, '')
  const direct = base.replace(/,[^/]*,\//, best + '/')
  return { url: direct, quality: best, type: 'mp4' }
}

// Turn one provider source into playable link(s). Each result says which
// Referer the file host wants (the iPhone app sends it when downloading).
async function resolveSource(src) {
  const path = decodeUrl(src.sourceUrl)

  // mp4upload: scrape the embed page for the direct file.
  if (/mp4upload/.test(path)) {
    try {
      const { body } = await getText(path, { ...BASE_HEADERS, Referer: REFR })
      const file = body.match(/src:\s*"([^"]*)"/)?.[1]
      if (file) return [{ sourceName: src.sourceName, url: file, quality: 'auto', type: 'mp4', referer: 'https://www.mp4upload.com/' }]
    } catch { /* ignore */ }
    return []
  }

  // fast4speed (Yt-mp4): the URL itself is the file (needs our Referer).
  if (/tools\.fast4speed\.rsvp/.test(path)) {
    const url = path.startsWith('//') ? 'https:' + path : path
    return [{ sourceName: src.sourceName, url, quality: 'auto', type: 'mp4', referer: REFR }]
  }

  // Everything else: a "clock" JSON on allanime.day listing the real links.
  let url = path
  if (url.startsWith('//')) url = 'https:' + url
  else if (url.startsWith('/')) url = CLOCK_HOST + url
  else if (!url.startsWith('http')) url = CLOCK_HOST + '/' + url

  let res
  try { res = await getText(url) } catch { return [] }
  if (res.status !== 200 || !res.body) return []
  let json
  try { json = JSON.parse(res.body) } catch { return [] }

  const out = []
  for (const l of json?.links || []) {
    if (!l?.link) continue
    const direct = wixmpDirect(l.link)
    if (direct) { out.push({ sourceName: src.sourceName, ...direct, referer: REFR }); continue }
    const isHls = l.link.includes('.m3u8') || !!l.hls
    out.push({
      sourceName: src.sourceName,
      url: l.link,
      quality: l.resolutionStr || 'auto',
      type: isHls ? 'hls' : 'mp4',
      referer: l.headers?.Referer || REFR,
    })
  }
  return out
}

// ── Public ops ───────────────────────────────────────────────────────────────
export async function searchShows({ query, translationType = 'sub', countryOrigin = 'ALL', limit = 26, page = 1 }) {
  const variables = {
    search: { allowAdult: false, allowUnknown: false, query: String(query || '').toLowerCase() },
    limit: Number(limit) || 26, page: Number(page) || 1, translationType, countryOrigin,
  }
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { ...BASE_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables, query: SEARCH_GQL }),
      signal: timeout(8000),
    })
    return (await r.json())?.data?.shows?.edges || []
  } catch {
    return []
  }
}

function sanitize(t = '') {
  return t.replace(/['’`´]/g, '').replace(/[:!.]/g, '').replace(/\s+/g, ' ').trim()
}

async function streamsForShow(showId, epStr, trans) {
  const epCandidates = epStr.includes('.') ? [epStr] : [epStr, epStr + '.0']
  let sources = []
  for (const ep of epCandidates) {
    sources = await fetchEpisodeSources(showId, trans, ep)
    if (sources.length) break
  }
  if (!sources.length) return []

  sources.sort((a, b) => {
    const ai = PROVIDER_PRIORITY.indexOf(a.sourceName)
    const bi = PROVIDER_PRIORITY.indexOf(b.sourceName)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  // Resolve every provider in parallel; keep whatever works, in priority order.
  const settled = await Promise.allSettled(sources.map((s) => resolveSource(s)))
  const streams = []
  for (const r of settled) if (r.status === 'fulfilled') for (const g of r.value) if (g?.url) streams.push(g)
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
      score += Math.min(avail, 30) / 30
      return { e, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e)
}

// Resolve playable streams for a title + episode (+ sub/dub).
// Returns { ok, streams: [{sourceName,url,quality,type,referer}], showId, matched }
//      or { ok:false, reason, error }.
export async function resolveEpisode({ title, alt, showId, episode = 1, translationType = 'sub' }) {
  const altTitles = String(alt || '').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 4)
  const allTitles = [title, ...altTitles].filter(Boolean)
  const trans = translationType === 'dub' ? 'dub' : translationType === 'raw' ? 'raw' : 'sub'
  const epStr = String(episode)
  const epNum = Number(episode) || 1

  try {
    if (showId) {
      const streams = await streamsForShow(showId, epStr, trans)
      if (streams.length) return { ok: true, showId, matched: title, streams }
      return { ok: false, reason: 'no_episode', error: 'No playable links found' }
    }

    const queries = [...new Set(allTitles.flatMap((t) => [t, sanitize(t)]).filter(Boolean))].slice(0, 6)
    const byId = new Map()
    for (const q of queries) {
      const edges = await searchShows({ query: q, translationType: trans })
      for (const e of edges || []) if (!byId.has(e._id)) byId.set(e._id, e)
      if (byId.size >= 12) break
    }
    if (!byId.size) return { ok: false, reason: 'no_show', error: `AllManga has no show called "${title}"` }

    const ranked = rankShows([...byId.values()], allTitles, epNum, trans).slice(0, 3)
    for (const show of ranked) {
      const streams = await streamsForShow(show._id, epStr, trans)
      if (streams.length) return { ok: true, showId: show._id, matched: show.englishName || show.name, streams }
    }
    const best = ranked[0]
    return {
      ok: false,
      reason: 'no_episode',
      matched: best?.englishName || best?.name,
      error: `AllManga found "${best?.englishName || best?.name}" but has no ${trans.toUpperCase()} files for episode ${epStr}`,
    }
  } catch (e) {
    // Key/handshake failures mean AllAnime changed again — say so plainly.
    return { ok: false, reason: 'upstream', error: `AllManga changed how it works (${e?.message || 'handshake failed'})` }
  }
}

// Single dispatcher used by both the Vercel handler and the dev middleware.
export async function handleAllanime(action, params) {
  if (action === 'search') return { results: await searchShows(params) }
  if (action === 'resolve') return await resolveEpisode(params)
  return { ok: false, error: 'Unknown action: ' + action }
}
