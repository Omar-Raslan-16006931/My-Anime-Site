import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePosterWall } from '../lib/wall'
import { profileActions, vivid, HUES } from '../lib/profiles'
import ThemePicker from '../components/ThemePreview'
import { toast } from '../lib/toast'

const GENRES = ['Action', 'Fantasy', 'Sci-Fi', 'Mecha', 'Slice of Life', 'Romance', 'Comedy', 'Crime', 'Thriller', 'Mystery', 'Horror', 'Drama', 'Sports', 'Historical']
const STEPS = ['Account', 'Your taste', 'Your look', 'Profile']
const TASTE_KEY = 'yoru:taste'


// Four-step sign-up: account → taste → setup → ready.
export default function Welcome({ user, onAuthRequired }) {
  const navigate = useNavigate()
  const wall = usePosterWall()
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [genres, setGenres] = useState(() => { try { return JSON.parse(localStorage.getItem(TASTE_KEY) || '[]') } catch { return [] } })
  const [pname, setPname] = useState('')
  const [phue, setPhue] = useState(HUES[0])
  const [pkids, setPkids] = useState(false)

  // Already signed in → skip the account step.
  useEffect(() => { if (user && step === 0) setStep(1) }, [user, step])

  const createAccount = async (e) => {
    e.preventDefault()
    setErr('')
    const name = username.trim()
    if (name.length < 3) return setErr('Username must be at least 3 characters')
    if (password.length < 6) return setErr('Password must be at least 6 characters')
    setBusy(true)
    try {
      const { data: existing } = await supabase.from('profiles').select('username').eq('username', name).single()
      if (existing) { setErr('Username is already taken'); setBusy(false); return }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) { setErr(error.message); setBusy(false); return }
      if (data.user) await supabase.from('profiles').update({ username: name }).eq('id', data.user.id)
      setNeedsConfirm(!data.session)
      profileActions.ensure(name)
      setStep(1)
    } catch (ex) {
      setErr(ex?.message || 'Something went wrong. Try again.')
    }
    setBusy(false)
  }

  const toggle = (g) => setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))
  const next = () => {
    if (step === 1) { try { localStorage.setItem(TASTE_KEY, JSON.stringify(genres)) } catch { /* ignore */ } }
    setStep((s) => Math.min(3, s + 1))
  }
  const nameForProfile = (pname || username || 'Me').trim()
  const finish = (e) => {
    e?.preventDefault()
    const base = profileActions.add2(nameForProfile, pkids, phue)
    if (base) profileActions.setActive(base.id)
    toast(`Welcome, ${nameForProfile}`)
    navigate('/')
  }

  const c1 = wall.posters.slice(0, 4)
  const c2 = wall.posters.slice(4, 8)
  const c3 = wall.posters.slice(8, 12)

  return (
    <div className="y-ob">
      <aside className="y-ob-art" aria-hidden="true">
        <div className="y-ob-collage">
          <div>{c1.map((s, i) => <span key={i}><img src={s} alt="" /></span>)}</div>
          <div style={{ marginTop: -140 }}>{c2.map((s, i) => <span key={i}><img src={s} alt="" /></span>)}</div>
          <div style={{ marginTop: -60 }}>{c3.map((s, i) => <span key={i}><img src={s} alt="" /></span>)}</div>
        </div>
        <div className="y-ob-fade" />
        <div className="y-ob-brand">
          <Link to="/" className="y-brand">Yoru<i>.</i></Link>
          <p>Anime, movies and series in one place. New episodes from Japan within an hour of broadcast.</p>
        </div>
      </aside>

      <main className="y-ob-main">
        <div className="y-ob-steps">
          <ol>
            {STEPS.map((l, i) => (
              <li key={l} className={i <= step ? 'on' : ''}><span>{i + 1}</span>{l}</li>
            ))}
          </ol>
          <div className="y-ob-bar"><i style={{ width: (step / 3) * 100 + '%' }} /></div>
        </div>

        {step === 0 && (
          <form key="s0" className="y-ob-pane lead" onSubmit={createAccount}>
            <h1>Anime and series, the night they air.</h1>
            <p className="y-ob-sub">Create a free account to keep your list and pick up where you left off.</p>
            <div className="y-ob-fields">
              <label className={'auth-field' + (username ? ' filled' : '')}><input placeholder=" " value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /><span className="auth-label">Username</span></label>
              <label className={'auth-field' + (email ? ' filled' : '')}><input type="email" placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /><span className="auth-label">Email</span></label>
              <label className={'auth-field' + (password ? ' filled' : '')}><input type="password" placeholder=" " value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={6} /><span className="auth-label">Password (6+ characters)</span></label>
            </div>
            {err && <p className="y-ob-err">{err}</p>}
            <div className="y-ob-go">
              <button type="submit" className="y-btn ac big" disabled={busy}>{busy ? 'Please wait…' : 'Get started →'}</button>
            </div>
            <div className="y-ob-hint">Already a member? <button type="button" onClick={onAuthRequired}>Sign in</button></div>
          </form>
        )}

        {step === 1 && (
          <div key="s1" className="y-ob-pane">
            <h1>What do you like to watch?</h1>
            <p className="y-ob-sub">Pick at least three. We’ll use them to tune your picks. · <b>{genres.length} selected</b></p>
            <div className="y-ob-genres">
              {GENRES.map((g) => (
                <button key={g} type="button" className={'y-ob-g' + (genres.includes(g) ? ' on' : '')} onClick={() => toggle(g)} aria-pressed={genres.includes(g)}>{g}</button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div key="s2" className="y-ob-pane">
            <h1>Choose your look</h1>
            <p className="y-ob-sub">Pick the colours Yoru uses. Tap one to see the whole app change.</p>
            <ThemePicker instant />
          </div>
        )}

        {step === 3 && (
          <form key="s3" className="y-ob-pane lead" onSubmit={finish}>
            <h1>Who’s watching?</h1>
            <p className="y-ob-sub">{needsConfirm ? 'Check your inbox to confirm your email, then sign in. ' : ''}Make your first profile. You can add more later.</p>
            <div className="y-ob-prof">
              <div className="y-who-prev" style={{ background: vivid(phue) }}>{(nameForProfile[0] || '?').toUpperCase()}</div>
              <input maxLength={18} placeholder={username || 'Profile name'} value={pname} onChange={(e) => setPname(e.target.value)} aria-label="Profile name" />
              <div className="y-who-hues" role="radiogroup" aria-label="Colour">
                {HUES.map((h) => <button key={h} type="button" role="radio" aria-checked={phue === h} aria-label={`Colour ${h}`} className={phue === h ? 'on' : ''} style={{ background: vivid(h) }} onClick={() => setPhue(h)} />)}
              </div>
              <label className="y-who-switch"><span>Kids profile</span><input type="checkbox" checked={pkids} onChange={(e) => setPkids(e.target.checked)} /><i /></label>
            </div>
          </form>
        )}

        <div className="y-ob-actions">
          {step === 1 && <button type="button" className="y-btn ac" disabled={genres.length < 3} onClick={next}>Continue</button>}
          {step === 2 && <button type="button" className="y-btn ac" onClick={next}>Continue</button>}
          {step === 3 && <button type="button" className="y-btn ac" onClick={finish}>Start watching →</button>}
          {step > 1 && <button type="button" className="y-btn" onClick={() => setStep((s) => s - 1)}>Back</button>}
        </div>
      </main>
    </div>
  )
}
