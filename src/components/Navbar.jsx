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
  const navigate = useNavigate()

  // The dock is locked to the bottom and never repositioned. The ONLY thing we
  // do for the keyboard is remove it while the keyboard is open — detected from
  // the visual viewport height (a stable signal), NOT focus events (which fire
  // erratically on mobile and caused the earlier oscillation). The 120px
  // threshold means only a real keyboard triggers it, never the address bar,
  // and setState bails when the value is unchanged so there's no churn/loop.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const overlap = window.innerHeight - vv.height - vv.offsetTop
        setKbOpen(overlap > 120)
      })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
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
    if (q.trim()) navigate(`/anime?q=${encodeURIComponent(q.trim())}`)
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
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search anime"
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
