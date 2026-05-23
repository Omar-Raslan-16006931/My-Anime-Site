import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Navbar({ user, profile, onAuthClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )

  const navigate = useNavigate()

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const navBtnStyle = ({ isActive }) => ({
    background: isActive ? 'var(--bg3)' : 'transparent',
    color: isActive ? 'var(--text)' : 'var(--text2)',
    padding: isMobile ? '6px 10px' : '8px 16px',
    borderRadius: 8,
    fontWeight: isActive ? 600 : 400,
    fontSize: isMobile ? 12 : 14,
    transition: 'all 0.2s',
    textTransform: 'capitalize',
    border: 'none'
  })

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
        AniWave
      </Link>

      <div style={{ display: 'flex', gap: isMobile ? 4 : 8, alignItems: 'center' }}>
        <NavLink to="/" end style={navBtnStyle}>
          {isMobile ? 'H' : 'Home'}
        </NavLink>

        <NavLink to="/watchlist" style={navBtnStyle}>
          {isMobile ? 'W' : 'Watchlist'}
        </NavLink>

        <NavLink to="/tv" style={navBtnStyle}>
          {isMobile ? 'TV' : 'TV Shows'}
        </NavLink>

        <NavLink to="/movies" style={navBtnStyle}>
          {isMobile ? 'M' : 'Movies'}
        </NavLink>

        {user ? (
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: isMobile ? 32 : 38,
                height: isMobile ? 32 : 38,
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: isMobile ? 13 : 16,
                color: '#fff',
                userSelect: 'none'
              }}
            >
              {(profile?.username || user.email)[0].toUpperCase()}
            </div>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: isMobile ? 40 : 48,
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 6,
                  minWidth: isMobile ? 160 : 180,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}
              >
                <div
                  style={{
                    padding: '8px 10px',
                    color: 'var(--text2)',
                    fontSize: 12,
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  @{profile?.username || user.email}
                </div>

                <button
                  onClick={() => {
                    navigate('/profile')
                    setMenuOpen(false)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 13
                  }}
                >
                  Profile
                </button>

                <button
                  onClick={() => {
                    navigate('/currently-watching')
                    setMenuOpen(false)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 13
                  }}
                >
                  Currently Watching
                </button>

                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--accent)',
                    fontSize: 13
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onAuthClick}
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: '#fff',
              padding: isMobile ? '7px 12px' : '8px 20px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: isMobile ? 12 : 14,
              transition: 'opacity 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  )
}
