import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Navbar({ user, profile, onAuthClick, currentPage, setCurrentPage }) {
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
    <nav style={{
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
    }}>
      <div
        onClick={() => setCurrentPage('home')}
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
        FuckCrunchyroll
      </div>

      <div style={{ display: 'flex', gap: isMobile ? 4 : 8, alignItems: 'center' }}>
        {['home', 'watchlist'].map(page => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            style={{
              background: currentPage === page ? 'var(--bg3)' : 'transparent',
              color: currentPage === page ? 'var(--text)' : 'var(--text2)',
              padding: isMobile ? '6px 10px' : '8px 16px',
              borderRadius: 8,
              fontWeight: currentPage === page ? 600 : 400,
              fontSize: isMobile ? 12 : 14,
              transition: 'all 0.2s',
              textTransform: 'capitalize'
            }}
          >
            {isMobile ? page.slice(0, 1) : page}
          </button>
        ))}

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
              <div style={{
                position: 'absolute',
                right: 0,
                top: isMobile ? 40 : 48,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 6,
                minWidth: isMobile ? 160 : 180,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}>
                <div style={{
                  padding: '8px 10px',
                  color: 'var(--text2)',
                  fontSize: 12,
                  borderBottom: '1px solid var(--border)',
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  @{profile?.username || user.email}
                </div>

                <button
                  onClick={() => { setCurrentPage('profile'); setMenuOpen(false) }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 13,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}
                >
                  Profile
                </button>

                <button
                  onClick={() => { setCurrentPage('currently-watching'); setMenuOpen(false) }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 13,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}
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
                    fontSize: 13,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.target.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}
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
            onMouseEnter={e => e.target.style.opacity = 0.85}
            onMouseLeave={e => e.target.style.opacity = 1}
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  )
}