import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { isNative } from '../lib/native'
import { SCHEMES, SCHEME_NAMES, setScheme, useScheme, glow } from '../lib/theme'
import { useProfiles, profileActions } from '../lib/profiles'
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
  { to: '/browse', label: 'Categories', match: ['/browse', '/category'] },
  { to: '/watchlist', label: 'My List', match: ['/watchlist'] },
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
  { key: 'list', to: '/watchlist', label: 'My List', icon: ico(<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z" />), match: (p) => hit(p, '/watchlist') },
  { key: 'browse', to: '/browse', label: 'Browse', icon: ico(<><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>), match: (p) => ['/browse', '/category', '/anime', '/movies', '/tv'].some((x) => p === x || (x === '/category' && hit(p, x))) },
]
const NO_CHROME = ['/profiles', '/welcome']

export default function Navbar({ user, profile, onAuthClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const [dockAway, setDockAway] = useState(false)
  const [q, setQ] = useState('')
  const menuRef = useRef(null)
  const dockMenuRef = useRef(null)
  const baseVHRef = useRef(0)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const scheme = useScheme()
  const { profiles, active } = useProfiles()

  const account = profile?.username || user?.email?.split('@')[0] || ''
  useEffect(() => { profileActions.ensure(account || 'Me') }, [account])
  const me = active || profiles[0]
  const initial = (me?.name || account || 'G')[0].toUpperCase()
  const tab = DOCK.findIndex((d) => d.match(pathname))

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

  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => {
    const onClick = (e) => {
      const inside = [menuRef.current, dockMenuRef.current].some((n) => n && n.contains(e.target))
      if (!inside) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const submitSearch = (e) => {
    e.preventDefault()
    const v = q.trim()
    document.activeElement?.blur?.()
    navigate(v ? `/search?q=${encodeURIComponent(v)}` : '/search')
  }

  if (NO_CHROME.includes(pathname)) return null
  const overHero = pathname === '/' && !scrolled
  const go = (to) => { setMenuOpen(false); navigate(to) }

  const meWrap = (where, ref) => (
    <div className={'y-me-wrap ' + where} ref={ref}>
      <button className="y-me" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu" aria-expanded={menuOpen}
        style={{ background: glow(me?.hue || 0) }}>
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}
      </button>
      {menuOpen && (
        <div className="y-menu" role="menu">
          <div className="y-menu-head">
            <b>{me?.name || 'Guest'}</b>
            <span>{user ? `@${account}` : 'Not signed in'}</span>
          </div>
          <button className="y-menu-item" onClick={() => go('/profiles')}>Who’s watching?</button>
          {user && <button className="y-menu-item" onClick={() => go('/profile')}>Account</button>}
          {user && <button className="y-menu-item" onClick={() => go('/currently-watching')}>Currently Watching</button>}
          <button className="y-menu-item" onClick={() => go('/watchlist')}>My List</button>
          <button className="y-menu-item" onClick={() => go('/recommend')}>AI picks</button>
          {isNative && <button className="y-menu-item" onClick={() => go('/downloads')}>Downloads</button>}
          <div className="y-menu-label">Colour</div>
          <div className="y-swatches">
            {SCHEME_NAMES.map((k) => (
              <button key={k} type="button" className={'y-swatch' + (scheme === k ? ' on' : '')} title={k} aria-label={k + ' colour scheme'} aria-pressed={scheme === k} onClick={() => setScheme(k)}>
                <span style={{ background: SCHEMES[k].bg }} /><span style={{ background: SCHEMES[k].s2 }} /><span style={{ background: SCHEMES[k].ac }} />
              </button>
            ))}
          </div>
          {user
            ? <button className="y-menu-item danger" onClick={handleLogout}>Log out</button>
            : <button className="y-menu-item strong" onClick={() => { setMenuOpen(false); onAuthClick?.() }}>Sign in</button>}
        </div>
      )}
    </div>
  )

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

        <Link to="/search" className="y-top-search" aria-label="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
        </Link>
        {meWrap('top', menuRef)}
      </header>

      {/* Phone tab bar: floating pill. The selected tab expands into a white pill with its label. */}
      <nav className={'ydock' + (kbOpen ? ' hide' : '') + (dockAway ? ' away' : '')} aria-label="Primary">
        <span className="ydock-ind" style={{ '--i': Math.max(tab, 0), opacity: tab < 0 ? 0 : undefined }} aria-hidden="true" />
        {DOCK.map((d, i) => (
          <NavLink key={d.key} to={d.to} aria-label={d.label} aria-current={i === tab ? 'page' : undefined} className={'ydock-item' + (i === tab ? ' on' : '')}>
            {d.icon}
            <span className="ydock-label">{d.label}</span>
          </NavLink>
        ))}
        {meWrap('dockme', dockMenuRef)}
      </nav>
    </>
  )
}
