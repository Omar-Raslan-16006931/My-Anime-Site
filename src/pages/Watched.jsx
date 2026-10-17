import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWatched, removeWatched, addWatched, fromMovie, fromTV, watchedKey } from '../lib/watched'
import { searchMovies, searchTV, getMovieDetails, getTVDetails, getTmdbImage } from '../lib/tmdb'
import { toast } from '../lib/toast'
import { useFlip } from '../lib/flip'
import Icon from '../components/Icons'

const hrefOf = (i) => (i.media_type === 'tv' && i.tmdb_id ? `/tv/${i.tmdb_id}` : i.media_type === 'movie' && i.tmdb_id ? `/movie/${i.tmdb_id}` : i.mal_id ? `/anime/${i.mal_id}` : '/')
const kindOf = (i) => (i.media_type === 'tv' ? 'TV' : i.media_type === 'movie' ? 'MOVIE' : 'ANIME')
const keyOf = (i) => i.id || `${i.media_type}-${i.tmdb_id || i.mal_id}`

// Numbers count up when they first appear, and afterwards glide from the value on screen to the new one.
function useCount(to, ms = 900) {
  const [v, setV] = useState(0)
  const cur = useRef(0)
  useEffect(() => {
    let raf = 0
    const from = cur.current
    if (from === to) return undefined
    const t0 = performance.now()
    const dur = from === 0 ? ms : Math.min(ms, 600)
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      cur.current = from + (to - from) * (1 - Math.pow(1 - p, 3))
      setV(cur.current)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return v
}
const Num = ({ n, dec = 0 }) => <>{useCount(n).toFixed(dec)}</>

const WORLD_TRIP_H = 44.5 // non-stop flight around the equator, roughly
export function statsOf(items) {
  const list = items || []
  const mins = list.reduce((a, i) => a + (i.minutes || 0), 0)
  const eps = list.reduce((a, i) => a + (i.episodes || (i.media_type === 'movie' ? 1 : 0)), 0)
  const by = { anime: 0, movie: 0, tv: 0 }
  list.forEach((i) => { by[i.media_type] = (by[i.media_type] || 0) + 1 })
  const g = {}
  list.forEach((i) => (i.genres || []).forEach((n) => { g[n] = (g[n] || 0) + 1 }))
  const genres = Object.entries(g).sort((a, b) => b[1] - a[1])
  const scored = list.filter((i) => i.score)
  const longest = [...list].sort((a, b) => (b.minutes || 0) - (a.minutes || 0))[0]
  const dec = {}
  list.forEach((i) => { if (i.year) { const d = Math.floor(i.year / 10) * 10; dec[d] = (dec[d] || 0) + 1 } })
  const decade = Object.entries(dec).sort((a, b) => b[1] - a[1])[0]
  const now = new Date()
  const month = list.filter((i) => { const d = new Date(i.watched_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() }).length
  return { count: list.length, mins, eps, by, genres, avg: scored.length ? scored.reduce((a, i) => a + Number(i.score), 0) / scored.length : 0, longest, decade: decade && Number(decade[0]), month, trips: mins / 60 / WORLD_TRIP_H }
}

// Short, random fun facts about the total time. Each has a minimum so small totals only get sensible ones.
const nf = (n, d = 0) => Number(n).toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d })
export function funFacts(mins) {
  const h = mins / 60, d = mins / 1440, secs = mins * 60
  const f = [
    [h >= 1, `That’s ${nf(h)} hours of your life ⏱️`],
    [d >= 1, `${nf(mins)} minutes. Not that anyone’s counting 🧮`],
    [h >= 44.5, `Enough to fly around the world ${nf(h / 44.5, h / 44.5 >= 10 ? 0 : 1)}× non-stop ✈️`],
    [h >= 8, `${nf(h / 8, 0)} nights of 8-hour sleep 😴`],
    [h >= 160, `${nf(h / 160, 1)} full-time work months 💼`],
    [h >= 40, `${nf(h / 40, 1)} work weeks, overtime not included 🗓️`],
    [mins >= 110, `${nf(mins / 110, 0)} movies back to back 🎬`],
    [mins >= 70, `${nf(mins / 3.5, 0)} songs on repeat 🎵`],
    [h >= 4, `${nf(h / 4, 0)} marathons’ worth of hours 🏃`],
    [h >= 6, `${nf(h / 6, 0)} novels’ worth of reading time 📚`],
    [h >= 195.3, `${nf(h / 195.3, 1)} Apollo 11 missions back to back 🚀`],
    [d >= 27.3, `The Moon circled the Earth ${nf(d / 27.32, 1)}× meanwhile 🌙`],
    [d >= 1, `The Earth travelled ${nf(secs * 29.78 / 1e6, 1)} million km around the Sun meanwhile 🌍`],
    [d >= 1, `Your heart beat about ${nf(mins * 72 / 1e6, 1)} million times meanwhile ❤️`],
    [d >= 5, `You blinked roughly ${nf(mins * 15 / 1e6, 1)} million times meanwhile 👀`],
    [d >= 3, `${nf(d / 365 * 100, 1)}% of a year 📅`],
    [d >= 10, `${nf(d / (80 * 365.25) * 100, 2)}% of an 80-year life 🧬`],
    [h >= 100, `${nf(h / 10000 * 100, 1)}% of the way to 10,000 hours 🎯`],
    [h >= 300, `Enough time to learn the basics of a new language ${nf(h / 700, 1)}× over 🗣️`],
    [h >= 74, `${nf(h / 74, 1)}× the entire run of The Office (US) 📎`],
    [h >= 86.5, `${nf(h / 86.5, 1)}× every episode of Friends ☕`],
    [h >= 48.6, `${nf(h / 48.6, 1)}× all of Breaking Bad ⚗️`],
    [h >= 440, `${nf(h / 440, 1)}× all of One Piece so far 🏴‍☠️`],
    [h >= 7, `${nf(h / 7, 0)} flights from New York to London ✈️`],
  ]
  return f.filter(([ok]) => ok).map(([, t]) => t)
}
export const fmtDur = (m) => { const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${Math.round(m % 60)}m` : `${Math.round(m)}m` }


// Quick add: search movies and TV shows only (anime is added from its page), tap + to mark one watched.
function QuickAdd({ user, watched }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null) // null = idle, [] = nothing found
  const [busy, setBusy] = useState(() => new Set())
  const seq = useRef(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRes(null); return undefined }
    const id = ++seq.current
    const t = setTimeout(async () => {
      const [m, tv] = await Promise.all([searchMovies(term).catch(() => null), searchTV(term).catch(() => null)])
      if (id !== seq.current) return
      const list = [
        ...(m?.results || []).map((x) => ({ media_type: 'movie', tmdb_id: x.id, title: x.title, year: (x.release_date || '').slice(0, 4), poster: x.poster_path ? getTmdbImage(x.poster_path, 'w185') : null, pop: x.popularity || 0 })),
        ...(tv?.results || []).map((x) => ({ media_type: 'tv', tmdb_id: x.id, title: x.name, year: (x.first_air_date || '').slice(0, 4), poster: x.poster_path ? getTmdbImage(x.poster_path, 'w185') : null, pop: x.popularity || 0 })),
      ].sort((a, b) => b.pop - a.pop).slice(0, 8)
      setRes(list)
    }, 320)
    return () => clearTimeout(t)
  }, [q])

  const toggle = async (r) => {
    const k = watchedKey(r)
    if (busy.has(k)) return
    setBusy((b) => new Set(b).add(k))
    try {
      if (watched.has(r)) { await removeWatched(user, r); toast(`Removed “${r.title}” from Watched`); return }
      const d = await (r.media_type === 'movie' ? getMovieDetails(r.tmdb_id) : getTVDetails(r.tmdb_id)).catch(() => null)
      const item = d && d.id ? (r.media_type === 'movie' ? fromMovie(d) : fromTV(d)) : { media_type: r.media_type, tmdb_id: r.tmdb_id, title: r.title, poster: r.poster, genres: [], year: Number(r.year) || null }
      await addWatched(user, item)
      toast(`Marked “${item.title}” as watched`)
    } finally { setBusy((b) => { const n = new Set(b); n.delete(k); return n }) }
  }

  return (
    <div className="wd-add">
      <label className="wd-add-field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a movie or TV show you’ve watched…" aria-label="Search movies and TV shows to add" enterKeyHint="search" />
        {q && <button type="button" className="wd-add-x" onClick={() => setQ('')} aria-label="Clear">×</button>}
      </label>
      {res && (
        <div className="wd-add-list">
          {res.length === 0 ? <p className="wd-add-none">No movies or TV shows found.</p> : res.map((r) => {
            const on = watched.has(r)
            return (
              <div key={watchedKey(r)} className="wd-add-row">
                <span className="wd-add-art">{r.poster && <img src={r.poster} alt="" loading="lazy" />}</span>
                <span className="wd-add-txt"><b>{r.title}</b><small>{r.media_type === 'tv' ? 'TV' : 'Movie'}{r.year ? ` · ${r.year}` : ''}</small></span>
                <button type="button" className={'wd-add-btn' + (on ? ' on' : '')} onClick={() => toggle(r)} aria-pressed={on} aria-label={on ? 'Watched, tap to remove' : 'Mark as watched'}>
                  {on ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Watched({ user, onAuthRequired }) {
  const navigate = useNavigate()
  const watched = useWatched(user)
  const { items, ready } = watched
  const [tab, setTab] = useState('all')
  const [leaving, setLeaving] = useState(() => new Set())
  const st = useMemo(() => statsOf(items), [items])
  const shown = (items || []).filter((i) => tab === 'all' || i.media_type === tab)
  const gridRef = useRef(null)
  useFlip(gridRef, shown)
  const days = useCount(st.mins / 1440, 1100)
  // A random fun fact each time the page opens; tap it for another.
  const facts = useMemo(() => funFacts(st.mins), [Math.round(st.mins / 60)]) // eslint-disable-line react-hooks/exhaustive-deps
  const [pick, setPick] = useState(() => {
    // Never the same fact as last time the page was opened.
    let last = -1
    try { last = Number(localStorage.getItem('yoru:lastfact')) } catch { /* ignore */ }
    let n = Math.floor(Math.random() * 1000)
    if (facts.length > 1 && n % facts.length === last % facts.length) n += 1 + Math.floor(Math.random() * (facts.length - 1))
    return n
  })
  useEffect(() => { try { localStorage.setItem('yoru:lastfact', String(pick)) } catch { /* ignore */ } }, [pick])
  const fact = facts.length ? facts[pick % facts.length] : 'The journey has just begun.'
  const nextFact = () => setPick((p) => p + 1 + Math.floor(Math.random() * Math.max(1, facts.length - 1)))
  const shownMins = useCount(st.mins, 1100)

  const remove = async (i) => {
    setLeaving((s) => new Set(s).add(keyOf(i)))
    await new Promise((r) => setTimeout(r, 380))
    await removeWatched(user, i)
    setLeaving((s) => { const n = new Set(s); n.delete(keyOf(i)); return n })
    toast(`Removed “${i.title}” from Watched`)
  }

  if (!user) return <div className="empty"><p>Sign in to track what you’ve watched.</p><button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onAuthRequired}>Sign in</button></div>
  if (!ready) return <div className="wd"><div className="wd-hero y-skel" style={{ height: 150 }} /></div>
  if (!st.count) {
    return (
      <div className="wd">
      <QuickAdd user={user} watched={watched} />
      <div className="wd-empty">
        <div className="wd-empty-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></svg></div>
        <b>Nothing watched yet</b>
        <p>Tap <em>Mark watched</em> on any show or movie, or the ✓ on Continue watching, and your stats will show up here.</p>
      </div>
      </div>
    )
  }

  const total = st.count
  const split = [['anime', 'Anime'], ['movie', 'Movies'], ['tv', 'TV']].filter(([k]) => st.by[k])
  return (
    <div className="wd">
      <QuickAdd user={user} watched={watched} />
      <section className="wd-hero">
        <div className="wd-hero-main">
          <small>Time well spent</small>
          <b className="wd-big">{st.mins >= 1440 ? <><Num n={days} dec={1} /><i>days</i></> : <>{fmtDur(shownMins)}</>}</b>
          <button type="button" key={fact} className="wd-fact" onClick={nextFact} aria-label="Show another fun fact">{fact}</button>
        </div>
        <div className="wd-split" role="img" aria-label="Split between anime, movies and TV">
          <div className="wd-split-bar">{split.map(([k]) => <i key={k} className={'k-' + k} style={{ flexGrow: st.by[k] }} />)}</div>
          <div className="wd-split-key">{split.map(([k, l]) => <span key={k}><i className={'k-' + k} />{l} <b>{st.by[k]}</b></span>)}</div>
        </div>
      </section>

      <div className="wd-tiles">
        <div className="wd-tile"><b><Num n={total} /></b><small>Titles</small></div>
        <div className="wd-tile"><b><Num n={st.eps} /></b><small>Episodes</small></div>
        <div className="wd-tile"><b>{st.avg ? <>★<Num n={st.avg} dec={1} /></> : '—'}</b><small>Avg rating</small></div>
        <div className="wd-tile"><b><Num n={st.month} /></b><small>This month</small></div>
      </div>

      <div className="wd-facts">
        {st.genres[0] && <span><small>Top genre</small>{st.genres[0][0]}<b>{st.genres[0][1]}</b></span>}
        {st.longest && st.longest.minutes > 0 && <span><small>Binge</small><em>{st.longest.title}</em><b>{fmtDur(st.longest.minutes)}</b></span>}
        {st.decade && <span><small>Era</small>{st.decade}s</span>}
      </div>

      <div className="wd-bar">
        <h3>Everything you’ve watched</h3>
        <div className="wd-chips">
          {[['all', 'All'], ['anime', 'Anime'], ['movie', 'Movies'], ['tv', 'TV']].map(([k, l]) => (
            <button key={k} type="button" className={'wd-chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)} aria-pressed={tab === k}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid" ref={gridRef}>
        {shown.map((i) => (
          <div key={keyOf(i)} data-flip={keyOf(i)} className={'card' + (leaving.has(keyOf(i)) ? ' leaving' : '')} onClick={() => navigate(hrefOf(i))}>
            <div className="card-poster">
              {i.poster ? <img src={i.poster} alt={i.title} /> : null}
              {i.score ? <span className="card-score"><Icon.star width="10" height="10" />{Number(i.score).toFixed(1)}</span> : null}
              <span className="card-kind">{kindOf(i)}</span>
              <button className="card-fav on" onClick={(e) => { e.stopPropagation(); remove(i) }} aria-label="Remove from Watched" title="Remove from Watched"><Icon.close width="15" height="15" /></button>
            </div>
            <div className="card-title">{i.title}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
