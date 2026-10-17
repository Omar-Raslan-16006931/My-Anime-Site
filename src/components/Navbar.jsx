import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useProfiles, profileActions, vivid } from '../lib/profiles'
import { openSurprise } from '../lib/surprise'

// Brand wordmark (rendered upper-case with an accent dot).
const BRAND = 'Yoru'

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

export default function Navbar({ user, profile, onAuthClick }) {
  const [scrolled, setScrolled] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const [dockAway, setDockAway] = useState(false)
  const [q, setQ] = useState('')
  const baseVHRef = useRef(0)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { profiles, active } = useProfiles()

  const account = profile?.username || user?.email?.split('@')[0] || ''
  useEffect(() => { profileActions.ensure(account || 'Me') }, [account])
  const me = active || profiles[0]
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

  // Top bar is see-through over the home hero and solid after 40px of scroll.
  // The tab bar tucks away while scrolling down and returns on scroll up.
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 40)
      const d = y - last
      if (Math.abs(d) > 8) { setDockAway(d > 0 && y > 140); last = y }
      if (y < 60) setDockAway(false)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const submitSearch = (e) => {
    e.preventDefault()
    const v = q.trim()
    document.activeElement?.blur?.()
    navigate(v ? `/search?q=${encodeURIComponent(v)}` : '/search')
  }

  if (NO_CHROME.includes(pathname)) return null
  const overHero = pathname === '/' && !scrolled

  return (
    <>
      <header className={'topbar y-top' + (overHero ? ' over-hero' : '') + (scrolled ? ' scrolled' : '')}>
        <Link to="/" className="brand y-brand" aria-label={BRAND}>{BRAND}<i>.</i></Link>

        <nav className="y-links" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={'y-link' + (navOn(n, pathname) ? ' on' : '')}>{n.label}</NavLink>
          ))}
        </nav>

        <div className="y-top-right">
          <button type="button" className="y-surprise" onClick={openSurprise}>Surprise me</button>
          <form className={'y-search' + (q ? ' has-text' : '')} onSubmit={submitSearch} onClick={() => { if (pathname !== '/search') navigate('/search') }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="6" cy="6" r="4.5" /><line x1="9.5" y1="9.5" x2="13" y2="13" /></svg>
            <input type="search" enterKeyHint="search" placeholder="Titles, genres, people" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search anime, shows and movies" />
          </form>
        </div>

        {!onMe && (
          <Link to="/search" className="y-top-search" aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
          </Link>
        )}
        <Link to="/me" className={'y-me-wrap top' + (onMe ? ' on' : '')} aria-label="Your profile, list and settings">
          <span className="y-me" key={`${me?.id}-${me?.hue}`} style={{ background: vivid(me?.hue || 0) }}>{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}</span>
        </Link>
      </header>

      {/* Phone tab bar: floating pill. The selected tab expands into a white pill with its label. */}
      <nav className={'ydock' + (kbOpen ? ' hide' : '') + (dockAway ? ' away' : '')} aria-label="Primary" style={{ '--n': DOCK.length + 1 }}>
        <span className="ydock-ind" style={{ '--i': Math.max(tab, 0), opacity: tab < 0 ? 0 : undefined }} aria-hidden="true" />
        {DOCK.map((d, i) => (
          <NavLink key={d.key} to={d.to} aria-label={d.label} aria-current={i === tab ? 'page' : undefined} className={'ydock-item' + (i === tab ? ' on' : '')}>
            {d.icon}
            <span className="ydock-label">{d.label}</span>
          </NavLink>
        ))}
        <NavLink to="/me" aria-label="Your profile" aria-current={onMe ? 'page' : undefined} className={'ydock-item ydock-you' + (onMe ? ' on' : '')}>
          <span className="y-me" key={`${me?.id}-${me?.hue}`} style={{ background: vivid(me?.hue || 0) }}>{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}</span>
          <span className="ydock-label">You</span>
        </NavLink>
      </nav>
    </>
  )
}
