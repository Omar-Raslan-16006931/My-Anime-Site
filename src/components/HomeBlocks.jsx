import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from './Icons'
import { nextSimulcast } from '../lib/schedule'
import { animeByGenre } from '../lib/anime'
import { openSurprise } from '../lib/surprise'
import { toast } from '../lib/toast'

const p2 = (n) => String(Math.max(0, n)).padStart(2, '0')
const REM_KEY = 'yoru:reminders'
const readRem = () => { try { return JSON.parse(localStorage.getItem(REM_KEY) || '[]') } catch { return [] } }

// ---------------------------------------------------------------------------
// Next simulcast: the soonest popular episode to air, with a live countdown.
// "Remind me" is kept on this device and fires a browser notification when the
// episode airs (only while Yoru is open).
// ---------------------------------------------------------------------------
export function NextSimulcast() {
  const [it, setIt] = useState(undefined)
  const [now, setNow] = useState(Date.now())
  const [reminded, setReminded] = useState(false)
  const fired = useRef(false)

  useEffect(() => {
    let alive = true
    nextSimulcast().then((x) => { if (alive) setIt(x || null) }).catch(() => alive && setIt(null))
    return () => { alive = false }
  }, [])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const key = it ? `${it.malId}:${it.episode}` : ''
  useEffect(() => { setReminded(!!key && readRem().includes(key)); fired.current = false }, [key])

  const diff = it ? it.airingAt * 1000 - now : 0
  // Episode just aired → ping (if asked) and pull the next one.
  useEffect(() => {
    if (!it || diff > 0 || fired.current) return
    fired.current = true
    if (reminded && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(`${it.title} · Episode ${it.episode} is out`) } catch { /* ignore */ }
    }
    setTimeout(() => nextSimulcast().then((x) => setIt(x || null)).catch(() => {}), 3000)
  }, [diff, it, reminded])

  const remind = async () => {
    if (!it) return
    const list = readRem()
    const on = !reminded
    const next = on ? [...list, key] : list.filter((k) => k !== key)
    try { localStorage.setItem(REM_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    setReminded(on)
    if (on && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission() } catch { /* ignore */ }
    }
    toast(on ? `Reminder set · ${it.title}` : 'Reminder removed')
  }

  if (it === undefined) return <div className="y-next y-skel" style={{ minHeight: 150 }} />
  if (!it) return null

  const t = Math.max(0, diff)
  const when = new Date(it.airingAt * 1000)
  const whenLabel = `${when.toLocaleString('en', { weekday: 'long' })} ${when.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  const parts = [
    [p2(Math.floor(t / 864e5)), 'days', 'd'],
    [p2(Math.floor(t / 36e5) % 24), 'hrs', 'h'],
    [p2(Math.floor(t / 6e4) % 60), 'min', 'm'],
    [p2(Math.floor(t / 1e3) % 60), 'sec', 's'],
  ]

  return (
    <div className="y-next">
      <Link to={`/anime/${it.malId}`} className="y-next-art" aria-label={it.title}>
        {(it.banner || it.poster) && <img src={it.banner || it.poster} alt="" loading="lazy" className={it.banner ? '' : 'poster'} />}
      </Link>
      <div className="y-next-body">
        <div className="y-eyebrow ac">Next simulcast · {whenLabel}</div>
        <Link to={`/anime/${it.malId}`} className="y-next-title">{it.title}</Link>
        <div className="y-next-sub">Episode {it.episode} · subtitles within the hour</div>
        <div className="y-count">
          {parts.map(([v, long, short]) => (
            <span key={long} className="y-count-n">{v}<em><i className="l">{long}</i><i className="s">{short}</i></em></span>
          ))}
          <button type="button" className={'y-remind' + (reminded ? ' on' : '')} onClick={remind} aria-pressed={reminded}>{reminded ? 'Reminder set' : 'Remind me'}</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Can't decide?" card — three fanned posters and a Surprise me button.
// ---------------------------------------------------------------------------
export function SurpriseCard({ posters = [] }) {
  const fan = posters.slice(0, 3)
  return (
    <div className="y-surprise-card" onClick={openSurprise} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openSurprise() }}>
      <div className="y-fan" aria-hidden="true">
        {fan.map((src, i) => (
          <span key={i} style={{ right: i * 46 + 'px', transform: `rotate(${(i - 1) * 10}deg) translateY(${Math.abs(i - 1) * 10}px)` }}>
            <img src={src} alt="" loading="lazy" />
          </span>
        ))}
      </div>
      <div className="y-eyebrow ac" style={{ position: 'relative' }}>Can’t decide?</div>
      <div className="y-surprise-title">Let Yoru pick tonight’s show</div>
      <div className="y-surprise-go">Surprise me</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Watch by mood — chips swap a grid of six posters (skeleton, then staggered fade-in).
// ---------------------------------------------------------------------------
const MOODS = [
  { k: 'Cozy', blurb: 'Warm, low-stakes and good with tea.', genres: ['Slice of Life', 'Comedy'] },
  { k: 'Adrenaline', blurb: 'Fights, races and very little sleep.', genres: ['Action', 'Sports'] },
  { k: 'Mind-bending', blurb: 'Puzzles that keep going after the credits.', genres: ['Psychological', 'Mystery'] },
  { k: 'Dark & gritty', blurb: 'Crime, horror and morally grey leads.', genres: ['Horror', 'Thriller'] },
  { k: 'Feel-good', blurb: 'Underdogs, found family and happy endings.', genres: ['Music', 'Romance'] },
]
const moodCache = new Map()
const MIN = 7

async function loadMood(m) {
  if (moodCache.has(m.k)) return moodCache.get(m.k)
  const lists = await Promise.all(m.genres.map((g) => animeByGenre(g, 1, 24).then((r) => r.list).catch(() => [])))
  const seen = new Set()
  const merged = []
  for (const a of lists.flat()) {
    if (!a?.mal_id || seen.has(a.mal_id) || (a.score || 0) < MIN || !a.images?.jpg?.large_image_url) continue
    seen.add(a.mal_id)
    merged.push(a)
  }
  // The top of each list is the most popular; pick six from the best 14 so it feels fresh.
  const pool = merged.slice(0, 14)
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  const pick = pool.slice(0, 6)
  moodCache.set(m.k, pick)
  return pick
}

export function MoodSection() {
  const navigate = useNavigate()
  const [mood, setMood] = useState(MOODS[0])
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(true)
  const [anim, setAnim] = useState(0)

  useEffect(() => {
    let alive = true
    setBusy(true)
    const minWait = new Promise((r) => setTimeout(r, 520))
    Promise.all([loadMood(mood), minWait]).then(([list]) => {
      if (!alive) return
      setItems(list); setBusy(false); setAnim((n) => n + 1)
    })
    return () => { alive = false }
  }, [mood])

  const cur = useMemo(() => MOODS.find((x) => x.k === mood.k) || MOODS[0], [mood])

  return (
    <section className="y-mood">
      <div className="y-mood-head">
        <h2>Watch by mood</h2>
        <div className="y-chips scroll y-mood-chips">
          {MOODS.map((m) => (
            <button key={m.k} type="button" className={'y-chip' + (m.k === mood.k ? ' on' : '')} onClick={(e) => { setMood(m); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }}>{m.k}</button>
          ))}
        </div>
        <div className="y-mood-blurb">{cur.blurb}</div>
      </div>
      {busy ? (
        <div className="y-mood-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="y-skel y-mood-sk" />)}</div>
      ) : (
        <div className="y-mood-grid" key={anim}>
          {items.map((a, i) => (
            <div key={a.mal_id} className="y-mood-card" style={{ animationDelay: i * 70 + 'ms' }} onClick={() => navigate(`/anime/${a.mal_id}`)} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/anime/${a.mal_id}`) }}>
              <img src={a.images.jpg.large_image_url} alt="" loading="lazy" />
              <span className="y-mood-shade" />
              {a.synopsis && <p className="y-mood-syn">{a.synopsis}</p>}
              <div className="y-mood-name">
                <b>{a.title_english || a.title}</b>
                <small>{a.type}{a.type && a.score ? ' · ' : ''}{a.score ? <><Icon.star width="10" height="10" /> {Number(a.score).toFixed(1)}</> : null}</small>
              </div>
            </div>
          ))}
          {!items.length && <div className="y-empty-note">Nothing found for this mood right now. Try another.</div>}
        </div>
      )}
    </section>
  )
}
