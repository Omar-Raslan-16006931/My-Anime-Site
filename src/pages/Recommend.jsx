import { useState, useEffect, useCallback } from 'react'
import MediaCard from '../components/MediaCard'
import { fetchPicks, resolvePick } from '../lib/recommend'
import { udb } from '../lib/udb'

const IDEAS = ['Dark psychological thrillers', 'Like Attack on Titan', 'Cozy and short', 'Mind-bending sci-fi', 'Great action with a strong lead', 'Surprise me']
const KINDS = [['all', 'All'], ['anime', 'Anime'], ['movie', 'Movies'], ['tv', 'TV Shows']]

export default function Recommend({ user, onAuthRequired }) {
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState('all')
  const [useHistory, setUseHistory] = useState(true)
  const [history, setHistory] = useState([])
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asked, setAsked] = useState(false)
  const [meta, setMeta] = useState(null)

  // Titles from My List + Currently Watching, so picks match your taste.
  useEffect(() => {
    if (!user) { setHistory([]); return }
    let on = true
    ;(async () => {
      const [w, a, t] = await Promise.all([
        udb.from('watchlist').select('title').eq('user_id', user.id),
        udb.from('currently_watching').select('title').eq('user_id', user.id),
        udb.from('currently_watching_tmdb').select('title').eq('user_id', user.id),
      ])
      if (!on) return
      const all = [...(w.data || []), ...(a.data || []), ...(t.data || [])].map((r) => r.title).filter(Boolean)
      setHistory([...new Set(all)].slice(0, 40))
    })()
    return () => { on = false }
  }, [user])

  const go = useCallback(async (text = prompt, k = kind) => {
    setLoading(true); setError(''); setAsked(true); setMeta(null)
    try {
      const { picks: raw, provider, model, note } = await fetchPicks({ prompt: text, kind: k, watched: user && useHistory ? history : [] })
      const resolved = (await Promise.all(raw.map(resolvePick))).filter(Boolean)
      if (!resolved.length) throw new Error('Nothing matched. Try rephrasing.')
      setPicks(resolved)
      setMeta({ provider, model, note })
    } catch (e) {
      setPicks([])
      setError(e.code === 'not_configured' ? 'AI picks aren’t set up yet — the site owner needs to add the AI key.' : (e.message || 'Something went wrong.'))
    } finally { setLoading(false) }
  }, [prompt, kind, user, useHistory, history])

  const submit = (e) => { e.preventDefault(); go() }
  const idea = (t) => { setPrompt(t); go(t) }

  return (
    <div className="page rec">
      <h1 className="section-title" style={{ marginBottom: 6 }}>AI picks</h1>
      <p className="rec-sub">Tell me what you’re in the mood for and I’ll find it.</p>

      <form className="rec-form" onSubmit={submit}>
        <textarea
          className="rec-input"
          rows={2}
          maxLength={300}
          placeholder="e.g. something like Death Note but lighter…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }}
        />
        <div className="rec-row">
          <div className="fu-seg">
            {KINDS.map(([k, l]) => <button key={k} type="button" className={'fu-seg-btn' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <button className="tvh-play rec-go" type="submit" disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
            {loading ? 'Thinking…' : 'Recommend'}
          </button>
        </div>
        {user ? (
          <label className="rec-check">
            <input type="checkbox" checked={useHistory} onChange={(e) => setUseHistory(e.target.checked)} />
            <span>Use my list and watch history{history.length ? ` (${history.length} titles)` : ''}</span>
          </label>
        ) : (
          <button type="button" className="rec-signin" onClick={() => onAuthRequired?.()}>Sign in to get picks based on your list</button>
        )}
      </form>

      <div className="rec-ideas">
        {IDEAS.map((t) => <button key={t} type="button" className="sf-chip" onClick={() => idea(t)} disabled={loading}>{t}</button>)}
      </div>

      {error && <div className="empty"><p>{error}</p></div>}

      {loading ? (
        <div className="grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel skel-poster" />)}</div>
      ) : picks.length > 0 ? (
        <>
        {meta?.provider && (
          <p className="rec-by">
            Answered by <strong>{meta.provider === 'gemini' ? 'Gemini' : 'Groq'}</strong>{meta.model ? <span> · {meta.model}</span> : null}
            {meta.note ? <span className="rec-note"> — Gemini didn’t answer ({meta.note})</span> : null}
          </p>
        )}
        <div className="grid rec-grid">
          {picks.map((p) => (
            <div key={p.type + p.href} className="rec-item">
              <MediaCard item={{ href: p.href, poster: p.poster, title: p.name, score: p.score, kind: p.kind, sub: p.year || undefined }} />
              <p className="rec-why">{p.reason}</p>
            </div>
          ))}
        </div>
        </>
      ) : !asked && !error ? (
        <div className="empty"><div className="emoji">✨</div><p>Pick an idea above or describe your own.</p></div>
      ) : null}
    </div>
  )
}
