// AI recommendations (Google Gemini). Server-side only: the key lives in
// GEMINI_API_KEY (never a VITE_ variable, never sent to the browser).
//
// Optional: GEMINI_MODEL (defaults to "gemini-3.8-flash").

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.8-flash'
const DEFAULT_FALLBACKS = 'gemini-flash-latest'

const SYSTEM = `You are the recommendation engine for AniWave, a site for anime, movies and TV shows.
Suggest titles the user will love, based on their request and (optionally) what they already watched.
Rules:
- Only real, well-known titles that exist. Use the common English title.
- Never suggest anything already in the user's watched list.
- Never suggest adult / hentai / explicit content, and never suggest anything in the Mahou Shoujo genre.
- Match the requested type: "anime", "movie", "tv", or a mix when the type is "all".
- Prefer well-rated titles; vary the picks (do not return only sequels of one franchise).
- Reply with JSON only, shaped exactly as {"picks":[{"title":string,"type":"anime"|"movie"|"tv","year":number,"reason":string}]}.
- "reason" is ONE short, specific sentence (max 18 words) on why it fits this user. No spoilers.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    picks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          type: { type: 'STRING', enum: ['anime', 'movie', 'tv'] },
          year: { type: 'INTEGER' },
          reason: { type: 'STRING' },
        },
        required: ['title', 'type', 'reason'],
      },
    },
  },
  required: ['picks'],
}

// Tiny per-instance rate limit (per IP): 40 requests / 10 minutes.
const hits = new Map()
// For the health check: is a key present? (never returns the key itself)
export const status = (apiKey, model) => ({ configured: !!apiKey, model: model || DEFAULT_MODEL })

export function rateLimited(ip, now = Date.now()) {
  const win = 10 * 60 * 1000
  const list = (hits.get(ip) || []).filter((t) => now - t < win)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) hits.clear()
  return list.length > 40
}

const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)

export async function recommend(input, apiKey, model, fallbackList) {
  if (!apiKey) return { status: 503, json: { error: 'not_configured', message: 'AI picks are not set up yet.' } }

  const prompt = clean(input?.prompt, 300)
  const kind = ['anime', 'movie', 'tv'].includes(input?.kind) ? input.kind : 'all'
  const watched = (Array.isArray(input?.watched) ? input.watched : []).map((t) => clean(t, 80)).filter(Boolean).slice(0, 40)
  const count = Math.min(Math.max(parseInt(input?.count, 10) || 12, 4), 16)

  const userText = [
    `Request: ${prompt || 'Surprise me with great picks I might not know.'}`,
    `Type: ${kind}`,
    watched.length ? `Already watched / saved (do not repeat, use to infer taste): ${watched.join('; ')}` : 'No watch history available.',
    `Return exactly ${count} picks.`,
  ].join('\n')

  const makeBody = (withSchema) => JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { responseMimeType: 'application/json', ...(withSchema ? { responseSchema: SCHEMA } : {}), temperature: 0.9, maxOutputTokens: 8192 },
  })

  // Google sometimes answers 503 "high demand". Retry the main model once, then
  // fall back to other Flash models (GEMINI_FALLBACKS, comma-separated).
  const main = model || DEFAULT_MODEL
  const fallbacks = String(fallbackList ?? DEFAULT_FALLBACKS).split(',').map((m) => m.trim()).filter((m) => m && m !== main)
  const attempts = [{ m: main, schema: true }, { m: main, schema: true }, ...fallbacks.map((m) => ({ m, schema: true }))]
  const deadline = Date.now() + 9000
  let res = null
  for (let i = 0; i < attempts.length; i++) {
    if (i > 0 && Date.now() > deadline) break
    if (i === 1) await new Promise((r) => setTimeout(r, 700))
    try {
      res = await fetch(`${ENDPOINT}/${encodeURIComponent(attempts[i].m)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: makeBody(attempts[i].schema),
        signal: AbortSignal.timeout(Math.max(2500, Math.min(7000, deadline - Date.now()))),
      })
    } catch { res = null; continue }
    if (res.ok) break
    // 400 usually means this model dislikes the response schema: retry it once without.
    if (res.status === 400 && attempts[i].schema) { attempts.splice(i + 1, 0, { m: attempts[i].m, schema: false }); continue }
    if (![404, 429, 500, 502, 503, 504].includes(res.status)) break
  }
  if (!res) return { status: 504, json: { error: 'upstream', message: 'The AI took too long to answer. Try again.' } }

  if (!res.ok) {
    // Pass Google's own reason through (e.g. "API key not valid"), never the key.
    const err = await res.json().catch(() => null)
    const reason = clean(err?.error?.message, 160)
    const message = res.status === 429
      ? 'AI is busy right now. Try again in a minute.'
      : `AI error (${res.status})${reason ? `: ${reason}` : ''}`
    return { status: res.status === 429 ? 429 : 502, json: { error: 'upstream', message } }
  }
  const data = await res.json().catch(() => null)
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  const finish = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || ''
  let picks = []
  try {
    const raw = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(raw)
    picks = Array.isArray(parsed) ? parsed : (parsed?.picks || [])
  } catch { /* fall through */ }

  const seen = new Set()
  picks = picks
    .filter((p) => p && p.title && ['anime', 'movie', 'tv'].includes(p.type) && (kind === 'all' || p.type === kind))
    .filter((p) => { const k = p.type + ':' + String(p.title).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .map((p) => ({ title: clean(p.title, 120), type: p.type, year: Number(p.year) || null, reason: clean(p.reason, 200) }))
    .slice(0, count)

  if (!picks.length) return { status: 502, json: { error: 'empty', message: `No picks came back${finish && finish !== 'STOP' ? ` (${finish})` : ''}. Try rephrasing.` } }
  return { status: 200, json: { picks } }
}
