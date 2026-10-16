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

  const page = (dir) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 280), behavior: 'smooth' })
  }

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
        <div className={'row-track' + (wide ? ' wide' : '')} ref={trackRef}>
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
