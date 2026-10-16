import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { weekSchedule, weekStartOf } from '../lib/schedule'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hhmm = (unix) => new Date(unix * 1000).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })

// This week's simulcasts, by day. PC: seven columns. Phone: day picker + timeline.
export default function Simulcast() {
  const start = useMemo(() => weekStartOf(), [])
  const todayIdx = (new Date().getDay() + 6) % 7
  const [items, setItems] = useState(null)
  const [day, setDay] = useState(todayIdx)
  const [err, setErr] = useState(false)
  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let alive = true
    setItems(null); setErr(false)
    weekSchedule(start).then((l) => {
      if (!alive) return
      if (!l.length) setErr(true)
      setItems(l)
    }).catch(() => { if (alive) { setErr(true); setItems([]) } })
    return () => { alive = false }
  }, [start, tick])

  // Re-evaluate Live / Out now every minute.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  const days = useMemo(() => DAYS.map((d, i) => {
    const dt = new Date(start); dt.setDate(start.getDate() + i)
    return { d, i, date: dt.getDate(), items: (items || []).filter((x) => x.day === i) }
  }), [start, items])

  const end = new Date(start.getTime() + 6 * 864e5)
  const range = `${start.toLocaleString('en', { month: 'long' })} ${start.getDate()} – ${end.getDate()}`
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
          <div className="y-eyebrow ac">This week · {range}</div>
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
          {/* PC: seven columns */}
          <div className="y-sim-cols">
            {days.map((c) => (
              <div key={c.i} className={'y-sim-col' + (c.i === todayIdx ? ' today' : '')}>
                <div className="y-sim-colhead"><b>{c.d}</b><span>{c.date}</span></div>
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
