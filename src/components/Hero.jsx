import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

const ROTATE = 6500

// Phone layout flips at the same width as the rest of the app's PC layout.
function useIsPhone() {
  const q = '(max-width: 879px)'
  const [v, setV] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setV(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return v
}

const Chev = ({ flip }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={flip ? { transform: 'rotate(180deg)' } : undefined}><path d="m9 5 7 7-7 7" /></svg>
)

// Featured billboard.
//  • PC: full-bleed key art with a slow zoom, text block bottom-left and a rail
//    of 5 progress segments that rotates the picks.
//  • Phone: blurred backdrop + 3D poster coverflow.
// items[]: { type, title, backdrop, poster, score, year, genres[], desc, href }
export default function Hero({ item, items, onPlay, isInList, onToggleList, interval = ROTATE }) {
  const navigate = useNavigate()
  const phone = useIsPhone()
  const list = items && items.length ? items : item ? [item] : []
  const count = list.length
  const [idx, setIdx] = useState(0)
  const timer = useRef(null)
  const touch = useRef(null)
  const root = useRef(null)

  useEffect(() => { if (idx >= count) setIdx(0) }, [count, idx])

  const restart = useCallback(() => {
    clearInterval(timer.current)
    if (count > 1) timer.current = setInterval(() => {
      if (document.visibilityState === 'visible') setIdx((i) => (i + 1) % count)
    }, interval)
  }, [count, interval])
  useEffect(() => { restart(); return () => clearInterval(timer.current) }, [restart])

  const dirRef = useRef(1)
  const go = (i) => {
    const next = ((i % count) + count) % count
    if (next !== idx) { let d = next - idx; if (Math.abs(d) > count / 2) d -= Math.sign(d) * count; dirRef.current = d >= 0 ? 1 : -1 }
    setIdx(next); restart()
  }
  const pause = () => clearInterval(timer.current)

  // Parallax (PC): the art drifts at 45% of the scroll speed, the text fades.
  useEffect(() => {
    if (phone) return undefined
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        const el = root.current
        if (!el || y > 900) return
        el.style.setProperty('--py', y * 0.45 + 'px')
        el.style.setProperty('--ty', -y * 0.12 + 'px')
        el.style.setProperty('--fade', String(Math.max(0, 1 - y / 520)))
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [phone])

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
  const inList = isInList ? isInList(cur) : false
  const play = () => (onPlay ? onPlay(cur) : navigate(cur.href))
  const meta = [cur.year, ...(cur.genres || []).slice(0, 2)].filter(Boolean)

  const star = cur.score ? (
    <span className="y-hero-score"><span className="y-star"><Icon.star width="13" height="13" /></span>{Number(cur.score).toFixed(1)}</span>
  ) : null

  /* ---------------- Phone: draggable coverflow ---------------- */
  if (phone) {
    return (
      <div className="y-hero-m" ref={root}>
        {list.map((s, i) => (s.backdrop || s.poster) && (
          <img key={'bg' + (s.href || i)} src={s.backdrop || s.poster} alt="" aria-hidden="true" className={'y-hero-m-bg' + (i === idx ? ' on' : '')} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
        ))}
        <div className="y-hero-m-shade" />
        <Coverflow list={list} idx={idx} go={go} pause={pause} navigate={navigate} />
        <div className="y-hero-m-info" key={cur.href || idx} style={{ '--dir': dirRef.current }}>
          <div className="y-hero-m-title">{cur.title}</div>
          <div className="y-hero-m-meta">
            {cur.score ? <><span className="y-star"><Icon.star width="13" height="13" /></span>{Number(cur.score).toFixed(1)} · </> : null}
            {[cur.type, ...(cur.genres || []).slice(0, 2)].filter(Boolean).join(' · ')}
          </div>
          <div className="y-hero-m-btns">
            <button type="button" className="y-hero-m-play" onClick={play}><Icon.play width="15" height="15" />Play</button>
            <button type="button" className="y-hero-m-more" onClick={() => navigate(cur.href)} aria-label="Details" title="Details"><Icon.info width="20" height="20" /></button>
            {onToggleList && (
              <button type="button" className={'y-hero-m-add' + (inList ? ' on' : '')} onClick={() => onToggleList(cur)} aria-pressed={inList} aria-label={inList ? 'In My List' : 'Add to My List'}>
                {inList ? <Icon.check width="18" height="18" /> : <Icon.plus width="18" height="18" />}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ---------------- PC: cinematic ---------------- */
  return (
    <div className="y-hero" ref={root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="y-hero-bg">
        {list.map((s, i) => s.backdrop && (
          <img key={s.href || i} src={s.backdrop} alt="" aria-hidden="true" className={'y-hero-img' + (i === idx ? ' on' : '')} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
        ))}
      </div>
      <div className="y-scrim y-hero-scrim" />
      <div className="y-hero-text" key={cur.href || idx}>
        <div className="y-hero-type">{[cur.type, 'New episodes weekly'].filter(Boolean).join(' · ')}</div>
        <h1 className="y-hero-title">{cur.title}</h1>
        <div className="y-hero-meta">{star}<span>{meta.join(' · ')}</span></div>
        {cur.desc && <p className="y-hero-desc">{cur.desc}</p>}
        <div className="y-hero-actions">
          <button type="button" className="y-btn ac y-hero-play" onClick={play}><Icon.play width="18" height="18" />Play</button>
          <button type="button" className="y-btn" onClick={() => navigate(cur.href)}>More info</button>
          {onToggleList && (
            <button type="button" className="y-btn sq" onClick={() => onToggleList(cur)} aria-pressed={inList} aria-label={inList ? 'In My List' : 'Add to My List'} title={inList ? 'In My List' : 'Add to My List'}>
              {inList ? <Icon.check width="18" height="18" /> : <Icon.plus width="18" height="18" />}
            </button>
          )}
        </div>
      </div>

      {count > 1 && (
        <div className="y-hero-rail">
          <div className="y-hero-arrows">
            <button type="button" className="y-circle" aria-label="Previous title" onClick={() => go(idx - 1)}><Chev flip /></button>
            <button type="button" className="y-circle" aria-label="Next title" onClick={() => go(idx + 1)}><Chev /></button>
          </div>
          <div className="y-hero-segs" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {list.map((s, i) => (
              <button type="button" key={s.href || i} className={'y-seg' + (i === idx ? ' on' : '')} onClick={() => go(i)}>
                <span className="y-seg-bar"><i style={i === idx ? { width: '100%', transition: `width ${interval}ms linear` } : { width: 0 }} /></span>
                <span className="y-seg-row"><em>{String(i + 1).padStart(2, '0')}</em><b>{s.title}</b></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 3D poster coverflow that follows your finger: drag, flick for momentum, release to settle on a card.
const STEP = 126 // px of finger travel per card
function Coverflow({ list, idx, go, pause, navigate }) {
  const count = list.length
  const [drag, setDrag] = useState(0) // in cards; > 0 means dragged to the right
  const [dragging, setDragging] = useState(false)
  const st = useRef(null)
  const blockClick = useRef(false)

  const down = (e) => {
    if (count < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return
    st.current = { x: e.clientX, y: e.clientY, lx: e.clientX, lt: performance.now(), v: 0, mode: null }
  }
  const move = (e) => {
    const s = st.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.mode) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      s.mode = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y'
      if (s.mode === 'y') { st.current = null; return }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDragging(true)
      pause?.()
    }
    const now = performance.now()
    s.v = 0.8 * s.v + 0.2 * ((e.clientX - s.lx) / Math.max(1, now - s.lt)) // px per ms, smoothed
    s.lx = e.clientX; s.lt = now
    // rubber-band resistance isn't needed (it wraps), but keep the drag within two cards
    setDrag(Math.max(-2, Math.min(2, dx / STEP)))
  }
  const up = () => {
    const s = st.current
    st.current = null
    if (!s || s.mode !== 'x') return
    blockClick.current = true
    setTimeout(() => { blockClick.current = false }, 60)
    const projected = drag + (s.v * 220) / STEP // where a flick would carry it
    const target = idx - Math.max(-2, Math.min(2, Math.round(projected)))
    setDragging(false)
    setDrag(0)
    go(target)
  }

  const pos = idx - drag
  return (
    <div className={'y-flow' + (dragging ? ' dragging' : '')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {list.map((s, i) => {
        let o = (((i - pos) % count) + count) % count
        if (o > count / 2) o -= count
        const a = Math.abs(o)
        const opacity = a <= 1 ? 1 - a * 0.42 : Math.max(0, 0.58 - (a - 1) * 0.58)
        return (
          <button
            key={s.href || i}
            type="button"
            className={'y-flow-card' + (i === idx && !dragging ? ' on' : '')}
            style={{
              transform: `translateX(${o * 60}%) translateZ(${-Math.min(a, 2.2) * 200}px) rotateY(${-o * 32}deg)`,
              zIndex: 20 - Math.round(a * 4),
              opacity,
              '--d': Math.min(1, a) * 0.45,
            }}
            onClick={() => { if (blockClick.current) return; if (i === idx) navigate(s.href); else go(i) }}
            aria-label={i === idx ? `Open ${s.title}` : `Show ${s.title}`}
            tabIndex={a > 1.2 ? -1 : 0}
          >
            {s.poster || s.backdrop ? <img src={s.poster || s.backdrop} alt="" draggable="false" /> : <span>{s.title}</span>}
          </button>
        )
      })}
      {count > 1 && (
        <div className="y-flow-dots" aria-hidden="true">
          {list.map((s, i) => <i key={s.href || i} className={i === idx ? 'on' : ''} />)}
        </div>
      )}
    </div>
  )
}
