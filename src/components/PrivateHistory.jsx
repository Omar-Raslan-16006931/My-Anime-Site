import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  initVault, subscribeVault, vaultState, enablePrivate, unlockVault, lockThisDevice, disablePrivate, resetPrivate,
} from '../lib/vault'

let snap = vaultState()
const read = () => {
  const s = vaultState()
  if (JSON.stringify(s) !== JSON.stringify(snap)) snap = s
  return snap
}

// Settings → Private history (end-to-end encrypted watch history + My List).
export default function PrivateHistory({ user }) {
  const st = useSyncExternalStore(subscribeVault, read, read)
  const [mode, setMode] = useState(null) // 'enable' | 'unlock' | 'reset' | null
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { initVault(user?.id) }, [user?.id])

  const reset = () => { setMode(null); setP1(''); setP2(''); setBusy(false) }
  const run = async (fn, done) => {
    setMsg(''); setBusy(true)
    try { await fn(); setMsg(done); reset() } catch (e) { setMsg(e?.message || 'Something went wrong'); setBusy(false) }
  }

  const submit = (e) => {
    e.preventDefault()
    if (mode === 'unlock') return run(() => unlockVault(p1), 'Unlocked on this device.')
    if (p1.length < 8) return setMsg('Use at least 8 characters.')
    if (p1 !== p2) return setMsg('The two passphrases don’t match.')
    if (mode === 'enable') return run(() => enablePrivate(p1), 'Private history is on. Only you can read it now.')
    if (mode === 'reset') return run(() => resetPrivate(p1), 'Started a fresh private history.')
  }

  const status = !st.available
    ? 'Not set up on the server yet.'
    : !st.enabled ? 'Off' : st.unlocked ? 'On · unlocked on this device' : 'On · locked on this device'

  return (
    <section style={{ marginTop: 38, borderTop: '1px solid var(--border)', paddingTop: 26 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Private history</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        Encrypts your watch history, progress and My List with a passphrase only you know.
        The site owner only stores scrambled data and can’t see what you watch or save.
      </p>
      <p style={{ fontSize: 13, marginBottom: 14, color: 'var(--text2)' }}>Status: <strong style={{ color: 'var(--text)' }}>{status}</strong></p>

      {!mode && st.available && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!st.enabled && <button className="btn btn-primary btn-sm" onClick={() => setMode('enable')}>Turn on</button>}
          {st.enabled && !st.unlocked && <button className="btn btn-primary btn-sm" onClick={() => setMode('unlock')}>Unlock</button>}
          {st.enabled && !st.unlocked && <button className="btn btn-ghost btn-sm" onClick={() => setMode('reset')}>Forgot passphrase</button>}
          {st.enabled && st.unlocked && (
            <button className="btn btn-ghost btn-sm" onClick={() => run(async () => lockThisDevice(), 'Locked on this device.')}>Lock this device</button>
          )}
          {st.enabled && st.unlocked && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Turn off Private history? Your history and list go back to normal, readable storage.')) {
                  run(() => disablePrivate(), 'Private history is off.')
                }
              }}
            >Turn off</button>
          )}
        </div>
      )}

      {mode && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380 }}>
          {mode === 'reset' && (
            <p style={{ fontSize: 13, color: 'var(--accent3)' }}>
              Without the old passphrase your previous private history can’t be recovered by anyone. This starts an empty one.
            </p>
          )}
          <input type="password" autoComplete={mode === 'unlock' ? 'current-password' : 'new-password'} placeholder={mode === 'unlock' ? 'Your passphrase' : 'New passphrase (8+ characters)'} value={p1} onChange={(e) => setP1(e.target.value)} />
          {mode !== 'unlock' && (
            <input type="password" autoComplete="new-password" placeholder="Repeat passphrase" value={p2} onChange={(e) => setP2(e.target.value)} />
          )}
          {mode === 'enable' && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Write it down. If you forget it, your private history is gone for good. Nobody, including the site owner, can reset it.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'enable' ? 'Encrypt my history' : mode === 'unlock' ? 'Unlock' : 'Start fresh'}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => { reset(); setMsg('') }}>Cancel</button>
          </div>
        </form>
      )}

      {msg && <p style={{ fontSize: 13, marginTop: 12, color: 'var(--text2)' }}>{msg}</p>}
    </section>
  )
}
