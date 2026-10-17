import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { weekSchedule } from '../lib/schedule'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hhmm = (unix) => new Date(unix * 1000).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })

const SPAN = 14 // today + the next 13 days: mostly future, not a half-finished calendar week
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

// Simulcasts from today onwards, by day. PC: seven columns (two pages). Phone: scrolling day picker + timeline.
export default function Simulcast() {
  const start = useMemo(() => today0(), [])
  const todayIdx = 0
  const [items, setItems] = useState(null)
  const [day, setDay] = useState(todayIdx)
  const [page, setPage] = useState(0)
  const [err, setErr] = useState(false)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let alive = true
    setItems(null); setErr(false)
    // First week shows as soon as it arrives; the second follows (one after the other for AniList's limits).
    const second = new Date(start); second.setDate(second.getDate() + 7)
    weekSchedule(start, 10, 7).then(async (a) => {
      if (!alive) return
      if (!a.length) { setErr(true); setItems([]); return }
      setItems(a)
      const b = await weekSchedule(second, 10, 7).catch(() => [])
      if (alive && b.length) setItems([...a, ...b.map((x) => ({ ...x, day: x.day + 7 }))])
    }).catch(() => { if (alive) { setErr(true); setItems([]) } })
    return () => { alive = false }
  }, [start, tick])

  // Re-evaluate Live / Out now every minute.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  const days = useMemo(() => Array.from({ length: SPAN }, (_, i) => {
    const dt = new Date(start); dt.setDate(start.getDate() + i)
    return { d: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAYS[(dt.getDay() + 6) % 7], i, date: dt.getDate(), month: dt.toLocaleString('en', { month: 'short' }), items: (items || []).filter((x) => x.day === i) }
  }), [start, items])

  const end = new Date(start); end.setDate(start.getDate() + SPAN - 1)
  const range = `${start.toLocaleString('en', { month: 'short' })} ${start.getDate()} – ${end.toLocaleString('en', { month: 'short' })} ${end.getDate()}`
  const status = (x) => {
    const t = x.airingAt * 1000
    if (t <= now && now - t < 30 * 60 * 1000) return 'live'
    if (t <= now) return 'out'
    return ''
  }
  const cur = days[day] || days[0]

  const art = (x) => (x.banner || x.poster) && <img src={x.banner || x.poster} alt="" loading="lazy" className={x.banner ? '' : 'poster'} />

  return (
    <div className="y-page y-sim">
      <div className="y-sim-head">
        <h1 className="y-title-xl">Simulcast</h1>
        <div className="y-sim-sub">
          <div className="y-eyebrow ac">Next 2 weeks · {range}</div>
          <div className="y-sim-note">New episodes within an hour of Japanese broadcast. Times are local.</div>
        </div>
      </div>

      {err ? (
        <div className="y-empty">
          <div className="y-empty-h">Couldn’t load the schedule.</div>
          <button type="button" className="y-btn solid" onClick={() => setTick((n) => n + 1)}>Try again</button>
        </div>
      ) : (
        <>
          {/* PC: seven columns, two pages */}
          <div className="y-sim-pager">
            <button type="button" className="y-btn" disabled={page === 0} onClick={() => setPage(0)}>This week</button>
            <button type="button" className="y-btn" disabled={page === 1} onClick={() => setPage(1)}>Next week</button>
          </div>
          <div className="y-sim-cols">
            {days.slice(page * 7, page * 7 + 7).map((c) => (
              <div key={c.i} className={'y-sim-col' + (c.i === todayIdx ? ' today' : '')}>
                <div className="y-sim-colhead"><b>{c.i === 0 ? DAYS[(new Date(start).getDay() + 6) % 7] : c.d}</b><span>{c.date}</span></div>
                {c.i === todayIdx && <div className="y-sim-today">Today</div>}
                {items === null
                  ? Array.from({ length: 3 }).map((_, k) => <div key={k} className="y-skel y-sim-sk" />)
                  : c.items.map((x) => (
                    <Link key={x.malId + ':' + x.episode} to={`/anime/${x.malId}`} className="y-sim-item">
                      <div className="y-sim-time"><span>{hhmm(x.airingAt)}</span>{status(x) === 'live' ? <em className="live"><i />Live</em> : status(x) === 'out' ? <em>Out now</em> : null}</div>
                      <div className="y-sim-art">{art(x)}</div>
                      <b>{x.title}</b>
                      <small>Episode {x.episode} · Anime</small>
                    </Link>
                  ))}
              </div>
            ))}
          </div>

          {/* Phone: day picker + timeline */}
          <div className="y-sim-m">
            <div className="y-sim-days">
              {days.map((c) => (
                <button key={c.i} type="button" className={'y-sim-day' + (day === c.i ? ' on' : '')} onClick={() => setDay(c.i)}>
                  <span>{c.d}</span><b>{c.date}</b>
                </button>
              ))}
            </div>
            <div className="y-sim-count">{items === null ? 'Loading…' : `${cur.items.length} episode${cur.items.length === 1 ? '' : 's'}`}</div>
            <div className="y-sim-line">
              {items === null
                ? Array.from({ length: 3 }).map((_, k) => <div key={k} className="y-skel" style={{ height: 84, borderRadius: 14 }} />)
                : cur.items.map((x) => (
                  <Link key={x.malId + ':' + x.episode} to={`/anime/${x.malId}`} className="y-sim-row">
                    <div className="y-sim-dot"><i /><span>{hhmm(x.airingAt)}</span></div>
                    <div className="y-sim-card">
                      <div className="y-sim-art">{art(x)}</div>
                      <div>
                        <div className="y-sim-badges">
                          {status(x) === 'live' && <span className="live">Live</span>}
                          <small>Episode {x.episode}{status(x) === 'out' ? ' · Out now' : ''}</small>
                        </div>
                        <b>{x.title}</b>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
