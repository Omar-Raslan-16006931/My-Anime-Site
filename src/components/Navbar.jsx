import { useState } from 'react'
import { supabase } from '../supabase'

export default function Navbar({ user, profile, onAuthClick, currentPage, setCurrentPage }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      <div onClick={() => setCurrentPage('home')} style={{
        fontWeight: 800, fontSize: 22, cursor: 'pointer',
        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
      }}>
        Gojo3mk
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {['home', 'watchlist'].map(page => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            style={{
              background: currentPage === page ? 'var(--bg3)' : 'transparent',
              color: currentPage === page ? 'var(--text)' : 'var(--text2)',
              padding: '8px 16px',
              borderRadius: 8,
              fontWeight: currentPage === page ? 600 : 400,
              fontSize: 14,
              transition: 'all 0.2s',
              textTransform: 'capitalize'
            }}
          >
            {page}
          </button>
        ))}

        {user ? (
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 16,
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
                top: 48,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 8,
                minWidth: 180,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}>
                <div style={{
                  padding: '8px 12px',
                  color: 'var(--text2)',
                  fontSize: 13,
                  borderBottom: '1px solid var(--border)',
                  marginBottom: 4
                }}>
                  @{profile?.username || user.email}
                </div>

                <button
                  onClick={() => { setCurrentPage('profile'); setMenuOpen(false) }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 14,
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
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 14,
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
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--accent)',
                    fontSize: 14,
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
              padding: '8px 20px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              transition: 'opacity 0.2s'
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