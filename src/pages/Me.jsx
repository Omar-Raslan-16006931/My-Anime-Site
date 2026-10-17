import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { udb } from '../lib/udb'
import { isNative } from '../lib/native'
import { SCHEMES, SCHEME_NAMES, setScheme, useScheme } from '../lib/theme'
import { useProfiles, profileActions } from '../lib/profiles'
import CurrentlyWatching from './CurrentlyWatching'
import Watchlist from './Watchlist'
import Profile from './Profile'
import Downloads from './Downloads'

// One page for everything behind the profile picture. The landing view is a
// "My Yoru" overview (profile header, previews of Continue watching and My List,
// settings list); each section opens in place with ?s=<key> and a back button.
const ico = (d) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const Chevron = () => <svg className="acc-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>

const SECTIONS = [
  { k: 'continue', label: 'Continue watching', user: true },
  { k: 'list', label: 'My List', user: true },
  { k: 'account', label: 'Account info', user: true, top: true, icon: ico(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>) },
  ...(isNative ? [{ k: 'downloads', label: 'Downloads', sub: 'Watch offline', icon: ico(<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />) }] : []),
  { k: 'look', label: 'Appearance', sub: 'Colour theme', icon: ico(<><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18z" /></>) },
]

// Bold per-profile avatar colour (independent of the muted theme palette).
const vivid = (h) => `linear-gradient(145deg, oklch(0.74 0.15 ${h}), oklch(0.56 0.17 ${(h + 40) % 360}))`

const hrefOf = (i) => (i.media_type === 'tv' && i.tmdb_id ? `/tv/${i.tmdb_id}` : i.media_type === 'movie' && i.tmdb_id ? `/movie/${i.tmdb_id}` : i.mal_id ? `/anime/${i.mal_id}` : '/')
const metaOf = (i) => (i.media_type === 'tv' ? `S${i.season_number || 1} · E${i.last_episode || 1}` : i.media_type === 'movie' ? 'Movie' : `Episode ${i.last_episode || 1}`)
const fracOf = (i) => (i.total_episodes && i.last_episode ? Math.min(1, i.last_episode / i.total_episodes) : 0.06)

export default function Me({ user, profile, setProfile, onAuthRequired, onAuthClick }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const scheme = useScheme()
  const { profiles, active } = useProfiles()
  const me = active || profiles[0]
  const account = profile?.username || user?.email?.split('@')[0] || ''
  const initial = (me?.name || account || 'G')[0].toUpperCase()
  const signIn = onAuthClick || onAuthRequired

  const sel = SECTIONS.find((s) => s.k === params.get('s')) || null
  const pick = (k) => setParams(k ? { s: k } : {})
  const logout = async () => { await supabase.auth.signOut(); navigate('/') }

  // Previews for the overview (first 12 of each).
  const [lookOpen, setLookOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKids, setNewKids] = useState(false)
  const [cw, setCw] = useState(null)
  const [list, setList] = useState(null)
  useEffect(() => {
    if (!user || sel) return undefined
    let on = true
    Promise.all([
      udb.from('currently_watching').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(12),
      udb.from('currently_watching_tmdb').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(12),
      udb.from('watchlist').select('*').eq('user_id', user.id).order('added_at', { ascending: false }).limit(12),
    ]).then(([a, t, w]) => {
      if (!on) return
      setCw([...(a.data || []), ...(t.data || [])].filter((i) => !i.is_completed).sort((x, y) => new Date(y.updated_at) - new Date(x.updated_at)).slice(0, 12))
      setList(w.data || [])
    }).catch(() => { if (on) { setCw([]); setList([]) } })
    return () => { on = false }
  }, [user, sel])

  /* ---------------- One section, opened in place ---------------- */
  if (sel) {
    let body
    if (sel.user && !user) {
      body = (
        <div className="acc-gate">
          <p>Sign in to see your {sel.label.toLowerCase()}.</p>
          <button type="button" className="btn btn-primary" onClick={signIn}>Sign in</button>
        </div>
      )
    } else if (sel.k === 'continue') body = <CurrentlyWatching user={user} onAuthRequired={onAuthRequired} />
    else if (sel.k === 'list') body = <Watchlist user={user} onAuthRequired={onAuthRequired} />
    else if (sel.k === 'account') body = <Profile user={user} profile={profile} setProfile={setProfile} />
    else if (sel.k === 'downloads') body = <Downloads />
    else {
      body = (
        <div className="me-swatches">
          {SCHEME_NAMES.map((k) => (
            <button key={k} type="button" className={'me-swatch' + (scheme === k ? ' on' : '')} aria-pressed={scheme === k} onClick={() => setScheme(k)}>
              <span className="me-swatch-chips"><i style={{ background: SCHEMES[k].bg }} /><i style={{ background: SCHEMES[k].s2 }} /><i style={{ background: SCHEMES[k].ac }} /></span>
              <b>{k}</b>
            </button>
          ))}
        </div>
      )
    }
    return (
      <div className="me-page">
        <section className="me-panel" key={sel.k}>
          <div className="me-bar">
            <button type="button" className="me-back" onClick={() => pick(null)} aria-label="Back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
            </button>
            <h2 className="me-h">{sel.label}</h2>
          </div>
          {body}
        </section>
      </div>
    )
  }

  /* ---------------- Overview ---------------- */
  const create = (e) => {
    e.preventDefault()
    const p = profileActions.add(newName, newKids)
    if (p) { setNewName(''); setNewKids(false); setAdding(false) }
  }

  return (
    <div className="me-page acc">
      <div className="acc-glow" style={{ '--h1': `oklch(0.6 0.16 ${me?.hue || 0})` }} aria-hidden="true" />

      <header className="acc-hero">
        <div className="acc-avatar-wrap">
          <button type="button" className="acc-avatar" style={{ background: vivid(me?.hue || 0) }} onClick={() => navigate('/profiles')} aria-label="Switch profile">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}
          </button>
          <button type="button" className="acc-pen" onClick={() => navigate('/profiles?manage=1')} aria-label="Manage profiles" title="Manage profiles">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
          </button>
        </div>
        <div className="acc-id">
          <h1 className="acc-name">{me?.name || 'Guest'}</h1>
          <span className="acc-handle">{user ? `@${account}` : 'Browsing as a guest'}</span>
          <div className="acc-btns">
            {user && <button type="button" className="acc-info" onClick={() => pick('account')}>Account info</button>}
            {profiles.length < profileActions.max && (
              <button type="button" className={'acc-info icon' + (adding ? ' on' : '')} onClick={() => setAdding((v) => !v)} aria-expanded={adding} aria-label="Add profile" title="Add profile">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            )}
          </div>
        </div>
        {user && (
          <button type="button" className="acc-out" onClick={logout} aria-label="Sign out" title="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></svg>
          </button>
        )}
      </header>
      {adding && (
        <form className="acc-add" onSubmit={create}>
          <input autoFocus maxLength={18} placeholder="New profile name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New profile name" />
          <label><input type="checkbox" checked={newKids} onChange={(e) => setNewKids(e.target.checked)} /> Kids</label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!newName.trim()}>Add</button>
        </form>
      )}

      {!user ? (
        <div className="acc-cta">
          <div>
            <b>Your list, everywhere</b>
            <p>Sign in to save titles, pick up where you left off and get AI picks.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={signIn}>Sign in</button>
        </div>
      ) : (
        <>
          <Shelf title="Continue watching" count={cw?.length} onMore={() => pick('continue')} loading={!cw} empty="Nothing in progress yet.">
            {(cw || []).map((i) => (
              <Link key={`${i.id}-${i.tmdb_id || i.mal_id}`} to={hrefOf(i)} className="acc-tile">
                <span className="acc-tile-art">
                  {i.poster && <img src={i.poster} alt="" loading="lazy" />}
                  <span className="acc-tile-play"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span>
                  <span className="acc-tile-bar"><i style={{ width: `${Math.round(fracOf(i) * 100)}%` }} /></span>
                </span>
                <b>{i.title}</b>
                <small>{metaOf(i)}</small>
              </Link>
            ))}
          </Shelf>

          <Shelf title="My List" count={list?.length} onMore={() => pick('list')} loading={!list} empty="Tap + on any title to save it here.">
            {(list || []).map((i) => (
              <Link key={i.id || `${i.media_type}-${i.tmdb_id || i.mal_id}`} to={hrefOf(i)} className="acc-tile">
                <span className="acc-tile-art">{i.poster && <img src={i.poster} alt="" loading="lazy" />}</span>
                <b>{i.title}</b>
              </Link>
            ))}
          </Shelf>
        </>
      )}

      <div className="acc-group">
        {isNative && (
          <button type="button" className="acc-item" onClick={() => pick('downloads')}>
            <span className="acc-ico">{SECTIONS.find((x) => x.k === 'downloads').icon}</span>
            <span className="acc-txt"><b>Downloads</b><small>Watch offline</small></span>
            <Chevron />
          </button>
        )}
        <button type="button" className={'acc-item' + (lookOpen ? ' open' : '')} onClick={() => setLookOpen((v) => !v)} aria-expanded={lookOpen}>
          <span className="acc-ico">{SECTIONS.find((x) => x.k === 'look').icon}</span>
          <span className="acc-txt"><b>Appearance</b><small>{scheme}</small></span>
          <Chevron />
        </button>
        <div className={'acc-expand' + (lookOpen ? ' open' : '')}>
          <div>
            <div className="me-swatches acc-swatches">
              {SCHEME_NAMES.map((k) => (
                <button key={k} type="button" className={'me-swatch' + (scheme === k ? ' on' : '')} aria-pressed={scheme === k} onClick={() => setScheme(k)}>
                  <span className="me-swatch-chips"><i style={{ background: SCHEMES[k].bg }} /><i style={{ background: SCHEMES[k].s2 }} /><i style={{ background: SCHEMES[k].ac }} /></span>
                  <b>{k}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Shelf({ title, count, onMore, loading, empty, children }) {
  return (
    <section className="acc-shelf">
      <button type="button" className="acc-shelf-head" onClick={onMore}>
        <h2>{title}</h2>
        {count ? <span className="acc-count">{count}</span> : null}
        <span className="acc-see">See all<Chevron /></span>
      </button>
      {loading ? (
        <div className="acc-track">{Array.from({ length: 4 }).map((_, i) => <span key={i} className="acc-tile"><span className="acc-tile-art y-skel" /></span>)}</div>
      ) : count ? (
        <div className="acc-track">{children}</div>
      ) : (
        <p className="acc-empty">{empty}</p>
      )}
    </section>
  )
}
