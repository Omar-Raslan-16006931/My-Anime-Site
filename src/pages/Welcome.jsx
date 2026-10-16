import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { usePosterWall } from '../lib/wall'
import { profileActions } from '../lib/profiles'

const GENRES = ['Action', 'Fantasy', 'Sci-Fi', 'Mecha', 'Slice of Life', 'Romance', 'Comedy', 'Crime', 'Thriller', 'Mystery', 'Horror', 'Drama', 'Sports', 'Historical']
const STEPS = ['Account', 'Your taste', 'Setup', 'Ready']
// Free for everyone — the plan only decides how many profiles you set up.
const PLANS = [
  { name: 'Solo', profiles: 1, lines: ['1 profile', 'Watch on any device', 'Simulcasts within the hour'] },
  { name: 'Duo', profiles: 2, lines: ['2 profiles', 'Watch on any device', 'Simulcasts within the hour'] },
  { name: 'Family', profiles: 5, lines: ['Up to 5 profiles', 'Kids profiles', 'Simulcasts within the hour'] },
]
const TASTE_KEY = 'yoru:taste'

const Check = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

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
  const [plan, setPlan] = useState('Duo')

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
  const finish = () => navigate('/profiles')
  const chosen = PLANS.find((p) => p.name === plan) || PLANS[1]

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
          <form className="y-ob-pane lead" onSubmit={createAccount}>
            <h1>Anime and series, the night they air.</h1>
            <p className="y-ob-sub">Create a free account to keep your list and pick up where you left off.</p>
            <div className="y-ob-fields">
              <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              <input type="password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            </div>
            {err && <p className="y-ob-err">{err}</p>}
            <div className="y-ob-go">
              <button type="submit" className="y-btn ac big" disabled={busy}>{busy ? 'Please wait…' : 'Get started →'}</button>
            </div>
            <div className="y-ob-hint">Already a member? <button type="button" onClick={onAuthRequired}>Sign in</button></div>
          </form>
        )}

        {step === 1 && (
          <div className="y-ob-pane">
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
          <div className="y-ob-pane">
            <h1>Set up your profiles</h1>
            <p className="y-ob-sub">Yoru is free. Pick how many people will watch.</p>
            <div className="y-ob-plans">
              {PLANS.map((p) => (
                <button key={p.name} type="button" className={'y-ob-plan' + (plan === p.name ? ' on' : '')} onClick={() => setPlan(p.name)} aria-pressed={plan === p.name}>
                  <div className="top"><b>{p.name}</b><span className="radio"><i /></span></div>
                  <div className="price"><strong>Free</strong></div>
                  <ul>{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="y-ob-pane lead">
            <div className="y-ob-done"><Check /></div>
            <h1>You’re in.</h1>
            <p className="y-ob-sub">
              {needsConfirm ? 'Check your inbox to confirm your email, then sign in. ' : ''}
              {chosen.name} setup{genres.length ? `, picks from ${genres.length} genres` : ''}. Next, set up who’s watching.
            </p>
          </div>
        )}

        <div className="y-ob-actions">
          {step === 1 && <button type="button" className="y-btn ac" disabled={genres.length < 3} onClick={next}>Continue</button>}
          {step === 2 && <button type="button" className="y-btn ac" onClick={next}>Continue</button>}
          {step === 3 && <button type="button" className="y-btn ac" onClick={finish}>Choose your profile →</button>}
          {step > 1 && step < 3 && (
            <button type="button" className="y-btn" onClick={() => setStep((s) => s - 1)}>Back</button>
          )}
        </div>
      </main>
    </div>
  )
}
