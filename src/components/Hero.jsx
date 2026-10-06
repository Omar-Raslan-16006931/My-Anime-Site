import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

// Billboard hero. Accepts either a single `item` or an `items[]` array which it
// auto-rotates through with a smooth crossfade. All slide images stay mounted
// (stacked), so switching never flashes black or re-downloads an image.
// item: { title, backdrop, score, year, genres[], desc, href, kind }
export default function Hero({ item, items, onPlay, interval = 8000 }) {
  const navigate = useNavigate()
  const list = items && items.length ? items : item ? [item] : []
  const [idx, setIdx] = useState(0)
  const timer = useRef(null)
  const touch = useRef(null)
  const count = list.length

  useEffect(() => { if (idx >= count) setIdx(0) }, [count, idx])

  const restart = useCallback(() => {
    clearInterval(timer.current)
    if (count > 1) timer.current = setInterval(() => {
      if (document.visibilityState === 'visible') setIdx((i) => (i + 1) % count)
    }, interval)
  }, [count, interval])

  useEffect(() => { restart(); return () => clearInterval(timer.current) }, [restart])

  const go = (i) => { setIdx(((i % count) + count) % count); restart() }

  // Horizontal swipe on the hero itself changes slide (vertical scroll untouched).
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    const s = touch.current
    touch.current = null
    if (!s || count < 2) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(idx + (dx < 0 ? 1 : -1))
  }

  if (!count) return null
  const cur = list[Math.min(idx, count - 1)]

  return (
    <div className="hero" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="hero-bg">
        {list.map((s, i) => s.backdrop && (
          <img
            key={s.href || i}
            src={s.backdrop}
            alt=""
            aria-hidden={i !== idx}
            className={'hero-slide' + (i === idx ? ' on' : '')}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
      </div>
      <div className="hero-overlay" />
      <div className="hero-content" key={cur.href || idx}>
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

      {count > 1 && (
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
