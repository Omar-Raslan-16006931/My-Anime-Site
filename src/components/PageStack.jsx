import { useEffect, useLayoutEffect, useRef } from 'react'

// Instant page switches. The four tab pages stay mounted once visited (hidden, not unmounted), so
// going back to one is just showing it again: no reload, no placeholders, no animation, and it comes
// back at the scroll position you left it. Other pages (titles, categories…) render normally.
// Each kept page renders with its own last location, so a hidden page never reacts to another URL.
const TABS = ['/', '/simulcast', '/search', '/me']

export default function PageStack({ location, render }) {
  const path = location.pathname
  const tab = TABS.includes(path) ? path : null
  const kept = useRef(new Map())
  if (tab) kept.current.set(tab, location)

  const scrolls = useRef({})
  const shown = useRef(path)
  useLayoutEffect(() => {
    if (shown.current === path) return
    shown.current = path
    window.scrollTo(0, tab ? scrolls.current[path] || 0 : 0)
  }, [path, tab])
  useEffect(() => {
    const on = () => { scrolls.current[shown.current] = window.scrollY }
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <>
      {[...kept.current].map(([p, loc]) => (
        <div key={p} className={'route-anim' + (p === tab ? '' : ' kp-off')} aria-hidden={p === tab ? undefined : true}>
          {render(loc)}
        </div>
      ))}
      {!tab && <div key={path} className="route-anim">{render(location)}</div>}
    </>
  )
}
