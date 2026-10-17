import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useProfiles, profileActions, vivid, HUES } from '../lib/profiles'
import { usePosterWall } from '../lib/wall'
import { useFlip } from '../lib/flip'

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
  const [wobbling, setWobbling] = useState(params.get('manage') === '1')
  const [fresh, setFresh] = useState(null) // tile that was just created
  const [settled, setSettled] = useState(false) // initial staggered entrance is over
  const [rev, setRev] = useState({}) // bumps when a profile is edited so its tile always replays its pop
  const settleTimer = useRef(0)
  const [sheet, setSheet] = useState(null) // { id?, name, hue, kids }
  const [del, setDel] = useState(null) // profile awaiting remove confirmation
  const [leaving, setLeaving] = useState(null) // id animating out
  const [picked, setPicked] = useState(null)
  const [closing, setClosing] = useState(false)
  const [flash, setFlash] = useState(null) // tile that was just edited/created
  const timer = useRef(0)
  const rowRef = useRef(null)
  useFlip(rowRef, profiles) // neighbours glide to their new slots when a profile is removed or added

  const account = profile?.username || user?.email?.split('@')[0] || ''
  useEffect(() => { profileActions.ensure(account || 'Me') }, [account])
  useEffect(() => { const t = setTimeout(() => setSettled(true), 1700); return () => { clearTimeout(t); clearTimeout(timer.current) } }, [])

  const choose = (p, e) => {
    if (manage) { setSheet({ id: p.id, name: p.name, hue: p.hue ?? 0, kids: !!p.kids }); return }
    if (picked) return
    // Hand the tile to the welcome overlay, which flies it to the centre while this page fades away.
    const tile = e?.currentTarget?.querySelector('.tile')
    let fly = null
    if (tile) {
      const r = tile.getBoundingClientRect()
      const cs = getComputedStyle(tile)
      fly = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: tile.offsetWidth, radius: cs.borderTopLeftRadius, font: cs.fontSize, shadow: cs.boxShadow }
    }
    setPicked(p.id)
    profileActions.setActive(p.id)
    window.dispatchEvent(new CustomEvent('yoru:greet', { detail: { profile: p, fly } }))
    timer.current = setTimeout(() => navigate('/'), 1000)
  }
  // Dialogs fade and drop away before they unmount.
  const closeDialogs = (after) => {
    setClosing(true)
    timer.current = setTimeout(() => { setSheet(null); setDel(null); setClosing(false); after?.() }, 280)
  }
  // Entering manage mode starts the wobble; leaving it lets each tile settle back smoothly instead of snapping.
  const toggleManage = () => {
    if (!manage) {
      // cancel a pending "stop wobbling" from a quick Done, and clear any leftover inline settle styles
      clearTimeout(settleTimer.current)
      rowRef.current?.querySelectorAll('.wob-wrap').forEach((el) => { el.style.animation = ''; el.style.transition = ''; el.style.transform = '' })
      setManage(true); setWobbling(true); return
    }
    const row = rowRef.current
    const els = row ? [...row.querySelectorAll('.wob-wrap')] : []
    els.forEach((el) => { const t = getComputedStyle(el).transform; el.style.animation = 'none'; el.style.transform = t })
    if (row) void row.offsetWidth
    els.forEach((el) => { el.style.transition = 'transform 0.7s cubic-bezier(0.34, 1.4, 0.64, 1)'; el.style.transform = 'none' })
    setManage(false)
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      setWobbling(false)
      els.forEach((el) => { el.style.animation = ''; el.style.transition = ''; el.style.transform = '' })
    }, 760)
  }
  const openNew = () => setSheet({ id: null, name: '', hue: HUES[profiles.length % HUES.length], kids: false })
  const save = (e) => {
    e.preventDefault()
    if (!sheet.name.trim()) return
    const snap = sheet
    // Apply once, after the dialog has faded, so the tile animates exactly one time.
    closeDialogs(() => {
      if (snap.id) {
        profileActions.update(snap.id, { name: snap.name, hue: snap.hue, kids: snap.kids })
        setRev((r) => ({ ...r, [snap.id]: (r[snap.id] || 0) + 1 }))
        setFlash(snap.id); setTimeout(() => setFlash(null), 900)
      } else {
        const np = profileActions.add(snap.name, snap.kids, snap.hue)
        if (np) { setFresh(np.id); setTimeout(() => setFresh(null), 900) }
      }
    })
  }
  const confirmRemove = () => {
    const id = del.id
    closeDialogs(() => {
      setLeaving(id)
      timer.current = setTimeout(() => { profileActions.remove(id); setLeaving(null) }, 440)
    })
  }

  const row1 = [...wall.posters, ...wall.posters]
  const row2 = [...wall.banners, ...wall.banners, ...wall.banners]
  const canAdd = profiles.length < profileActions.max

  return (
    <div className={'y-who' + (manage ? ' managing' : '') + (picked ? ' leaving-page' : '') + (settled ? ' settled' : '')}>
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
        <h1 className="y-who-title swap"><span className="a">Who’s watching?</span><span className="b" aria-hidden={!manage}>Manage profiles</span></h1>
        <p className="y-who-hint swap"><span className="a">Pick a profile to continue.</span><span className="b" aria-hidden={!manage}>Tap a profile to edit it, or the red bin to remove it.</span></p>
      </div>

      <div ref={rowRef} className={'y-who-row' + (picked ? ' picking' : '')}>
        {profiles.map((p, i) => (
          <div key={p.id} data-flip={p.id} role="button" tabIndex={0} style={{ '--i': i }}
            className={'y-who-p' + (wobbling ? ' wob' : '') + (active?.id === p.id ? ' cur' : '') + (picked === p.id ? ' picked' : '') + (leaving === p.id ? ' leaving' : '') + (flash === p.id ? ' flash' : '') + (fresh === p.id ? ' fresh' : '')}
            onClick={(e) => choose(p, e)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(p, { currentTarget: e.currentTarget }) } }}>
            <span className="wob-wrap">
              <span className="tile" key={`${p.hue}-${p.name}-${rev[p.id] || 0}`} style={{ background: vivid(p.hue ?? 0) }}>
                <span className="ini">{p.name[0].toUpperCase()}</span>
                <span className="edit" aria-hidden="true"><Pen /></span>
                {profiles.length > 1 && (
                  <button type="button" className="rm" tabIndex={manage ? 0 : -1} aria-hidden={!manage} aria-label={`Remove ${p.name}`} title="Remove" onClick={(e) => { e.stopPropagation(); if (manage) setDel(p) }}><Trash /></button>
                )}
              </span>
              <span className="nm">{p.name}{p.kids && <em>Kids</em>}</span>
              <span className="sub"><b className="s-now">Watching now</b><b className="s-edit">Edit</b></span>
            </span>
          </div>
        ))}
        {canAdd && (
          <button type="button" data-flip="add" className="y-who-p add" style={{ '--i': profiles.length }} onClick={openNew}>
            <span className="wob-wrap">
              <span className="tile"><Plus /></span>
              <span className="nm">Add profile</span>
              <span className="sub"><b className="s-left">{profileActions.max - profiles.length} left</b></span>
            </span>
          </button>
        )}
      </div>

      <div className="y-who-foot">
        <button type="button" className={'y-who-manage' + (manage ? ' on' : '')} onClick={toggleManage}>
          <span className="m-a"><Pen s={16} />Manage profiles</span>
          <span className="m-b" aria-hidden={!manage}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>Done</span>
        </button>
        {!user && <Link to="/welcome" className="y-who-new">New to Yoru? Create an account →</Link>}
      </div>
      <p className="y-who-note">Profiles are saved on this device. Your list and watch history belong to your account.</p>

      {sheet && (
        <div className={'y-who-scrim' + (closing ? ' closing' : '')} onClick={() => closeDialogs()}>
          <form className="y-who-sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{sheet.id ? 'Edit profile' : 'New profile'}</h2>
            <div className="y-who-prev" key={sheet.hue} style={{ background: vivid(sheet.hue) }}>{(sheet.name.trim()[0] || '?').toUpperCase()}</div>
            <input autoFocus maxLength={18} placeholder="Profile name" value={sheet.name} onChange={(e) => setSheet({ ...sheet, name: e.target.value })} aria-label="Profile name" />
            <div className="y-who-hues" role="radiogroup" aria-label="Colour">
              {HUES.map((h) => <button key={h} type="button" role="radio" aria-checked={sheet.hue === h} aria-label={`Colour ${h}`} className={sheet.hue === h ? 'on' : ''} style={{ background: vivid(h) }} onClick={() => setSheet({ ...sheet, hue: h })} />)}
            </div>
            <label className="y-who-switch"><span>Kids profile</span><input type="checkbox" checked={sheet.kids} onChange={(e) => setSheet({ ...sheet, kids: e.target.checked })} /><i /></label>
            <div className="y-who-sheet-btns">
              <button type="button" className="btn btn-ghost" onClick={() => closeDialogs()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!sheet.name.trim()}>{sheet.id ? 'Save' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
      {del && (
        <div className={'y-who-scrim' + (closing ? ' closing' : '')} onClick={() => closeDialogs()}>
          <div className="y-who-sheet small" onClick={(e) => e.stopPropagation()}>
            <div className="y-who-prev sm" style={{ background: vivid(del.hue ?? 0) }}>{del.name[0].toUpperCase()}</div>
            <h2>Remove {del.name}?</h2>
            <p>This profile is removed from this device. Your list and history stay on your account.</p>
            <div className="y-who-sheet-btns">
              <button type="button" className="btn btn-ghost" onClick={() => closeDialogs()}>Keep</button>
              <button type="button" className="btn y-who-danger" onClick={confirmRemove}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
