import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWatched, removeWatched } from '../lib/watched'
import { toast } from '../lib/toast'
import { useFlip } from '../lib/flip'
import Icon from '../components/Icons'

const hrefOf = (i) => (i.media_type === 'tv' && i.tmdb_id ? `/tv/${i.tmdb_id}` : i.media_type === 'movie' && i.tmdb_id ? `/movie/${i.tmdb_id}` : i.mal_id ? `/anime/${i.mal_id}` : '/')
const kindOf = (i) => (i.media_type === 'tv' ? 'TV' : i.media_type === 'movie' ? 'MOVIE' : 'ANIME')
const keyOf = (i) => i.id || `${i.media_type}-${i.tmdb_id || i.mal_id}`

// Numbers count up when they appear.
function useCount(to, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t) => { const p = Math.min(1, (t - t0) / ms); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick) }
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
export const fmtDur = (m) => { const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${Math.round(m % 60)}m` : `${Math.round(m)}m` }

export default function Watched({ user, onAuthRequired }) {
  const navigate = useNavigate()
  const { items, ready } = useWatched(user)
  const [tab, setTab] = useState('all')
  const [leaving, setLeaving] = useState(() => new Set())
  const st = useMemo(() => statsOf(items), [items])
  const shown = (items || []).filter((i) => tab === 'all' || i.media_type === tab)
  const gridRef = useRef(null)
  useFlip(gridRef, shown)
  const days = useCount(st.mins / 1440, 1100)

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
      <div className="wd-empty">
        <div className="wd-empty-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></svg></div>
        <b>Nothing watched yet</b>
        <p>Tap <em>Mark watched</em> on any show or movie, or the ✓ on Continue watching, and your stats will show up here.</p>
      </div>
    )
  }

  const total = st.count
  const split = [['anime', 'Anime'], ['movie', 'Movies'], ['tv', 'TV']].filter(([k]) => st.by[k])
  return (
    <div className="wd">
      <section className="wd-hero">
        <div className="wd-hero-main">
          <small>Time well spent</small>
          <b className="wd-big">{st.mins >= 1440 ? <><Num n={days} dec={1} /><i>days</i></> : <>{fmtDur(st.mins)}</>}</b>
          <span>{st.trips >= 0.1 ? <>Enough to fly around the world <strong>{st.trips >= 10 ? Math.round(st.trips) : st.trips.toFixed(1)}×</strong> non-stop ✈️</> : 'The journey has just begun.'}</span>
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
