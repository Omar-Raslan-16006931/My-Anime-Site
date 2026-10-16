// AI recommendations (Google Gemini). Server-side only: the key lives in
// GEMINI_API_KEY (never a VITE_ variable, never sent to the browser).
//
// Optional: GEMINI_MODEL (defaults to "gemini-flash-latest").

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-flash-latest'

const SYSTEM = `You are the recommendation engine for AniWave, a site for anime, movies and TV shows.
Suggest titles the user will love, based on their request and (optionally) what they already watched.
Rules:
- Only real, well-known titles that exist. Use the common English title.
- Never suggest anything already in the user's watched list.
- Never suggest adult / hentai / explicit content, and never suggest anything in the Mahou Shoujo genre.
- Match the requested type: "anime", "movie", "tv", or a mix when the type is "all".
- Prefer well-rated titles; vary the picks (do not return only sequels of one franchise).
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

// Tiny per-instance rate limit (per IP): 12 requests / 10 minutes.
const hits = new Map()
// For the health check: is a key present? (never returns the key itself)
export const status = (apiKey, model) => ({ configured: !!apiKey, model: model || DEFAULT_MODEL })

export function rateLimited(ip, now = Date.now()) {
  const win = 10 * 60 * 1000
  const list = (hits.get(ip) || []).filter((t) => now - t < win)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) hits.clear()
  return list.length > 12
}

const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)

export async function recommend(input, apiKey, model) {
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

  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.9, maxOutputTokens: 8192 },
    }),
  })

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
