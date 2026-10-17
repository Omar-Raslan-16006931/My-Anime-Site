import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import Recommend from './Recommend'
import { searchAnimeFiltered } from '../lib/anime'
import { searchMovies, searchTV } from '../lib/tmdb'
import { fetchGroup, fetchPage, animeCard, movieCard, tvCard } from '../lib/browse'
import { CATEGORIES, TMDB_MOVIE_GENRE, TMDB_TV_GENRE } from '../lib/categories'

// Explore: one search box (results as you type), one type row, one genre row, one set of results.
// Every control appears once; there is nothing to "apply" and no second way to do the same thing.
const TYPES = [['all', 'All'], ['anime', 'Anime'], ['movie', 'Movies'], ['tv', 'TV']]
const LABEL = { anime: 'Anime', movie: 'Movies', tv: 'TV' }
const GROUP = { anime: 'Anime', movie: 'Movies', tv: 'TV' }
const MAP = { movie: TMDB_MOVIE_GENRE, tv: TMDB_TV_GENRE }
const hasGenre = (kind, g) => !g || kind === 'anime' || !!MAP[kind][g]

// One page of results for a kind → { items, hasNext }
async function load(kind, q, g, page) {
  if (q) {
    if (kind === 'anime') return { items: (await searchAnimeFiltered({ q, genres: g ? [g] : [] })).map(animeCard), hasNext: false }
    const d = await (kind === 'movie' ? searchMovies(q, page) : searchTV(q, page))
    const want = g ? MAP[kind][g] : null
    const items = (d?.results || []).filter((x) => x.poster_path && !x.adult && (!want || x.genre_ids?.includes(want))).map(kind === 'movie' ? movieCard : tvCard)
    return { items, hasNext: page < Math.min(d?.total_pages || 1, 5) }
  }
  return g ? fetchPage(kind, g, page) : fetchGroup(GROUP[kind], page)
}

export default function Search({ user, onAuthRequired }) {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') || '').trim()
  const type = TYPES.some(([k]) => k === params.get('t')) ? params.get('t') : 'all'
  const genre = CATEGORIES.includes(params.get('g')) ? params.get('g') : ''
  const [input, setInput] = useState(q)
  const [aiOpen, setAiOpen] = useState(params.get('ai') === '1')
  const [aiOut, setAiOut] = useState(false)
  const closingAi = useRef(false)
  const closeAi = () => {
    if (closingAi.current) return
    closingAi.current = true
    setAiOut(true)
    setTimeout(() => { setAiOpen(false); setAiOut(false); closingAi.current = false }, 380)
  }
  useEffect(() => {
    if (!aiOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const k = (e) => { if (e.key === 'Escape') closeAi() }
    window.addEventListener('keydown', k)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', k) }
  }, [aiOpen])

  const update = useCallback((patch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) { if (!v || v === 'all') next.delete(k); else next.set(k, v) }
    next.delete('ai'); next.delete('c'); next.delete('f'); next.delete('r')
    setParams(next, { replace: true })
  }, [params, setParams])

  // Results follow the box as you type (short pause), no button needed.
  useEffect(() => { setInput(q) }, [q])
  useEffect(() => {
    const v = input.trim()
    if (v === q) return undefined
    const t = setTimeout(() => update({ q: v }), 350)
    return () => clearTimeout(t)
  }, [input]) // eslint-disable-line react-hooks/exhaustive-deps

  const kinds = (type === 'all' ? ['anime', 'movie', 'tv'] : [type]).filter((k) => hasGenre(k, genre))
  const genres = type === 'all' || type === 'anime' ? CATEGORIES : CATEGORIES.filter((g) => MAP[type][g])

  return (
    <div className="page xp">
      <h1 className="section-title xp-title">Explore</h1>

      <div className="xp-search">
        <label className="xp-field">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
          <input type="search" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { update({ q: input.trim() }); e.currentTarget.blur() } }}
            placeholder="Search anime, movies and TV" aria-label="Search" enterKeyHint="search" autoComplete="off" />
          {input && <button type="button" className="xp-x" onClick={() => { setInput(''); update({ q: '' }) }} aria-label="Clear search">×</button>}
        </label>
        <button type="button" className="xp-ai" onClick={() => setAiOpen(true)} aria-label="Ask AI for recommendations" title="Ask AI for recommendations">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>
          <span>Ask AI</span>
        </button>
      </div>

      <div className="xp-types" role="tablist" aria-label="Type" style={{ '--i': Math.max(0, TYPES.findIndex(([k]) => k === type)) }}>
        <span className="xp-ind" aria-hidden="true" />
        {TYPES.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={type === k} className={'xp-type' + (type === k ? ' on' : '')}
            onClick={() => update({ t: k, g: k !== 'all' && k !== 'anime' && genre && !MAP[k][genre] ? '' : genre })}>{l}</button>
        ))}
      </div>

      <div className="xp-genres" aria-label="Genre">
        <button type="button" className={'xp-genre' + (!genre ? ' on' : '')} aria-pressed={!genre} onClick={() => update({ g: '' })}>All genres</button>
        {genres.map((g) => <button key={g} type="button" className={'xp-genre' + (genre === g ? ' on' : '')} aria-pressed={genre === g} onClick={() => update({ g: genre === g ? '' : g })}>{g}</button>)}
      </div>

      {kinds.map((k) => <Results key={`${k}|${q}|${genre}|${type}`} kind={k} q={q} genre={genre} preview={kinds.length > 1} />)}

          {aiOpen && createPortal(
            <div className={'y-who-scrim ai-scrim' + (aiOut ? ' closing' : '')} onClick={closeAi}>
              <div className="y-who-sheet ai-sheet" role="dialog" aria-modal="true" aria-label="Ask AI for recommendations" onClick={(e) => e.stopPropagation()}>
                <div className="ai-sheet-head">
                  <div><h2>Ask AI for recommendations</h2><p>Describe a mood, get a shortlist.</p></div>
                  <button type="button" className="ai-sheet-x" onClick={closeAi} aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
                </div>
                <div className="ai-sheet-body embed-page"><Recommend user={user} onAuthRequired={() => { closeAi(); onAuthRequired?.() }} /></div>
              </div>
            </div>, document.body)}
    </div>
  )
}

// One kind's results. In "All" it's a short preview of each kind; with one type picked it's the full, paged grid.
function Results({ kind, q, genre, preview }) {
  const [items, setItems] = useState(null)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let on = true
    setItems(null); setErr(false)
    load(kind, q, genre, 1).then((r) => { if (on) { setItems(r.items); setHasNext(r.hasNext); setPage(1) } })
      .catch(() => { if (on) { setItems([]); setErr(true) } })
    return () => { on = false }
  }, [kind, q, genre, tick])

  const more = async () => {
    setBusy(true)
    try {
      const r = await load(kind, q, genre, page + 1)
      setItems((cur) => { const seen = new Set(cur.map((i) => i.href)); return [...cur, ...r.items.filter((i) => !seen.has(i.href))] })
      setHasNext(r.hasNext); setPage((p) => p + 1)
    } catch { /* keep what we have */ }
    setBusy(false)
  }

  const shown = preview && items ? items.slice(0, 16) : items
  if (preview && items && !items.length && !err) return null
  return (
    <section className="xp-sec">
      {preview && <h2 className="xp-h">{LABEL[kind]}</h2>}
      {items === null ? (
        <div className={'grid y-grid' + (preview ? ' xp-row' : '')}>{Array.from({ length: preview ? 8 : 12 }).map((_, i) => <div key={i} className="y-skel skel-poster" />)}</div>
      ) : err ? (
        <div className="xp-msg">Couldn’t load {LABEL[kind].toLowerCase()}. <button type="button" onClick={() => setTick((n) => n + 1)}>Retry</button></div>
      ) : !items.length ? (
        <div className="xp-msg">{q ? `No results for “${q}”.` : 'Nothing here yet.'}</div>
      ) : (
        <>
          <div className={'grid y-grid' + (preview ? ' xp-row' : '')}>{shown.map((it) => <MediaCard key={it.href} item={it} />)}</div>
          {!preview && hasNext && <div className="xp-more"><button type="button" className="y-btn" onClick={more} disabled={busy}>{busy ? 'Loading…' : 'Load more'}</button></div>}
        </>
      )}
    </section>
  )
}
