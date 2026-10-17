import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useProfiles, profileActions, vivid } from '../lib/profiles'
import { openSurprise } from '../lib/surprise'
import QuickSearch from './QuickSearch'

// Brand wordmark (rendered upper-case with an accent dot).
const BRAND = 'FuckTheJews'

// Top-bar links. `match` = path prefixes that keep the link lit on detail
// pages (e.g. /anime/21 keeps "Anime" selected).
const NAV = [
  { to: '/', label: 'Home', end: true, match: [] },
  { to: '/anime', label: 'Anime', match: ['/anime'] },
  { to: '/movies', label: 'Movies', match: ['/movies', '/movie'] },
  { to: '/tv', label: 'TV', match: ['/tv'] },
  { to: '/simulcast', label: 'Simulcast', match: ['/simulcast'] },
  { to: '/search', label: 'Explore', match: ['/search', '/browse', '/category'] },
]
const hit = (pathname, p) => pathname === p || pathname.startsWith(p + '/')
const navOn = (n, pathname) => (n.end ? pathname === n.to : n.match.some((p) => hit(pathname, p)))

// Phone tab bar — line icons on a 24px grid.
const ico = (children) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{children}</svg>
)
const DOCK = [
  { key: 'home', to: '/', label: 'Home', icon: ico(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />), match: (p) => p === '/' },
  { key: 'simulcast', to: '/simulcast', label: 'Simulcast', icon: ico(<><rect x="3" y="4.5" width="18" height="16" rx="3.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>), match: (p) => hit(p, '/simulcast') },
  { key: 'explore', to: '/search', label: 'Explore', icon: ico(<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>), match: (p) => ['/search', '/browse', '/category', '/anime', '/movies', '/tv'].some((x) => hit(p, x)) },
]
const NO_CHROME = ['/profiles', '/welcome']

export default function Navbar({ user, profile }) {
  const [scrolled, setScrolled] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const baseVHRef = useRef(0)
  const { pathname } = useLocation()
  const { profiles, active } = useProfiles()

  const account = profile?.username || user?.email?.split('@')[0] || ''
  useEffect(() => { profileActions.ensure(account || 'Me') }, [account])
  const me = active || profiles[0]
  // A profile's own photo; the first profile also shows the account photo.
  const photo = me?.avatar || (me && me === profiles[0] ? profile?.avatar_url : null)
  const initial = (me?.name || account || 'G')[0].toUpperCase()
  const onMe = hit(pathname, '/me')
  const tab = onMe ? DOCK.length : DOCK.findIndex((d) => d.match(pathname))

  // Keyboard: remove the tab bar while the on-screen keyboard is open. Works on
  // iOS (visual viewport shrinks) and Android (layout shrinks).
  useEffect(() => {
    const vv = window.visualViewport
    const visibleH = () => (vv ? vv.height : window.innerHeight)
    baseVHRef.current = visibleH()
    let raf = 0
    let showTimer = 0
    const apply = (open) => {
      clearTimeout(showTimer)
      if (open) setKbOpen(true)
      else showTimer = setTimeout(() => setKbOpen(false), 300)
    }
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const h = visibleH()
        if (h > baseVHRef.current) baseVHRef.current = h
        apply(baseVHRef.current - h > 160)
      })
    }
    const onOrient = () => { baseVHRef.current = 0; update() }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', onOrient)
    if (vv) { vv.addEventListener('resize', update); vv.addEventListener('scroll', update) }
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(showTimer)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', onOrient)
      if (vv) { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
    }
  }, [])

  // Top bar: its backdrop is driven by the scroll position itself (--tb: 0 = clear over the
  // home hero, 1 = solid), so it never "switches" and can't flicker.
  const barRef = useRef(null)
  const pathRef = useRef(pathname)
  const paintRef = useRef(() => {})
  useLayoutEffect(() => {
    let raf = 0
    const paint = () => {
      const y = Math.max(0, window.scrollY)
      const t = pathRef.current === '/' ? Math.min(1, Math.max(0, (y - 12) / 120)) : 1
      barRef.current?.style.setProperty('--tb', t.toFixed(3))
      setScrolled((s) => (y > 40) === s ? s : y > 40)
    }
    paintRef.current = paint
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint() }) }
    paint()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll) }
  }, [])
  useLayoutEffect(() => {
    pathRef.current = pathname
    paintRef.current()
  }, [pathname])

  if (NO_CHROME.includes(pathname)) return null

  return (
    <>
      <header ref={barRef} className={'topbar y-top' + (scrolled ? ' scrolled' : '') + (onMe ? ' on-me' : '')}>
        <Link to="/" className="brand y-brand" aria-label={BRAND}>{BRAND}<i>.</i></Link>
        {onMe && <span className="y-top-title" aria-hidden="true">Profile</span>}

        <nav className="y-links" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={'y-link' + (navOn(n, pathname) ? ' on' : '')}>{n.label}</NavLink>
          ))}
        </nav>

        <div className="y-top-right">
          <button type="button" className="y-surprise" onClick={openSurprise}>Surprise me</button>
          {pathname !== '/search' && <QuickSearch />}
        </div>

        <button type="button" className="y-top-search y-top-dice" onClick={openSurprise} aria-label="Surprise me" title="Surprise me">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" /><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" /><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" /><circle cx="12" cy="12" r="1.1" fill="currentColor" /></svg>
        </button>
        <Link to="/me" className={'y-me-wrap top' + (onMe ? ' on' : '')} aria-label="Your profile, list and settings">
          <span className="y-me" key={`${me?.id}-${me?.hue}`} style={{ background: vivid(me?.hue || 0) }}>{photo ? <img src={photo} alt="" /> : initial}</span>
        </Link>
      </header>

      {/* Phone tab bar: floating pill. The selected tab expands into a white pill with its label. */}
      <nav className={'ydock' + (kbOpen ? ' hide' : '')} aria-label="Primary" style={{ '--n': DOCK.length + 1 }}>
        <span className={'ydock-ind' + (tab < 0 ? ' off' : '')} style={{ '--i': Math.max(tab, 0) }} aria-hidden="true" />
        {DOCK.map((d, i) => (
          <NavLink key={d.key} to={d.to} aria-label={d.label} aria-current={i === tab ? 'page' : undefined} className={'ydock-item' + (i === tab ? ' on' : '')}
            onClick={(e) => { if (i === tab && pathname === d.to) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) } }}>
            {d.icon}
            <span className="ydock-label">{d.label}</span>
          </NavLink>
        ))}
        <NavLink to="/me" aria-label="Your profile" aria-current={onMe ? 'page' : undefined} className={'ydock-item ydock-you' + (onMe ? ' on' : '')}
          onClick={(e) => { if (pathname === '/me' && !window.location.search) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) } }}>
          <span className="y-me" key={`${me?.id}-${me?.hue}`} style={{ background: vivid(me?.hue || 0) }}>{photo ? <img src={photo} alt="" /> : initial}</span>
          <span className="ydock-label">You</span>
        </NavLink>
      </nav>
    </>
  )
}
