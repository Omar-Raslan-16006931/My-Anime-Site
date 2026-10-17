import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
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
// Loading placeholder: the same layout as the real hero (ghost posters, title and button stubs), so
// nothing jumps when the real slides arrive.
export function HeroPlaceholder() {
  const phone = useIsPhone()
  if (phone) {
    const slot = (o) => ({ transform: `translateX(${o * 60}%) translateZ(${-Math.abs(o) * 200}px) rotateY(${-o * 32}deg)`, opacity: o ? 0.5 : 1, zIndex: 20 - Math.abs(o) * 4 })
    return (
      <div className="y-hero-m y-ph" aria-hidden="true">
        <div className="y-hero-m-shade" />
        <div className="y-flow">
          {[-1, 1, 0].map((o) => <div key={o} className="y-flow-card y-ph-card" style={slot(o)} />)}
        </div>
        <div className="y-hero-m-info">
          <div className="y-ph-bar" style={{ width: '58%', height: 20 }} />
          <div className="y-ph-bar" style={{ width: '36%', height: 12 }} />
          <div className="y-hero-m-btns">
            <div className="y-ph-bar" style={{ width: 112, height: 40, borderRadius: 999 }} />
            <div className="y-ph-bar" style={{ width: 40, height: 40, borderRadius: 999 }} />
            <div className="y-ph-bar" style={{ width: 40, height: 40, borderRadius: 999 }} />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="y-hero y-ph" aria-hidden="true">
      <div className="y-hero-text">
        <div className="y-ph-bar" style={{ width: 160, height: 12 }} />
        <div className="y-ph-bar" style={{ width: 'min(520px, 60%)', height: 52, borderRadius: 14 }} />
        <div className="y-ph-bar" style={{ width: 200, height: 14 }} />
        <div className="y-ph-bar" style={{ width: 'min(480px, 55%)', height: 44 }} />
        <div className="y-hero-actions">
          <div className="y-ph-bar" style={{ width: 120, height: 48, borderRadius: 16 }} />
          <div className="y-ph-bar" style={{ width: 150, height: 48, borderRadius: 16 }} />
        </div>
      </div>
    </div>
  )
}

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

  // Hover parallax (PC): layers drift and the poster stage tilts with the pointer.
  const onMouse = (e) => {
    const el = root.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3))
    el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3))
  }
  const onLeave = () => {
    const el = root.current
    if (!el) return
    el.style.setProperty('--mx', '0')
    el.style.setProperty('--my', '0')
  }

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
          <img key={'bg' + (s.href || i)} src={s.poster || s.backdrop} alt="" aria-hidden="true" className={'y-hero-m-bg' + (i === idx ? ' on' : '')} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'low'} decoding="async" />
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
    <div className="y-hero y-hero-pc" ref={root} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseMove={onMouse} onMouseLeave={onLeave}>
      <div className="y-hero-bg">
        {list.map((s, i) => (s.poster || s.backdrop) && (
          <img key={s.href || i} src={s.poster || s.backdrop} alt="" aria-hidden="true" className={'y-hero-pbg' + (i === idx ? ' on' : '')} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'low'} decoding="async" />
        ))}
      </div>
      <div className="y-scrim y-hero-scrim" />
      <div className="y-hero-flowwrap">
        <Coverflow list={list} idx={idx} go={go} pause={pause} navigate={navigate} />
      </div>
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

// 3D poster coverflow driven by physics. The cards are positioned straight from one continuous `pos`
// value (no React re-render, no CSS transitions): your finger sets it while dragging, and on release a
// critically-damped spring carries it to the nearest card with the speed of your flick.
const STEP = 126 // px of finger travel per card
const K = 150 // spring stiffness
const C = 2 * Math.sqrt(K) // critical damping: settles fast, never wobbles
const mod = (n, m) => ((n % m) + m) % m

function Coverflow({ list, idx, go, pause, navigate }) {
  const count = list.length
  const els = useRef([])
  const pos = useRef(idx)
  const raf = useRef(0)
  const st = useRef(null)
  const dragging = useRef(false)
  const blockClick = useRef(false)

  const paint = useCallback((p) => {
    for (let i = 0; i < count; i++) {
      const el = els.current[i]
      if (!el) continue
      let o = mod(i - p, count)
      if (o > count / 2) o -= count
      const a = Math.abs(o)
      el.style.transform = `translateX(${o * 60}%) translateZ(${-Math.min(a, 2.2) * 200}px) rotateY(${-o * 32}deg)`
      el.style.opacity = a <= 1 ? 1 - a * 0.42 : Math.max(0, 0.58 - (a - 1) * 0.58)
      el.style.zIndex = 20 - Math.round(a * 4)
      el.style.setProperty('--d', Math.min(1, a) * 0.45)
      el.tabIndex = a > 1.2 ? -1 : 0
    }
  }, [count])

  // Spring from the current position/velocity to `target` (an unbounded card number).
  const spring = useCallback((target, v0 = 0) => {
    cancelAnimationFrame(raf.current)
    let v = v0
    let last = performance.now()
    const tick = (t) => {
      const dt = Math.min(0.032, (t - last) / 1000)
      last = t
      const x = pos.current
      v += (-K * (x - target) - C * v) * dt
      pos.current = x + v * dt
      if (Math.abs(pos.current - target) < 0.0008 && Math.abs(v) < 0.01) { pos.current = target; paint(target); return }
      paint(pos.current)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [paint])

  useLayoutEffect(() => { paint(pos.current) }, [paint, list])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // The selected card changed from outside (autoplay, tapping a side card): glide the short way round.
  useEffect(() => {
    if (dragging.current) return
    const cur = pos.current
    let d = mod(idx, count) - mod(Math.round(cur), count)
    if (d > count / 2) d -= count
    if (d < -count / 2) d += count
    const target = Math.round(cur) + d
    if (Math.abs(target - cur) > 0.001) spring(target)
  }, [idx, count, spring])

  const down = (e) => {
    if (count < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return
    st.current = { x: e.clientX, y: e.clientY, p0: pos.current, lx: e.clientX, lt: performance.now(), v: 0, mode: null }
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
      cancelAnimationFrame(raf.current)
      s.p0 = pos.current // pick up a moving card exactly where it is
      s.x = e.clientX - dx
      dragging.current = true
      pause?.()
    }
    const now = performance.now()
    s.v = 0.75 * s.v + 0.25 * ((e.clientX - s.lx) / Math.max(1, now - s.lt)) // px/ms, smoothed
    s.lx = e.clientX; s.lt = now
    pos.current = s.p0 - dx / STEP
    paint(pos.current)
  }
  const up = () => {
    const s = st.current
    st.current = null
    if (!s || s.mode !== 'x') return
    dragging.current = false
    blockClick.current = true
    setTimeout(() => { blockClick.current = false }, 60)
    const vel = -(s.v * 1000) / STEP // cards per second (positive = toward the next card)
    const flick = Math.abs(vel) > 0.35 // a fast flick carries a little further than where you let go
    const target = Math.round(pos.current + (flick ? vel * 0.14 : 0))
    const clamped = Math.max(Math.round(s.p0) - 2, Math.min(Math.round(s.p0) + 2, target))
    go(mod(clamped, count)) // updates the title/buttons right away
    // Carry the flick's speed, but never so much that the card shoots past its resting place and bounces back.
    const dist = clamped - pos.current
    const vmax = Math.sqrt(K) * Math.abs(dist)
    spring(clamped, vel * dist > 0 ? Math.sign(vel) * Math.min(Math.abs(vel), vmax) : vel)
  }

  return (
    <div className="y-flow" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {list.map((s, i) => (
        <button
          key={s.href || i}
          ref={(el) => { els.current[i] = el }}
          type="button"
          className="y-flow-card"
          onClick={() => { if (blockClick.current) return; if (mod(Math.round(pos.current), count) === i) navigate(s.href); else go(i) }}
          aria-label={`Open ${s.title}`}
        >
          {s.poster || s.backdrop ? <img src={s.poster || s.backdrop} alt="" draggable="false" decoding="async" fetchPriority={i === 0 ? 'high' : 'auto'} /> : <span>{s.title}</span>}
        </button>
      ))}
    </div>
  )
}
