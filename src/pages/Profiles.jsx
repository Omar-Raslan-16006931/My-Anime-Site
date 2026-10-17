import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useProfiles, profileActions } from '../lib/profiles'
import { glow } from '../lib/theme'
import { usePosterWall } from '../lib/wall'

// "Who's watching?" — pick, add or manage the profiles on this device.
export default function Profiles({ user, profile }) {
  const navigate = useNavigate()
  const { profiles, active } = useProfiles()
  const wall = usePosterWall()
  const [params] = useSearchParams()
  const [manage, setManage] = useState(params.get('manage') === '1')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [kids, setKids] = useState(false)
  const [edit, setEdit] = useState(null) // profile being renamed

  const account = profile?.username || user?.email?.split('@')[0] || ''
  useEffect(() => { profileActions.ensure(account || 'Me') }, [account])

  const choose = (p) => {
    if (manage) { setEdit({ ...p }); return }
    profileActions.setActive(p.id)
    navigate('/')
  }
  const create = (e) => {
    e.preventDefault()
    const p = profileActions.add(name, kids)
    if (p) { setName(''); setKids(false); setAdding(false) }
  }
  const saveEdit = (e) => {
    e.preventDefault()
    profileActions.rename(edit.id, edit.name)
    setEdit(null)
  }

  const row1 = [...wall.posters, ...wall.posters]
  const row2 = [...wall.banners, ...wall.banners, ...wall.banners]

  return (
    <div className="y-who">
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
        <h1>Who’s watching?</h1>
      </div>

      <div className="y-who-row">
        {profiles.map((p) => (
          <div key={p.id} role="button" tabIndex={0} className={'y-who-p' + (manage ? ' wob' : '') + (active?.id === p.id ? ' cur' : '')} onClick={() => choose(p)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(p) } }}>
            <span className="tile" style={{ background: glow(p.hue) }}>
              {p.name[0].toUpperCase()}
              {manage && profiles.length > 1 && (
                <button type="button" className="rm" aria-label={`Remove ${p.name}`} onClick={(e) => { e.stopPropagation(); profileActions.remove(p.id) }}>✕</button>
              )}
            </span>
            <span className="nm">{p.name}{p.kids && <em>Kids</em>}</span>
          </div>
        ))}
        {profiles.length < profileActions.max && (
          <button type="button" className="y-who-p add" onClick={() => setAdding(true)}>
            <span className="tile">+</span>
            <span className="nm" style={{ color: 'var(--y-t4)' }}>Add profile</span>
          </button>
        )}
      </div>

      {adding && (
        <form className="y-who-form" onSubmit={create}>
          <input autoFocus maxLength={18} placeholder="Profile name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Profile name" />
          <label className="y-who-kids"><input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} /> Kids</label>
          <button type="submit" className="y-btn ac" disabled={!name.trim()}>Create</button>
          <button type="button" className="y-btn" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      )}
      {edit && (
        <form className="y-who-form" onSubmit={saveEdit}>
          <input autoFocus maxLength={18} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label="Profile name" />
          <button type="submit" className="y-btn ac" disabled={!edit.name.trim()}>Save</button>
          <button type="button" className="y-btn" onClick={() => setEdit(null)}>Cancel</button>
        </form>
      )}

      <div className="y-who-foot">
        <button type="button" className="y-btn out" style={{ height: 44, borderRadius: 999, fontSize: 14 }} onClick={() => { setManage((v) => !v); setEdit(null) }}>{manage ? 'Done' : 'Manage profiles'}</button>
        {!user && <Link to="/welcome" className="y-who-new">New to Yoru? Create an account →</Link>}
      </div>
      <p className="y-who-note">Profiles are saved on this device. Your list and watch history belong to your account.</p>
    </div>
  )
}
