import { useState } from 'react'
import { supabase } from '../supabase'

export default function AuthModal({ onClose }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else onClose()
    } else {
      if (!username.trim()) { setError('Username is required'); setLoading(false); return }
      if (username.length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return }

      const { data: existing } = await supabase
        .from('profiles').select('username')
        .eq('username', username.trim()).single()
      if (existing) { setError('Username is already taken'); setLoading(false); return }

      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }

      if (data.user) {
        await supabase.from('profiles')
          .update({ username: username.trim() })
          .eq('id', data.user.id)
      }
      onClose()
    }
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{isLogin ? 'Welcome back' : 'Create account'}</h2>
          <button onClick={onClose} style={{
            background: 'var(--bg3)', color: 'var(--text2)',
            width: 32, height: 32, borderRadius: '50%', fontSize: 18
          }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isLogin && (
            <input placeholder="Username" value={username}
              onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required />

          {error && (
            <p style={{ color: 'var(--accent)', fontSize: 13, padding: '8px 12px', background: 'rgba(225,29,72,0.1)', borderRadius: 6 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 8,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff', padding: '12px', borderRadius: 8,
            fontWeight: 600, fontSize: 15, opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.2s'
          }}>
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <p onClick={() => { setIsLogin(!isLogin); setError('') }} style={{
          marginTop: 16, textAlign: 'center', color: 'var(--text2)',
          fontSize: 14, cursor: 'pointer'
        }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  )
}