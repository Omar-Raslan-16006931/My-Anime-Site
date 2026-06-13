import { useState, useRef } from 'react'
import { supabase } from '../supabase'

export default function Profile({ user, profile, setProfile }) {
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef(null)

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

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMessage('Please choose an image file'); return }
    if (file.size > 5 * 1024 * 1024) { setMessage('Image must be under 5 MB'); return }

    setUploading(true); setMessage('')
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${user.id}/avatar.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' })
    if (upErr) { setMessage(upErr.message); setUploading(false); return }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-bust so the new image shows immediately after re-upload.
    const url = `${pub.publicUrl}?t=${Date.now()}`

    const { data, error } = await supabase.from('profiles')
      .update({ avatar_url: url }).eq('id', user.id).select().single()
    if (error) setMessage(error.message)
    else { setProfile(data); setMessage('✅ Profile picture updated!') }
    setUploading(false)
  }

  const ok = message.startsWith('✅')
  const initial = (profile?.username || user.email)[0].toUpperCase()

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <h1 className="section-title" style={{ marginBottom: 6 }}>My Profile</h1>
      <p className="muted" style={{ marginBottom: 26 }}>{user.email}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 26 }}>
        <div className="avatar" style={{ width: 84, height: 84, fontSize: 34, borderRadius: 18 }}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}
        </div>
        <div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : profile?.avatar_url ? 'Change picture' : 'Upload picture'}
          </button>
          <p className="muted" style={{ fontSize: 12, marginTop: 7 }}>JPG, PNG, GIF or WebP — max 5 MB</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleAvatar}
          style={{ display: 'none' }}
        />
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
