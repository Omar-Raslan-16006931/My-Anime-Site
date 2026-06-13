import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

// Billboard hero. Accepts either a single `item` or an `items[]` array which it
// auto-rotates through (Netflix-style) with clickable dots.
// item: { title, backdrop, score, year, genres[], desc, href, kind }
export default function Hero({ item, items, onPlay, interval = 8000 }) {
  const navigate = useNavigate()
  const list = items && items.length ? items : item ? [item] : []
  const [idx, setIdx] = useState(0)
  const timer = useRef(null)

  // Keep index in range if the list shrinks/changes.
  useEffect(() => { if (idx >= list.length) setIdx(0) }, [list.length, idx])

  // Auto-advance.
  useEffect(() => {
    if (list.length <= 1) return
    timer.current = setInterval(() => setIdx((i) => (i + 1) % list.length), interval)
    return () => clearInterval(timer.current)
  }, [list.length, interval])

  const go = (i) => {
    setIdx(i)
    if (timer.current) clearInterval(timer.current)
    if (list.length > 1) timer.current = setInterval(() => setIdx((x) => (x + 1) % list.length), interval)
  }

  if (!list.length) return null
  const cur = list[idx]

  return (
    <div className="hero">
      <div className="hero-bg">
        {cur.backdrop && <img key={cur.backdrop} src={cur.backdrop} alt={cur.title} />}
      </div>
      <div className="hero-overlay" />
      <div className="hero-content fade-in" key={cur.href || idx}>
        {cur.kind && <div className="hero-brand" style={{ marginBottom: 12 }}>{cur.kind}</div>}
        <h1 className="hero-title">{cur.title}</h1>
        <div className="hero-meta">
          {cur.score ? <span className="gold"><Icon.star width="13" height="13" style={{ verticalAlign: -1 }} /> {Number(cur.score).toFixed(1)}</span> : null}
          {cur.year ? <span>{cur.year}</span> : null}
          {(cur.genres || []).slice(0, 3).map((g) => <span key={g}>{g}</span>)}
        </div>
        {cur.desc && <p className="hero-desc">{cur.desc}</p>}
        <div className="hero-actions">
          <button className="btn btn-light" onClick={() => (onPlay ? onPlay(cur) : navigate(cur.href))}>
            <Icon.play width="18" height="18" /> Play
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(cur.href)}>
            <Icon.info width="18" height="18" /> More Info
          </button>
        </div>
      </div>

      {list.length > 1 && (
        <div className="hero-dots">
          {list.map((_, i) => (
            <button
              key={i}
              className={'hero-dot' + (i === idx ? ' active' : '')}
              aria-label={`Show slide ${i + 1}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
