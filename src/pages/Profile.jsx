import { useState } from 'react'
import { supabase } from '../supabase'

export default function Profile({ user, profile, setProfile }) {
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    if (username.length < 3) {
      setMessage('Username must be at least 3 characters')
      setSaving(false)
      return
    }

    // Check if username taken by someone else
    const { data: existing } = await supabase
      .from('profiles').select('id')
      .eq('username', username.trim())
      .neq('id', user.id)
      .single()

    if (existing) {
      setMessage('Username is already taken')
      setSaving(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ username: username.trim(), bio: bio.trim() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      setMessage(error.message)
    } else {
      setProfile(data)
      setMessage('✅ Profile updated!')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>My Profile</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 32 }}>{user.email}</p>

      {/* Avatar */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%', marginBottom: 32,
        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, fontWeight: 800, color: '#fff'
      }}>
        {(profile?.username || user.email)[0].toUpperCase()}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text2)' }}>
            Username
          </label>
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Your username" />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text2)' }}>
            Bio
          </label>
          <textarea value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            rows={4}
            style={{
              width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text)', borderRadius: 8, padding: '10px 14px',
              fontSize: 14, outline: 'none', resize: 'vertical',
              fontFamily: 'inherit', transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {message && (
          <p style={{
            color: message.startsWith('✅') ? '#22c55e' : 'var(--accent)',
            fontSize: 14, padding: '8px 12px',
            background: message.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(225,29,72,0.1)',
            borderRadius: 6
          }}>
            {message}
          </p>
        )}

        <button type="submit" disabled={saving} style={{
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          color: '#fff', padding: '12px', borderRadius: 8,
          fontWeight: 600, fontSize: 15, opacity: saving ? 0.7 : 1,
          transition: 'opacity 0.2s'
        }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}