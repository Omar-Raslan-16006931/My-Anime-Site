import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { isNative } from '../lib/native'
import { SCHEMES, SCHEME_NAMES, setScheme, useScheme, glow } from '../lib/theme'
import { useProfiles } from '../lib/profiles'
import CurrentlyWatching from './CurrentlyWatching'
import Watchlist from './Watchlist'
import Recommend from './Recommend'
import Profile from './Profile'
import Downloads from './Downloads'

// One page for everything behind the profile picture. Sections switch in place
// (?s=continue | list | ai | account | downloads | look).
const SECTIONS = [
  { k: 'continue', label: 'Continue watching', sub: 'Pick up where you left off', user: true, icon: <path d="M8 5v14l11-7z" /> },
  { k: 'list', label: 'My List', sub: 'Titles you saved', user: true, icon: <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z" /> },
  { k: 'ai', label: 'AI picks', sub: 'Tell it your mood', user: true, icon: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /> },
  { k: 'account', label: 'Account', sub: 'Profile, passkeys, privacy', user: true, icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
  ...(isNative ? [{ k: 'downloads', label: 'Downloads', sub: 'Watch offline', icon: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /> }] : []),
  { k: 'look', label: 'Appearance', sub: 'Colour theme', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18z" /></> },
]

export default function Me({ user, profile, setProfile, onAuthRequired, onAuthClick }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const scheme = useScheme()
  const { profiles, active } = useProfiles()
  const me = active || profiles[0]
  const account = profile?.username || user?.email?.split('@')[0] || ''
  const initial = (me?.name || account || 'G')[0].toUpperCase()

  const wanted = params.get('s')
  const sel = SECTIONS.find((s) => s.k === wanted) || null
  const pick = (k) => setParams(k ? { s: k } : {})
  const logout = async () => { await supabase.auth.signOut(); navigate('/') }

  const body = () => {
    if (sel.user && !user) {
      return (
        <div className="empty">
          <div className="emoji">🔒</div>
          <p>Sign in to see your {sel.label.toLowerCase()}.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} onClick={onAuthClick || onAuthRequired}>Sign in</button>
        </div>
      )
    }
    switch (sel.k) {
      case 'continue': return <CurrentlyWatching user={user} onAuthRequired={onAuthRequired} />
      case 'list': return <Watchlist user={user} onAuthRequired={onAuthRequired} />
      case 'ai': return <Recommend user={user} onAuthRequired={onAuthRequired} />
      case 'account': return <Profile user={user} profile={profile} setProfile={setProfile} />
      case 'downloads': return <Downloads />
      default:
        return (
          <div className="me-look">
            <div className="me-swatches">
              {SCHEME_NAMES.map((k) => (
                <button key={k} type="button" className={'me-swatch' + (scheme === k ? ' on' : '')} aria-pressed={scheme === k} onClick={() => setScheme(k)}>
                  <span className="me-swatch-chips"><i style={{ background: SCHEMES[k].bg }} /><i style={{ background: SCHEMES[k].s2 }} /><i style={{ background: SCHEMES[k].ac }} /></span>
                  <b>{k}</b>
                </button>
              ))}
            </div>
          </div>
        )
    }
  }

  return (
    <div className="me-page">
      <header className="me-head">
        <span className="me-avatar" style={{ background: glow(me?.hue || 0) }}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}
        </span>
        <div className="me-who">
          <h1>{me?.name || 'Guest'}</h1>
          <span>{user ? `@${account}` : 'Not signed in'}</span>
        </div>
        <div className="me-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/profiles')}>Switch profile</button>
          {user
            ? <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
            : <button type="button" className="btn btn-primary btn-sm" onClick={onAuthClick || onAuthRequired}>Sign in</button>}
        </div>
      </header>

      {sel ? (
        <section className="me-panel" key={sel.k}>
          <div className="me-bar">
            <button type="button" className="me-back" onClick={() => pick(null)} aria-label="Back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
            </button>
            <h2 className="me-h">{sel.label}</h2>
          </div>
          {body()}
        </section>
      ) : (
        <nav className="me-rows" aria-label="Your sections" key="menu">
          {SECTIONS.map((r) => (
            <button key={r.k} type="button" className="me-row" onClick={() => pick(r.k)}>
              <span className="me-row-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{r.icon}</svg></span>
              <span className="me-row-txt"><b>{r.label}</b><small>{r.sub}</small></span>
              <svg className="me-row-go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
