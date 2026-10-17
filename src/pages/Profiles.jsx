import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useProfiles, profileActions, vivid, HUES } from '../lib/profiles'
import { usePosterWall } from '../lib/wall'

const Pen = ({ s = 22 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
const Trash = ({ s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
const Plus = ({ s = 44 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>

// "Who's watching?" — pick a profile, or manage (edit / remove / add) the ones on this device.
export default function Profiles({ user, profile }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { profiles, active } = useProfiles()
  const wall = usePosterWall()
  const [manage, setManage] = useState(params.get('manage') === '1')
  const [sheet, setSheet] = useState(null) // { id?, name, hue, kids }
  const [del, setDel] = useState(null) // profile awaiting remove confirmation
  const [leaving, setLeaving] = useState(null) // id animating out
  const [picked, setPicked] = useState(null)
  const [flash, setFlash] = useState(null) // tile that was just edited/created
  const timer = useRef(0)

  const account = profile?.username || user?.email?.split('@')[0] || ''
  useEffect(() => { profileActions.ensure(account || 'Me') }, [account])
  useEffect(() => () => clearTimeout(timer.current), [])

  const choose = (p) => {
    if (manage) { setSheet({ id: p.id, name: p.name, hue: p.hue ?? 0, kids: !!p.kids }); return }
    if (picked) return
    setPicked(p.id)
    profileActions.setActive(p.id)
    timer.current = setTimeout(() => { window.dispatchEvent(new Event('yoru:greet')); navigate('/') }, 460)
  }
  const openNew = () => setSheet({ id: null, name: '', hue: HUES[profiles.length % HUES.length], kids: false })
  const save = (e) => {
    e.preventDefault()
    if (!sheet.name.trim()) return
    let id = sheet.id
    if (id) profileActions.update(id, { name: sheet.name, hue: sheet.hue, kids: sheet.kids })
    else id = profileActions.add2(sheet.name, sheet.kids, sheet.hue)?.id
    setSheet(null)
    setFlash(id)
    setTimeout(() => setFlash(null), 900)
  }
  const confirmRemove = () => {
    const id = del.id
    setDel(null)
    setLeaving(id)
    timer.current = setTimeout(() => { profileActions.remove(id); setLeaving(null) }, 420)
  }

  const row1 = [...wall.posters, ...wall.posters]
  const row2 = [...wall.banners, ...wall.banners, ...wall.banners]
  const canAdd = profiles.length < profileActions.max

  return (
    <div className={'y-who' + (manage ? ' managing' : '') + (picked ? ' leaving-page' : '')}>
      <div className="y-who-wall" aria-hidden="true">
        <div className="y-wall-row" style={{ animation: 'yoMarq 70s linear infinite' }}>
          {row1.map((s, i) => <span key={i} className="p"><img src={s} alt="" /></span>)}
        </div>
        <div className="y-wall-row" style={{ animation: 'yoMarq 90s linear infinite reverse' }}>
          {row2.map((s, i) => <span key={i} className="b"><img src={s} alt="" /></span>)}
        </div>
      </div>
      <div className="y-who-fade" />
      <Link to="/" className="y-who-logo y-brand">Yoru<i>.</i></Link>

      <div className="y-who-head">
        <div className="y-eyebrow ac" style={{ fontWeight: 600 }}>{account ? `Signed in as @${account}` : 'This device'}</div>
        <h1 key={manage ? 'm' : 'w'} className="y-who-title">{manage ? 'Manage profiles' : 'Who’s watching?'}</h1>
        <p key={manage ? 'mh' : 'wh'} className="y-who-hint">{manage ? 'Tap a profile to edit it, or the red bin to remove it.' : 'Pick a profile to continue.'}</p>
      </div>

      <div className={'y-who-row' + (picked ? ' picking' : '')}>
        {profiles.map((p, i) => (
          <div key={p.id} role="button" tabIndex={0} style={{ '--i': i }}
            className={'y-who-p' + (manage ? ' wob' : '') + (active?.id === p.id ? ' cur' : '') + (picked === p.id ? ' picked' : '') + (leaving === p.id ? ' leaving' : '') + (flash === p.id ? ' flash' : '')}
            onClick={() => choose(p)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(p) } }}>
            <span className="tile" key={`${p.hue}-${p.name}`} style={{ background: vivid(p.hue ?? 0) }}>
              <span className="ini">{p.name[0].toUpperCase()}</span>
              {manage && <span className="edit" aria-hidden="true"><Pen /></span>}
              {manage && profiles.length > 1 && (
                <button type="button" className="rm" aria-label={`Remove ${p.name}`} title="Remove" onClick={(e) => { e.stopPropagation(); setDel(p) }}><Trash /></button>
              )}
            </span>
            <span className="nm">{p.name}{p.kids && <em>Kids</em>}</span>
            <span className="sub">{manage ? 'Edit' : active?.id === p.id ? 'Watching now' : ''}</span>
          </div>
        ))}
        {canAdd && (
          <button type="button" className="y-who-p add" style={{ '--i': profiles.length }} onClick={openNew}>
            <span className="tile"><Plus /></span>
            <span className="nm">Add profile</span>
            <span className="sub">{profileActions.max - profiles.length} left</span>
          </button>
        )}
      </div>

      <div className="y-who-foot">
        <button type="button" className={'y-who-manage' + (manage ? ' on' : '')} onClick={() => setManage((v) => !v)}>
          {manage ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>Done</> : <><Pen s={16} />Manage profiles</>}
        </button>
        {!user && <Link to="/welcome" className="y-who-new">New to Yoru? Create an account →</Link>}
      </div>
      <p className="y-who-note">Profiles are saved on this device. Your list and watch history belong to your account.</p>

      {sheet && (
        <div className="y-who-scrim" onClick={() => setSheet(null)}>
          <form className="y-who-sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{sheet.id ? 'Edit profile' : 'New profile'}</h2>
            <div className="y-who-prev" key={sheet.hue} style={{ background: vivid(sheet.hue) }}>{(sheet.name.trim()[0] || '?').toUpperCase()}</div>
            <input autoFocus maxLength={18} placeholder="Profile name" value={sheet.name} onChange={(e) => setSheet({ ...sheet, name: e.target.value })} aria-label="Profile name" />
            <div className="y-who-hues" role="radiogroup" aria-label="Colour">
              {HUES.map((h) => <button key={h} type="button" role="radio" aria-checked={sheet.hue === h} aria-label={`Colour ${h}`} className={sheet.hue === h ? 'on' : ''} style={{ background: vivid(h) }} onClick={() => setSheet({ ...sheet, hue: h })} />)}
            </div>
            <label className="y-who-switch"><span>Kids profile</span><input type="checkbox" checked={sheet.kids} onChange={(e) => setSheet({ ...sheet, kids: e.target.checked })} /><i /></label>
            <div className="y-who-sheet-btns">
              <button type="button" className="btn btn-ghost" onClick={() => setSheet(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!sheet.name.trim()}>{sheet.id ? 'Save' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
      {del && (
        <div className="y-who-scrim" onClick={() => setDel(null)}>
          <div className="y-who-sheet small" onClick={(e) => e.stopPropagation()}>
            <div className="y-who-prev sm" style={{ background: vivid(del.hue ?? 0) }}>{del.name[0].toUpperCase()}</div>
            <h2>Remove {del.name}?</h2>
            <p>This profile is removed from this device. Your list and history stay on your account.</p>
            <div className="y-who-sheet-btns">
              <button type="button" className="btn btn-ghost" onClick={() => setDel(null)}>Keep</button>
              <button type="button" className="btn y-who-danger" onClick={confirmRemove}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
