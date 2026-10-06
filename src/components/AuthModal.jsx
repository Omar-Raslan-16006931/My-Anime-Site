import { useState } from 'react'
import { supabase } from '../supabase'
import Icon from './Icons'
import { loginWithPasskey, passkeysSupported } from '../lib/passkeys'

export default function AuthModal({ onClose }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  const handlePasskey = async () => {
    setError(''); setPasskeyLoading(true)
    try {
      // Discoverable credentials: the browser offers whichever passkeys match
      // this site — no email needed.
      await loginWithPasskey()
      onClose()
    } catch (err) {
      setError(err?.message || 'Passkey sign-in failed')
    } finally {
      setPasskeyLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else onClose()
    } else {
      if (username.trim().length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return }
      const { data: existing } = await supabase.from('profiles').select('username').eq('username', username.trim()).single()
      if (existing) { setError('Username is already taken'); setLoading(false); return }
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      if (data.user) await supabase.from('profiles').update({ username: username.trim() }).eq('id', data.user.id)
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{isLogin ? 'Welcome back' : 'Create account'}</h2>
          <button className="icon-btn" onClick={onClose}><Icon.close width="18" height="18" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!isLogin && <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && (
            <p style={{ color: 'var(--accent3)', fontSize: 13 }}>{error}</p>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>

        {isLogin && passkeysSupported() && (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={handlePasskey}
            disabled={passkeyLoading}
            style={{ marginTop: 10 }}
          >
            <Icon.key width="15" height="15" />
            {passkeyLoading ? 'Waiting for passkey…' : 'Use a passkey instead'}
          </button>
        )}

        <p style={{ marginTop: 14, textAlign: 'center', color: 'var(--text3)', fontSize: 13.5 }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError('') }} style={{ color: 'var(--text)', fontWeight: 650, fontSize: 'inherit', padding: '6px 2px' }}>
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
