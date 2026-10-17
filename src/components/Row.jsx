import { useRef, useEffect } from 'react'

const Chevron = ({ flip }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={flip ? { transform: 'rotate(180deg)' } : undefined} aria-hidden="true">
    <path d="m9 5 7 7-7 7" />
  </svg>
)

// Horizontal carousel with a title, optional "See all" and round scroll buttons.
// `wide` = landscape cards (banners / categories); `hover` = wide cards expand
// an info panel on hover, so the row needs extra room underneath.
export default function Row({ title, href, onMore, children, loading, count = 7, wide = false, hover = false, sub, className = '' }) {
  const trackRef = useRef(null)
  const secRef = useRef(null)

  // Rows fade and rise into view as they scroll on screen.
  useEffect(() => {
    const el = secRef.current
    if (!el || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    el.classList.add('rv')
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('rv-in'); io.disconnect() } }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const raf = useRef(0)
  const drag = useRef(null)
  const suppress = useRef(false)

  // Eased scroll (instead of the browser's abrupt smooth-scroll) for the arrow buttons.
  const glide = (el, to, dur = 620) => {
    cancelAnimationFrame(raf.current)
    const from = el.scrollLeft
    const t0 = performance.now()
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      el.scrollLeft = from + (to - from) * (1 - Math.pow(1 - k, 4))
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }
  const page = (dir) => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    glide(el, Math.max(0, Math.min(max, el.scrollLeft + dir * Math.max(el.clientWidth * 0.85, 280))))
  }

  // Mouse: grab and drag the row, release to coast. (Touch already scrolls natively with momentum.)
  const onDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = trackRef.current
    cancelAnimationFrame(raf.current)
    drag.current = { x: e.clientX, left: el.scrollLeft, lx: e.clientX, lt: performance.now(), v: 0, moved: false }
  }
  const onMove = (e) => {
    const d = drag.current
    const el = trackRef.current
    if (!d || !el) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 5) return
    if (!d.moved) { d.moved = true; el.classList.add('grabbing'); el.setPointerCapture?.(e.pointerId) }
    const now = performance.now()
    d.v = 0.7 * d.v + 0.3 * ((e.clientX - d.lx) / Math.max(1, now - d.lt))
    d.lx = e.clientX; d.lt = now
    el.scrollLeft = d.left - dx
  }
  const onUp = () => {
    const d = drag.current
    const el = trackRef.current
    drag.current = null
    if (!d || !el) return
    el.classList.remove('grabbing')
    if (!d.moved) return
    suppress.current = true
    setTimeout(() => { suppress.current = false }, 80)
    let v = -d.v * 16 // px per frame
    const coast = () => {
      el.scrollLeft += v
      v *= 0.94
      if (Math.abs(v) > 0.4) raf.current = requestAnimationFrame(coast)
    }
    raf.current = requestAnimationFrame(coast)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <section ref={secRef} className={'row y-row' + (hover ? ' y-row-hover' : '') + (className ? ' ' + className : '')}>
      <div className="row-head">
        <h2>{title}</h2>
        {sub && <span className="y-eyebrow">{sub}</span>}
        <div className="row-tools">
          {onMore && <a onClick={onMore} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onMore() }} style={{ cursor: 'pointer' }}>See all</a>}
          {href && !onMore && <a href={href}>See all</a>}
          <button type="button" className="y-circle row-btn" onClick={() => page(-1)} aria-label="Scroll left" tabIndex={-1}><Chevron flip /></button>
          <button type="button" className="y-circle row-btn" onClick={() => page(1)} aria-label="Scroll right" tabIndex={-1}><Chevron /></button>
        </div>
      </div>
      <div className="row-body">
        <div className={'row-track' + (wide ? ' wide' : '')} ref={trackRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={(e) => { if (suppress.current) { e.preventDefault(); e.stopPropagation() } }} onDragStart={(e) => e.preventDefault()}>
          {loading
            ? Array.from({ length: count }).map((_, i) => (
                <div key={i}><div className={'y-skel ' + (wide ? 'skel-wide' : 'skel-poster')} /></div>
              ))
            : children}
        </div>
      </div>
    </section>
  )
}
