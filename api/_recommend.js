// AI recommendations. Server-side only: keys live in GEMINI_API_KEY and/or
// GROQ_API_KEY (never VITE_ variables, never sent to the browser).
//
// Providers: Google Gemini and Groq. If both keys are set, Gemini is tried first
// and Groq is the backup (swap with AI_PROVIDER=groq). With one key, that one is used.
// Optional: GEMINI_MODEL (default "gemini-3.8-flash"), GEMINI_FALLBACKS,
//           GROQ_MODEL (default "llama-3.3-70b-versatile").

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-3.8-flash'
const DEFAULT_FALLBACKS = 'gemini-flash-latest'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

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
export function rateLimited(ip, now = Date.now()) {
  const win = 10 * 60 * 1000
  const list = (hits.get(ip) || []).filter((t) => now - t < win)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) hits.clear()
  return list.length > 200
}

// Read the settings from an env-like object (process.env or Vite's loaded .env).
export const configFromEnv = (env = {}) => ({
  geminiKey: env.GEMINI_API_KEY,
  geminiModel: env.GEMINI_MODEL,
  geminiFallbacks: env.GEMINI_FALLBACKS,
  groqKey: env.GROQ_API_KEY,
  groqModel: env.GROQ_MODEL,
  provider: env.AI_PROVIDER,
})

// Health check: which providers have a key? (never returns a key)
export const status = (cfg = {}) => ({
  configured: !!(cfg.geminiKey || cfg.groqKey),
  gemini: !!cfg.geminiKey,
  groq: !!cfg.groqKey,
  geminiModel: cfg.geminiModel || DEFAULT_MODEL,
  groqModel: cfg.groqModel || DEFAULT_GROQ_MODEL,
})

const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)
const RETRYABLE = [404, 429, 500, 502, 503, 504]

// Each provider returns { ok, text, finish } or { ok:false, status, message }.
async function callGemini(cfg, userText) {
  const makeBody = (withSchema) => JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { responseMimeType: 'application/json', ...(withSchema ? { responseSchema: SCHEMA } : {}), temperature: 0.9, maxOutputTokens: 8192 },
  })
  // Google sometimes answers 503 "high demand". Retry the main model once, then
  // fall back to other Flash models.
  const main = cfg.geminiModel || DEFAULT_MODEL
  const fallbacks = String(cfg.geminiFallbacks ?? DEFAULT_FALLBACKS).split(',').map((m) => m.trim()).filter((m) => m && m !== main)
  const attempts = [{ m: main, schema: true }, { m: main, schema: true }, ...fallbacks.map((m) => ({ m, schema: true }))]
  const deadline = Date.now() + 8000
  let res = null
  for (let i = 0; i < attempts.length; i++) {
    if (i > 0 && Date.now() > deadline) break
    if (i === 1) await new Promise((r) => setTimeout(r, 600))
    try {
      res = await fetch(`${ENDPOINT}/${encodeURIComponent(attempts[i].m)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.geminiKey },
        body: makeBody(attempts[i].schema),
        signal: AbortSignal.timeout(Math.max(2500, Math.min(7000, deadline - Date.now()))),
      })
    } catch { res = null; continue }
    if (res.ok) break
    // 400 usually means this model dislikes the response schema: retry it once without.
    if (res.status === 400 && attempts[i].schema) { attempts.splice(i + 1, 0, { m: attempts[i].m, schema: false }); continue }
    if (!RETRYABLE.includes(res.status)) break
  }
  if (!res) return { ok: false, status: 504, message: 'The AI took too long to answer. Try again.' }
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const reason = clean(err?.error?.message, 160)
    return { ok: false, status: res.status, message: res.status === 429 ? 'AI is busy right now. Try again in a minute.' : `AI error (${res.status})${reason ? `: ${reason}` : ''}` }
  }
  const data = await res.json().catch(() => null)
  return {
    ok: true,
    text: data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '',
    finish: data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || '',
  }
}

// Groq speaks the OpenAI chat-completions format.
async function callGroq(cfg, userText) {
  let res
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.groqKey}` },
      body: JSON.stringify({
        model: cfg.groqModel || DEFAULT_GROQ_MODEL,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userText }],
        response_format: { type: 'json_object' },
        temperature: 0.9,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch { return { ok: false, status: 504, message: 'The AI took too long to answer. Try again.' } }
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const reason = clean(err?.error?.message, 160)
    return { ok: false, status: res.status, message: res.status === 429 ? 'AI is busy right now. Try again in a minute.' : `Groq error (${res.status})${reason ? `: ${reason}` : ''}` }
  }
  const data = await res.json().catch(() => null)
  return { ok: true, text: data?.choices?.[0]?.message?.content || '', finish: data?.choices?.[0]?.finish_reason || '' }
}

function parsePicks(text, kind, count) {
  let picks = []
  try {
    const raw = String(text).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(raw)
    picks = Array.isArray(parsed) ? parsed : (parsed?.picks || [])
  } catch { /* empty */ }
  const seen = new Set()
  return picks
    .filter((p) => p && p.title && ['anime', 'movie', 'tv'].includes(p.type) && (kind === 'all' || p.type === kind))
    .filter((p) => { const k = p.type + ':' + String(p.title).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .map((p) => ({ title: clean(p.title, 120), type: p.type, year: Number(p.year) || null, reason: clean(p.reason, 200) }))
    .slice(0, count)
}

export async function recommend(input, cfg = {}) {
  if (!cfg.geminiKey && !cfg.groqKey) return { status: 503, json: { error: 'not_configured', message: 'AI picks are not set up yet.' } }

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

  // Order: AI_PROVIDER first if set, otherwise Gemini then Groq; only configured ones.
  const order = (String(cfg.provider || '').toLowerCase() === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'])
    .filter((p) => (p === 'gemini' ? cfg.geminiKey : cfg.groqKey))

  let last = null
  for (const p of order) {
    const r = p === 'gemini' ? await callGemini(cfg, userText) : await callGroq(cfg, userText)
    if (!r.ok) { last = { status: r.status === 429 ? 429 : 502, json: { error: 'upstream', message: r.message } }; continue }
    const picks = parsePicks(r.text, kind, count)
    if (picks.length) return { status: 200, json: { picks, provider: p } }
    last = { status: 502, json: { error: 'empty', message: `No picks came back${r.finish && !/^(STOP|stop)$/.test(r.finish) ? ` (${r.finish})` : ''}. Try rephrasing.` } }
  }
  return last
}
