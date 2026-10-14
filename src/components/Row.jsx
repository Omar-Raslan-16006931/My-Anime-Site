import { useRef, useState, useEffect, useCallback } from 'react'

const Chevron = ({ flip }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={flip ? { transform: 'rotate(180deg)' } : undefined}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

// Horizontal carousel. Netflix-style edges on PC: once you've scrolled, the
// cards fade to black at that edge, and the arrow shows on hover.
// `wide` = landscape cards (banners / categories) instead of posters.
export default function Row({ title, href, onMore, children, loading, count = 7, wide = false }) {
  const trackRef = useRef(null)
  const [edge, setEdge] = useState({ l: false, r: false })

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const l = el.scrollLeft > 4
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }))
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [measure])

  // Cards arriving doesn't resize the track box, so re-check after renders.
  useEffect(() => { measure() })

  const page = (dir) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section className="row">
      <div className="row-head">
        <h2>{title}</h2>
        {onMore && <a onClick={onMore} style={{ cursor: 'pointer' }}>See all ›</a>}
        {href && !onMore && <a href={href}>See all ›</a>}
      </div>
      <div className={'row-body' + (edge.l ? ' has-l' : '') + (edge.r ? ' has-r' : '')}>
        <button className="row-arrow left" onClick={() => page(-1)} aria-label="Scroll left" tabIndex={-1}>
          <Chevron flip />
        </button>
        <div className={'row-track' + (wide ? ' wide' : '')} ref={trackRef} onScroll={measure}>
          {loading
            ? Array.from({ length: count }).map((_, i) => (
                <div key={i}><div className={'skel ' + (wide ? 'skel-wide' : 'skel-poster')} /></div>
              ))
            : children}
        </div>
        <button className="row-arrow right" onClick={() => page(1)} aria-label="Scroll right" tabIndex={-1}>
          <Chevron />
        </button>
      </div>
    </section>
  )
}
