import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import Icon from './Icons'
import CategoryMenu from './CategoryMenu'
import { isNative } from '../lib/native'

// Brand wordmark.
const BRAND = 'FuckTheJews'

// Primary navigation. My List (and Downloads in the iPhone app) live in the
// profile menu; "Categories" opens the categories panel instead of a page.
// `match` = path prefixes that count as this tab (so the tab stays lit on
// detail pages, e.g. /anime/21 keeps "Anime" selected).
const NAV = [
  { to: '/', label: 'Home', icon: Icon.home, end: true, match: [] },
  { to: '/anime', label: 'Anime', icon: Icon.bolt, match: ['/anime'] },
  { to: '/movies', label: 'Movies', icon: Icon.film, match: ['/movies', '/movie/'] },
  { to: '/tv', label: 'TV', icon: Icon.tv, match: ['/tv'] },
  { key: 'categories', label: 'Categories', icon: Icon.grid, match: ['/category/'] },
]
// Phone tab bar. Search is a button in the top bar (next to the account).
// Clean line icons for the tab bar (24px grid, 1.8 stroke).
const dockIcon = (children) => function DockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  )
}
const IconHome = dockIcon(<><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>)
const IconAnime = dockIcon(<><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></>)
const IconMovies = dockIcon(<><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" /><path d="m6.2 5.3 3.1 3.9" /><path d="m12.4 3.4 3.1 4" /><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>)
const IconTv = dockIcon(<><rect width="20" height="15" x="2" y="7" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></>)
const DOCK = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/anime', label: 'Anime', icon: IconAnime },
  { to: '/movies', label: 'Movies', icon: IconMovies },
  { to: '/tv', label: 'TV', icon: IconTv },
]
function dockTab(pathname) {
  if (pathname === '/') return 0
  const i = activeTab(pathname)
  return i >= 0 && i < 4 ? i : -1
}

function activeTab(pathname) {
  if (pathname === '/') return 0
  return NAV.findIndex((n) => n.match.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/')))
}

export default function Navbar({ user, profile, onAuthClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [dockAway, setDockAway] = useState(false)
  const [dockMoving, setDockMoving] = useState(false)
  const [q, setQ] = useState('')
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const baseVHRef = useRef(0)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tab = dockTab(pathname)

  // The dock is locked to the bottom and never repositioned. The ONLY thing we
  // do for the keyboard is remove it while the keyboard is open. Detection works
  // on BOTH iOS (visual-viewport shrinks) and Android (layout shrinks): we track
  // the tallest visible height seen (no keyboard) and flag the keyboard when the
  // current visible height drops well below it. ~160px separates a keyboard from
  // the address bar; setState bails when unchanged so there's no churn/loop.
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

  // On the home page (PC) the bar sits see-through over the banner and turns
  // solid black once you scroll. Phones always get the solid bar.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Floating dock: tucks away while scrolling down, returns on scroll up, and
  // tightens slightly while the page is in motion.
  useEffect(() => {
    let last = window.scrollY
    let stop = 0
    const onScroll = () => {
      const y = window.scrollY
      const d = y - last
      if (Math.abs(d) > 8) {
        setDockAway(d > 0 && y > 140)
        last = y
      }
      if (y < 60) setDockAway(false)
      setDockMoving(true)
      clearTimeout(stop)
      stop = setTimeout(() => setDockMoving(false), 160)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(stop) }
  }, [])

  // Close the categories panel whenever the page changes.
  useEffect(() => { setCatOpen(false) }, [pathname])

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
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
    if (!v) return
    // Blur so the phone keyboard closes and results are visible right away.
    document.activeElement?.blur?.()
    navigate(`/search?q=${encodeURIComponent(v)}`)
  }

  const initial = (profile?.username || user?.email || 'G')[0].toUpperCase()
  const overHero = pathname === '/' && !scrolled && !catOpen

  return (
    <>
      <header className={'topbar' + (scrolled ? ' scrolled' : '') + (overHero ? ' over-hero' : '')}>
        <Link to="/" className="brand">{BRAND}</Link>

        <nav className="nav-links">
          {NAV.map((n) => n.key === 'categories' ? (
            <button
              key={n.key}
              type="button"
              className={'nav-link' + (catOpen || pathname.startsWith('/category/') ? ' active' : '')}
              aria-expanded={catOpen}
              onClick={() => setCatOpen((v) => !v)}
            >
              {n.label}
              <svg className={'nav-caret' + (catOpen ? ' up' : '')} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          ) : (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-spacer" />

        <Link to="/recommend" className={'nav-ai' + (pathname === '/recommend' ? ' active' : '')} title="AI picks">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
          <span>AI picks</span>
        </Link>

        <form
          className={'topbar-search' + (q ? ' has-text' : '')}
          onSubmit={submitSearch}
          onClick={() => { if (window.innerWidth >= 880) navigate('/search'); else searchRef.current?.focus() }}
        >
          <Icon.search width="17" height="17" />
          <input
            ref={searchRef}
            type="search"
            enterKeyHint="search"
            placeholder="Search titles"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search anime, shows and movies"
          />
        </form>

        <Link to="/search" className="topbar-search-btn" aria-label="Search">
          <Icon.search width="20" height="20" />
        </Link>

        {user ? (
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button className="avatar" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}
            </button>
            {menuOpen && (
              <div className="menu fade-in">
                <div className="menu-head">@{profile?.username || user.email}</div>
                <button className="menu-item" onClick={() => { navigate('/profile'); setMenuOpen(false) }}>Profile</button>
                <button className="menu-item" onClick={() => { navigate('/currently-watching'); setMenuOpen(false) }}>Currently Watching</button>
                <button className="menu-item" onClick={() => { navigate('/watchlist'); setMenuOpen(false) }}>My List</button>
                <button className="menu-item" onClick={() => { navigate('/recommend'); setMenuOpen(false) }}>AI picks</button>
                {isNative && <button className="menu-item" onClick={() => { navigate('/downloads'); setMenuOpen(false) }}>Downloads</button>}
                <button className="menu-item danger" onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onAuthClick}>Sign In</button>
        )}
      </header>

      {/* Phone tab bar: full width, pinned to the bottom. The red glow is one
          element that slides to the selected tab. */}
      <nav
        className={'dock' + (kbOpen ? ' dock-hidden' : '') + (dockAway ? ' dock-away' : '') + (dockMoving && !dockAway ? ' dock-moving' : '')}
        aria-label="Primary"
        style={{ '--n': DOCK.length, '--i': Math.max(tab, 0) }}
      >
        <span className={'dock-glow' + (tab < 0 ? ' off' : '')} aria-hidden="true" />
        {DOCK.map((n, i) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={'dock-item' + (i === tab ? ' active' : '')}
            aria-current={i === tab ? 'page' : undefined}
          >
            <n.icon />
            <span className="dock-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <CategoryMenu open={catOpen} onClose={() => setCatOpen(false)} />
    </>
  )
}
