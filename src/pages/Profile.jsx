import { useState } from 'react'
import { supabase } from '../supabase'

export default function Profile({ user, profile, setProfile }) {
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setMessage('')

    if (username.trim().length < 3) { setMessage('Username must be at least 3 characters'); setSaving(false); return }

    const { data: existing } = await supabase.from('profiles').select('id').eq('username', username.trim()).neq('id', user.id).single()
    if (existing) { setMessage('Username is already taken'); setSaving(false); return }

    const { data, error } = await supabase.from('profiles')
      .update({ username: username.trim(), bio: bio.trim() }).eq('id', user.id).select().single()
    if (error) setMessage(error.message)
    else { setProfile(data); setMessage('✅ Profile updated!') }
    setSaving(false)
  }

  const ok = message.startsWith('✅')

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <h1 className="section-title" style={{ marginBottom: 6 }}>My Profile</h1>
      <p className="muted" style={{ marginBottom: 26 }}>{user.email}</p>

      <div className="avatar" style={{ width: 84, height: 84, fontSize: 34, marginBottom: 26 }}>
        {(profile?.username || user.email)[0].toUpperCase()}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 7, fontSize: 13, color: 'var(--text2)' }}>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 7, fontSize: 13, color: 'var(--text2)' }}>Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell us about yourself…" style={{ resize: 'vertical' }} />
        </div>

        {message && (
          <p style={{ color: ok ? '#22c55e' : '#ff5763', fontSize: 14, padding: '9px 12px', background: ok ? 'rgba(34,197,94,0.1)' : 'var(--accent-soft)', borderRadius: 8 }}>{message}</p>
        )}

        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </form>
    </div>
  )
}
