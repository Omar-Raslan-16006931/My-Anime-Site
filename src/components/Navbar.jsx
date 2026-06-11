import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Icon from './Icons'

const NAV = [
  { to: '/', label: 'Home', icon: Icon.home, end: true },
  { to: '/anime', label: 'Anime', icon: Icon.bolt },
  { to: '/tv', label: 'TV', icon: Icon.tv },
  { to: '/movies', label: 'Movies', icon: Icon.film },
  { to: '/watchlist', label: 'List', icon: Icon.bookmark },
]

export default function Navbar({ user, profile, onAuthClick, onSearchClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [q, setQ] = useState('')
  const menuRef = useRef(null)
  const navigate = useNavigate()

  // Netflix behavior: transparent over the hero, solid once you scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
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
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: isMobile ? '0 12px' : '0 24px',
        height: isMobile ? 56 : 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <Link
        to="/"
        style={{
          fontWeight: 800,
          fontSize: isMobile ? 18 : 22,
          cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          whiteSpace: 'nowrap'
        }}
      >
        FuckTheJews
      </Link>

      <div style={{ display: 'flex', gap: isMobile ? 4 : 8, alignItems: 'center' }}>
        <NavLink to="/" end style={navBtnStyle}>
          {isMobile ? 'H' : 'Home'}
        </NavLink>

        <nav className="nav-links">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-spacer" />

        <form className="topbar-search" onSubmit={submitSearch}>
          <Icon.search width="16" height="16" />
          <input
            placeholder="Search anime…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>

        {user ? (
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button className="avatar" onClick={() => setMenuOpen((v) => !v)}>{initial}</button>
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

      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            <n.icon />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
