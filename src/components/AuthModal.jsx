import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Icon from './Icons'
import { loginWithPasskey, passkeysSupported } from '../lib/passkeys'
import { usePosterWall } from '../lib/wall'
import { profileActions } from '../lib/profiles'

const friendly = (msg = '') => {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account — try signing in.'
  if (m.includes('rate limit')) return 'Too many tries. Wait a minute and try again.'
  if (m.includes('email not confirmed')) return 'Confirm your email first — check your inbox.'
  return msg || 'Something went wrong. Try again.'
}

// 0-4 password strength: length, mixed case, digit, symbol.
const strength = (p) => [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length
const LABELS = ['Too short', 'Weak', 'Okay', 'Good', 'Strong']

const Eye = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{off && <path d="M4 4l16 16" />}
  </svg>
)
const Tick = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>

function Field({ label, type = 'text', value, onChange, autoComplete, right, status, ...rest }) {
  return (
    <label className={'auth-field' + (value ? ' filled' : '') + (status ? ' ' + status : '')}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " autoComplete={autoComplete} {...rest} />
      <span className="auth-label">{label}</span>
      {right}
    </label>
  )
}

// Sign in / create account / reset password, as one full-screen flow.
export default function AuthModal({ onClose }) {
  const navigate = useNavigate()
  const wall = usePosterWall()
  const [mode, setMode] = useState('in') // in | up | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pkBusy, setPkBusy] = useState(false)
  const [done, setDone] = useState(null) // { title, text, go? }
  const [taken, setTaken] = useState(null) // null | true | false
  const t = useRef(0)
  const [closing, setClosing] = useState(false)
  // Fade out instead of vanishing.
  const close = () => { setClosing(true); clearTimeout(t.current); t.current = setTimeout(onClose, 300) }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') { setClosing(true); t.current = setTimeout(onClose, 300) } }
    // No scrolling on the sign-in / sign-up screen (touch or wheel), except inside the fields themselves.
    const noScroll = (e) => { if (!(e.target instanceof Element && e.target.closest('input'))) e.preventDefault() }
    document.addEventListener('touchmove', noScroll, { passive: false })
    document.addEventListener('wheel', noScroll, { passive: false })
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); document.removeEventListener('touchmove', noScroll); document.removeEventListener('wheel', noScroll); clearTimeout(t.current) }
  }, [onClose])

  // Live username availability while signing up.
  useEffect(() => {
    setTaken(null)
    const name = username.trim()
    if (mode !== 'up' || name.length < 3) return undefined
    const id = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('username').eq('username', name).maybeSingle()
      setTaken(!!data)
    }, 350)
    return () => clearTimeout(id)
  }, [username, mode])

  const switchMode = (m) => { setMode(m); setError(''); setShow(false) }
  const finish = (d) => { setDone(d); t.current = setTimeout(() => { setClosing(true); t.current = setTimeout(() => { onClose(); if (d.go) navigate(d.go) }, 300) }, d.delay || 1000) }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'reset') {
      setBusy(true)
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim())
      setBusy(false)
      if (err) return setError(friendly(err.message))
      return setDone({ title: 'Check your inbox', text: `If ${email.trim()} has an account, a reset link is on its way.`, stay: true })
    }
    if (mode === 'in') {
      setBusy(true)
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setBusy(false)
      if (err) return setError(friendly(err.message))
      return finish({ title: 'Welcome back', text: 'Signed in.' })
    }
    const name = username.trim()
    if (name.length < 3) return setError('Pick a username with at least 3 characters.')
    if (taken) return setError('That username is taken.')
    if (password.length < 6) return setError('Password needs at least 6 characters.')
    setBusy(true)
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password })
    if (err) { setBusy(false); return setError(friendly(err.message)) }
    if (data.user) await supabase.from('profiles').update({ username: name }).eq('id', data.user.id)
    setBusy(false)
    profileActions.ensure(name)
    if (!data.session) return setDone({ title: 'Confirm your email', text: `We sent a link to ${email.trim()}. Open it, then sign in.`, stay: true })
    finish({ title: `Welcome, ${name}`, text: 'Let’s set up your Yoru.', go: '/welcome' })
  }

  const passkey = async () => {
    setError(''); setPkBusy(true)
    try { await loginWithPasskey(); finish({ title: 'Welcome back', text: 'Signed in with your passkey.' }) }
    catch (err) { setError(err?.message || 'Passkey sign-in failed.') }
    setPkBusy(false)
  }

  const s = strength(password)
  const posters = wall.posters.slice(0, 12)

  return (
    <div className={'auth' + (closing ? ' closing' : '')} role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="auth-wall" aria-hidden="true">{posters.map((p, i) => <span key={i} style={{ '--i': i }}><img src={p} alt="" /></span>)}</div>
      <div className="auth-fade" />
      <button type="button" className="auth-x" onClick={close} aria-label="Close"><Icon.close width="18" height="18" /></button>

      <div className="auth-card">
        {done ? (
          <div className="auth-done">
            <span className="auth-check"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
            <h2>{done.title}</h2>
            <p>{done.text}</p>
            {done.stay && <button type="button" className="btn btn-primary" onClick={() => { setDone(null); switchMode('in') }}>Back to sign in</button>}
          </div>
        ) : (
          <>
            <div className="auth-brand">Yoru<i>.</i></div>
            {mode !== 'reset' ? (
              <div className="auth-seg" role="tablist" data-on={mode}>
                <i aria-hidden="true" />
                <button type="button" role="tab" aria-selected={mode === 'in'} onClick={() => switchMode('in')}>Sign in</button>
                <button type="button" role="tab" aria-selected={mode === 'up'} onClick={() => switchMode('up')}>Create account</button>
              </div>
            ) : (
              <button type="button" className="auth-back" onClick={() => switchMode('in')}>← Back</button>
            )}
            <h2 className="auth-h" key={mode}>{mode === 'in' ? 'Welcome back' : mode === 'up' ? 'Start watching' : 'Reset your password'}</h2>
            <p className="auth-p" key={mode + 'p'}>{mode === 'in' ? 'Pick up where you left off.' : mode === 'up' ? 'Free. Your list and history follow you everywhere.' : 'We’ll email you a link to choose a new one.'}</p>

            <form className="auth-form" onSubmit={submit} noValidate={false}>
              {mode === 'up' && (
                <Field label="Username" value={username} onChange={setUsername} autoComplete="username" required minLength={3} maxLength={24}
                  status={taken === true ? 'bad' : taken === false && username.trim().length >= 3 ? 'ok' : ''}
                  right={username.trim().length >= 3 && taken !== null ? <span className={'auth-hint ' + (taken ? 'bad' : 'ok')}>{taken ? 'Taken' : <Tick />}</span> : null} />
              )}
              <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required inputMode="email" />
              {mode !== 'reset' && (
                <Field label="Password" type={show ? 'text' : 'password'} value={password} onChange={setPassword} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6}
                  right={<button type="button" className="auth-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}><Eye off={show} /></button>} />
              )}
              {mode === 'up' && password && (
                <div className="auth-meter" data-s={s}><div><i /><i /><i /><i /></div><span>{LABELS[s]}</span></div>
              )}
              {mode === 'in' && <button type="button" className="auth-forgot" onClick={() => switchMode('reset')}>Forgot password?</button>}

              {error && <p className="auth-err" role="alert" key={error}>{error}</p>}

              <button className="auth-go" type="submit" disabled={busy}>
                {busy ? <span className="auth-spin" /> : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
              </button>
            </form>

            {mode === 'in' && passkeysSupported() && (
              <>
                <div className="auth-or"><span>or</span></div>
                <button type="button" className="auth-pk" onClick={passkey} disabled={pkBusy}>
                  <Icon.key width="16" height="16" />{pkBusy ? 'Waiting for passkey…' : 'Sign in with a passkey'}
                </button>
              </>
            )}
            {mode === 'up' && <p className="auth-fine">You’ll choose your taste, theme and profile next.</p>}
          </>
        )}
      </div>
    </div>
  )
}
