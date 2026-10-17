// Private history vault — end-to-end encrypted.
//
// When a user turns on Private history, everything personal (My List, Currently
// Watching, episode progress, watched marks) moves out of the normal tables into
// ONE encrypted blob in public.private_vault. It is encrypted in the browser with
// a key derived from a passphrase only the user knows (PBKDF2-SHA256 600k →
// AES-256-GCM). The server — and the Supabase owner — only ever see ciphertext.
//
// The derived key is remembered on each device the user unlocks (localStorage),
// so they type the passphrase once per device. It never leaves the device.
import { supabase } from '../supabase'

export const PRIVATE_TABLES = [
  'watchlist', 'watched', 'currently_watching', 'currently_watching_tmdb', 'anime_episode_progress', 'tv_episode_progress',
]
const VAULT = 'private_vault'
const ITERATIONS = 600000
const PAD = 4096 // pad plaintext to 4 KB steps so the size reveals little
const keyStore = (uid) => `aw:vk:${uid}`

const te = new TextEncoder()
const td = new TextDecoder()

function toB64(buf) {
  const b = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromB64(s) {
  const bin = atob(s)
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b
}

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

async function encrypt(key, obj) {
  let json = JSON.stringify(obj)
  json += ' '.repeat((PAD - (json.length % PAD)) % PAD)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(json))
  return { iv: toB64(iv), ciphertext: toB64(ct) }
}
async function decrypt(key, ivB64, ctB64) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ctB64))
  return JSON.parse(td.decode(pt))
}

async function rememberKey(uid, key) {
  try { localStorage.setItem(keyStore(uid), toB64(await crypto.subtle.exportKey('raw', key))) } catch { /* ignore */ }
}
async function recallKey(uid) {
  try {
    const raw = localStorage.getItem(keyStore(uid))
    return raw ? await crypto.subtle.importKey('raw', fromB64(raw), 'AES-GCM', true, ['encrypt', 'decrypt']) : null
  } catch { return null }
}

// ── State ────────────────────────────────────────────────────────────────────
const emptyData = () => ({ v: 1, tables: Object.fromEntries(PRIVATE_TABLES.map((t) => [t, []])) })
let st = { uid: null, enabled: false, key: null, salt: null, data: null, serverAt: null, available: true }
let initPromise = null
let initFor
const listeners = new Set()
const emit = () => listeners.forEach((f) => { try { f() } catch { /* ignore */ } })

export function subscribeVault(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function vaultState() {
  return { enabled: st.enabled, unlocked: !!(st.enabled && st.key && st.data), available: st.available, uid: st.uid }
}
export const vaultActive = () => !!(st.enabled && st.key && st.data)
export const vaultLocked = () => !!(st.enabled && !(st.key && st.data))
export const vaultTables = () => st.data?.tables

// Load (once per user) whether this account uses Private history, and unlock it
// automatically if this device already has the key.
export function initVault(uid) {
  if (initFor === (uid || null) && initPromise) return initPromise
  initFor = uid || null
  initPromise = (async () => {
    st = { uid: uid || null, enabled: false, key: null, salt: null, data: null, serverAt: null, available: true }
    if (!uid) { emit(); return }
    const { data: row, error } = await supabase.from(VAULT).select('salt, iv, ciphertext, updated_at').eq('user_id', uid).maybeSingle()
    if (error) { st.available = false; emit(); return } // table not created yet
    if (row) {
      st.enabled = true
      st.salt = row.salt
      st.serverAt = row.updated_at
      const key = await recallKey(uid)
      if (key) {
        try { st.data = await decrypt(key, row.iv, row.ciphertext); st.key = key } catch { /* stale key */ }
      }
    }
    emit()
  })()
  return initPromise
}

// ── Saving (debounced, last write wins) ─────────────────────────────────────
let saveTimer = 0
let saving = Promise.resolve()
let dirty = false
export function markDirty() {
  dirty = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushVault, 700)
  emit()
}
export function flushVault() {
  clearTimeout(saveTimer)
  if (!dirty || !vaultActive()) return saving
  dirty = false
  const { uid, key, salt, data } = st
  saving = saving.then(async () => {
    const { iv, ciphertext } = await encrypt(key, data)
    const updated_at = new Date().toISOString()
    const { error } = await supabase.from(VAULT).upsert({ user_id: uid, salt, iv, ciphertext, updated_at }, { onConflict: 'user_id' })
    if (error) dirty = true
    else st.serverAt = updated_at
  })
  return saving
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flushVault() })
  // Another device may have changed the vault — refresh when we come back.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') { flushVault(); return }
    if (!vaultActive() || dirty) return
    const { data: row } = await supabase.from(VAULT).select('iv, ciphertext, updated_at').eq('user_id', st.uid).maybeSingle()
    if (row && row.updated_at !== st.serverAt && !dirty) {
      try { st.data = await decrypt(st.key, row.iv, row.ciphertext); st.serverAt = row.updated_at; emit() } catch { /* ignore */ }
    }
  })
}

// ── Settings actions ─────────────────────────────────────────────────────────
// Turn on: copy the user's existing rows into a new encrypted vault, then
// delete them from the readable tables.
export async function enablePrivate(passphrase) {
  const uid = st.uid
  if (!uid) throw new Error('Sign in first.')
  if (!st.available) throw new Error('The private_vault table isn’t set up yet (run db/private_vault.sql).')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passphrase, salt)

  const data = emptyData()
  for (const t of PRIVATE_TABLES) {
    const { data: rows } = await supabase.from(t).select('*').eq('user_id', uid)
    data.tables[t] = rows || []
  }
  const { iv, ciphertext } = await encrypt(key, data)
  const updated_at = new Date().toISOString()
  const { error } = await supabase.from(VAULT).upsert({ user_id: uid, salt: toB64(salt), iv, ciphertext, updated_at }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)

  // Only now that the encrypted copy is safely stored, wipe the readable rows.
  for (const t of PRIVATE_TABLES) await supabase.from(t).delete().eq('user_id', uid)

  st = { ...st, enabled: true, key, salt: toB64(salt), data, serverAt: updated_at }
  await rememberKey(uid, key)
  emit()
}

export async function unlockVault(passphrase) {
  const { data: row, error } = await supabase.from(VAULT).select('salt, iv, ciphertext, updated_at').eq('user_id', st.uid).maybeSingle()
  if (error || !row) throw new Error('No private history found for this account.')
  const key = await deriveKey(passphrase, fromB64(row.salt))
  let data
  try { data = await decrypt(key, row.iv, row.ciphertext) } catch { throw new Error('Wrong passphrase.') }
  st = { ...st, enabled: true, key, salt: row.salt, data, serverAt: row.updated_at }
  await rememberKey(st.uid, key)
  emit()
}

// Forget the key on this device (history stays encrypted in the cloud).
export function lockThisDevice() {
  try { localStorage.removeItem(keyStore(st.uid)) } catch { /* ignore */ }
  st = { ...st, key: null, data: null }
  emit()
}

// Turn off: put everything back into the normal tables and delete the vault.
export async function disablePrivate() {
  if (!vaultActive()) throw new Error('Unlock your private history first.')
  await flushVault()
  const uid = st.uid
  for (const t of PRIVATE_TABLES) {
    const rows = (st.data.tables[t] || []).map((r) => ({ ...r, user_id: uid }))
    if (rows.length) await supabase.from(t).insert(rows)
  }
  await supabase.from(VAULT).delete().eq('user_id', uid)
  try { localStorage.removeItem(keyStore(uid)) } catch { /* ignore */ }
  st = { ...st, enabled: false, key: null, salt: null, data: null, serverAt: null }
  emit()
}

// Forgot the passphrase: start a fresh, empty vault (old history is unreadable).
export async function resetPrivate(passphrase) {
  const uid = st.uid
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passphrase, salt)
  const data = emptyData()
  const { iv, ciphertext } = await encrypt(key, data)
  const updated_at = new Date().toISOString()
  const { error } = await supabase.from(VAULT).upsert({ user_id: uid, salt: toB64(salt), iv, ciphertext, updated_at }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
  st = { ...st, enabled: true, key, salt: toB64(salt), data, serverAt: updated_at }
  await rememberKey(uid, key)
  emit()
}
