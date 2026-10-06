import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Icon from './Icons'

// Brand wordmark — change this to whatever you'd like the site called.
const BRAND = 'AniWave'

const NAV = [
  { to: '/', label: 'Home', icon: Icon.home, end: true },
  { to: '/anime', label: 'Anime', icon: Icon.bolt },
  { to: '/tv', label: 'TV', icon: Icon.tv },
  { to: '/movies', label: 'Movies', icon: Icon.film },
  { to: '/watchlist', label: 'List', icon: Icon.bookmark },
]

export default function Navbar({ user, profile, onAuthClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const [q, setQ] = useState('')
  const menuRef = useRef(null)
  const baseVHRef = useRef(0)
  const navigate = useNavigate()

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
      // Hide the dock immediately when the keyboard opens, but only re-show it
      // once viewport events have gone quiet (~300ms) — i.e. after the close
      // animation has fully settled. iOS shoves fixed elements around during the
      // close, so showing mid-animation is what made the dock appear to bounce.
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

  // Transparent over the hero, frosted once you scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  return (
    <>
      <header className={'topbar' + (scrolled ? ' scrolled' : '')}>
        <Link to="/" className="brand">
          <span className="brand-dot" />
          {BRAND}
        </Link>

        <nav className="nav-links">
          {NAV.map((n) => (
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

        <form className="topbar-search" onSubmit={submitSearch}>
          <Icon.search width="16" height="16" />
          <input
            type="search"
            enterKeyHint="search"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search anime, shows and movies"
          />
        </form>

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
                <button className="menu-item danger" onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onAuthClick}>Sign In</button>
        )}
      </header>

      <nav className={'dock' + (kbOpen ? ' dock-hidden' : '')} aria-label="Primary">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => 'dock-item' + (isActive ? ' active' : '')}
            aria-label={n.label}
            title={n.label}
          >
            <n.icon />
            <span className="dock-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
