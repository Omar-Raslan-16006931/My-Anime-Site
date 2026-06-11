import { useRef } from 'react'

const Chevron = ({ flip }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={flip ? { transform: 'rotate(180deg)' } : undefined}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

// Horizontal scrolling carousel row with Netflix-style hover arrows.
export default function Row({ title, href, onMore, children, loading, count = 7 }) {
  const trackRef = useRef(null)

  const page = (dir) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className="row">
      <div className="row-head">
        <h2>{title}</h2>
        {onMore && <a onClick={onMore} style={{ cursor: 'pointer' }}>See all ›</a>}
        {href && !onMore && <a href={href}>See all ›</a>}
      </div>
      <div className="row-body">
        <button className="row-arrow left" onClick={() => page(-1)} aria-label="Scroll left" tabIndex={-1}>
          <Chevron flip />
        </button>
        <div className="row-track" ref={trackRef}>
          {loading
            ? Array.from({ length: count }).map((_, i) => (
                <div key={i}><div className="skel skel-poster" /></div>
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
