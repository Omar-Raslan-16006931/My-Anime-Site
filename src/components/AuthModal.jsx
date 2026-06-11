import { useState } from 'react'
import { supabase } from '../supabase'
import Icon from './Icons'

export default function AuthModal({ onClose }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{isLogin ? 'Welcome back' : 'Create account'}</h2>
          <button className="icon-btn" onClick={onClose}><Icon.close width="18" height="18" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isLogin && <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && (
            <p style={{ color: '#ff5763', fontSize: 13, padding: '9px 12px', background: 'var(--accent-soft)', borderRadius: 8 }}>{error}</p>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <p onClick={() => { setIsLogin(!isLogin); setError('') }} style={{ marginTop: 16, textAlign: 'center', color: 'var(--text2)', fontSize: 14, cursor: 'pointer' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span style={{ color: '#ff5763', fontWeight: 700 }}>{isLogin ? 'Sign up' : 'Log in'}</span>
        </p>
      </div>
    </div>
  )
}
