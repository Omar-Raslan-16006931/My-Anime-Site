import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PRIMARY_PAGES = [
  { id: 'home', label: 'Discover' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'currently-watching', label: 'Watching' },
  { id: 'settings', label: 'Settings' },
]

export default function Navbar({ user, profile, onAuthClick, currentPage, setCurrentPage, onOpenDownloads, onOpenSettings, isElectron }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
  }

  return (
    <nav className="topbar">
      <button
        className="brand-lockup"
        onClick={() => setCurrentPage('home')}
        type="button"
      >
        <span className="brand-lockup__mark">AV</span>
        <span className="brand-lockup__text">
          <strong>Anime Vault</strong>
          <small>Discover, track, and download</small>
        </span>
      </button>

      <div className="topbar__center">
        {PRIMARY_PAGES.map((page) => (
          <button
            key={page.id}
            className={`nav-pill${currentPage === page.id ? ' nav-pill--active' : ''}`}
            onClick={() => {
              if (page.id === 'downloads' && onOpenDownloads) return onOpenDownloads()
              if (page.id === 'settings' && onOpenSettings) return onOpenSettings()
              setCurrentPage(page.id)
            }}
            type="button"
          >
            {isMobile ? page.label.slice(0, 1) : page.label}
          </button>
        ))}
      </div>

      <div className="topbar__actions">
        {isElectron && (
          <button className="topbar__ghost" type="button" onClick={onOpenDownloads}>
            Desktop
          </button>
        )}

        {user ? (
          <div className="profile-menu-wrap">
            <div
              onClick={() => setMenuOpen(!menuOpen)}
              className="profile-badge"
            >
              {(profile?.username || user.email)[0].toUpperCase()}
            </div>

            {menuOpen && (
              <div className="profile-menu">
                <div className="profile-menu__head">
                  <span>@{profile?.username || user.email}</span>
                </div>

                <button
                  className="profile-menu__item"
                  onClick={() => { setCurrentPage('profile'); setMenuOpen(false) }}
                >
                  Profile
                </button>

                <button
                  className="profile-menu__item"
                  onClick={() => { setCurrentPage('currently-watching'); setMenuOpen(false) }}
                >
                  Currently Watching
                </button>

                <button
                  className="profile-menu__item"
                  onClick={() => { setCurrentPage('downloads'); setMenuOpen(false) }}
                >
                  Downloads
                </button>

                <button
                  className="profile-menu__item"
                  onClick={() => { setCurrentPage('settings'); setMenuOpen(false) }}
                >
                  Settings
                </button>

                <button
                  className="profile-menu__item profile-menu__item--danger"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="topbar__auth"
            onClick={onAuthClick}
            type="button"
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  )
}