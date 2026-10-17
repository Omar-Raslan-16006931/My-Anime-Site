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
  { k: 'continue', label: 'Continue watching', user: true },
  { k: 'list', label: 'My List', user: true },
  { k: 'ai', label: 'AI picks', user: true },
  { k: 'account', label: 'Account', user: true },
  ...(isNative ? [{ k: 'downloads', label: 'Downloads' }] : []),
  { k: 'look', label: 'Appearance' },
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
  const sel = SECTIONS.find((s) => s.k === wanted) || (user ? SECTIONS[0] : SECTIONS[SECTIONS.length - 1])
  const pick = (k) => setParams(k === SECTIONS[0].k ? {} : { s: k }, { replace: true })
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
            <p className="muted" style={{ marginBottom: 16 }}>Pick the colours the whole app uses.</p>
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

      <nav className="me-tabs y-chips scroll" aria-label="Your sections">
        {SECTIONS.map((s) => (
          <button key={s.k} type="button" className={'y-chip' + (sel.k === s.k ? ' on' : '')} aria-current={sel.k === s.k ? 'true' : undefined}
            onClick={(e) => { pick(s.k); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }}>
            {s.label}
          </button>
        ))}
      </nav>

      <section className="me-panel" key={sel.k}>
        <h2 className="me-h">{sel.label}</h2>
        {body()}
      </section>
    </div>
  )
}
