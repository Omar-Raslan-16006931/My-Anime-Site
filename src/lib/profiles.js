// "Who's watching?" profiles: a name, a colour, an optional photo and a Kids flag.
// They're cached on this device (localStorage) and, when signed in, synced to the
// account (public.user_profiles, see db/user_profiles.sql) so they follow you to
// every device. Without that table they quietly stay device-only.
import { useSyncExternalStore } from 'react'
import { supabase } from '../supabase'

const KEY = 'yoru:profiles'
const ACTIVE = 'yoru:profile'
const MAX = 5
const OWNER = 'yoru:profiles:owner'
const TABLE = 'user_profiles'

const read = () => {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(l) ? l.filter((p) => p && p.id && p.name) : []
  } catch { return [] }
}

let list = typeof localStorage !== 'undefined' ? read() : []
let activeId = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE) : null
// snapshot object must change identity only when data changes (useSyncExternalStore)
let snap = { profiles: list, active: list.find((p) => p.id === activeId) || null }
const subs = new Set()

const commit = () => {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
  try { if (activeId) localStorage.setItem(ACTIVE, activeId); else localStorage.removeItem(ACTIVE) } catch { /* ignore */ }
  snap = { profiles: list, active: list.find((p) => p.id === activeId) || null }
  subs.forEach((s) => s())
  announce()
  push()
}

// ── Account sync ────────────────────────────────────────────────────────────
let uid = null
let pushTimer = 0
const toRow = (p, i) => ({ user_id: uid, id: p.id, name: p.name, hue: p.hue ?? 0, kids: !!p.kids, avatar_url: p.avatar || null, pin_hash: p.pin || null, position: i })
const fromRow = (r) => ({ id: r.id, name: r.name, hue: r.hue ?? 0, kids: !!r.kids, ...(r.avatar_url ? { avatar: r.avatar_url } : {}), ...(r.pin_hash ? { pin: r.pin_hash } : {}) })

async function pushNow() {
  if (!uid) return
  const mine = uid
  try {
    if (list.length) {
      const { error } = await supabase.from(TABLE).upsert(list.map(toRow), { onConflict: 'user_id,id' })
      if (error) { uid = null; return } // table missing → device-only
      const keep = list.map((p) => `"${p.id}"`).join(',')
      await supabase.from(TABLE).delete().eq('user_id', mine).not('id', 'in', `(${keep})`)
    }
  } catch { /* offline: next change retries */ }
}
const push = () => { if (!uid) return; clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 400) }

// Which slice of the account's data (My List, Continue watching, Watched…) the active profile sees.
// The first profile owns everything saved before profiles had their own data ('main').
export const profileKeyOf = (sn) => {
  const a = sn?.active
  return a && sn.profiles[0] && a.id !== sn.profiles[0].id ? a.id : 'main'
}
export const profileKey = () => profileKeyOf(snap)
let lastKey = 'main'
const announce = () => {
  const k = profileKey()
  if (k !== lastKey) { lastKey = k; try { window.dispatchEvent(new CustomEvent('yoru:profile-data')) } catch { /* ignore */ } }
}

const commitLocal = () => {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
  try { if (activeId) localStorage.setItem(ACTIVE, activeId); else localStorage.removeItem(ACTIVE) } catch { /* ignore */ }
  snap = { profiles: list, active: list.find((p) => p.id === activeId) || null }
  subs.forEach((s) => s())
  announce()
}

const subscribe = (cb) => { subs.add(cb); return () => subs.delete(cb) }
const getSnap = () => snap

export const hueFor = (name) => {
  let n = 0
  for (const ch of String(name || '')) n = (n * 31 + ch.charCodeAt(0)) % 360
  return n
}

// Bold avatar colour for a profile hue (same everywhere a profile is drawn).
export const vivid = (h = 0) => `linear-gradient(145deg, oklch(0.74 0.15 ${h}), oklch(0.56 0.17 ${(h + 40) % 360}))`
export const HUES = [20, 55, 95, 150, 200, 255, 305, 340]

// Delete a removed profile's list / history / watched rows.
async function wipeProfileData(id) {
  if (!uid) return
  try {
    const { udb } = await import('./udb')
    for (const t of ['watchlist', 'watched', 'currently_watching', 'currently_watching_tmdb', 'anime_episode_progress', 'tv_episode_progress']) {
      await udb.from(t).delete().eq('user_id', uid).eq('profile_id', id)
    }
  } catch { /* best effort */ }
}

// Centre-crop an image file to a 320px square JPEG blob (small, fast to upload).
export function squareImage(file, size = 320) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) return reject(new Error('Please choose an image file'))
    if (file.size > 8 * 1024 * 1024) return reject(new Error('Image must be under 8 MB'))
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = c.height = size
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', 0.86)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')) }
    img.src = url
  })
}
const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b) })

// CSS background for a profile tile: its photo, or the coloured gradient.
export const tileBg = (p) => (p?.avatar ? `center / cover no-repeat url("${p.avatar}"), ${vivid(p.hue ?? 0)}` : vivid(p?.hue ?? 0))

// ── PIN lock ────────────────────────────────────────────────────────────────
// A 4–6 digit code that gates opening a profile in the app. It is a privacy lock between
// people sharing a device or account, not encryption: the account itself can still read its data.
const hashPin = async (id, pin) => {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('yoru-pin:' + id), iterations: 100000, hash: 'SHA-256' }, base, 256)
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}
export const hasPin = (p) => !!p?.pin

export const profileActions = {
  // Sign in / out: pull this account's profiles (or push the ones made before sync existed).
  async sync(userId) {
    clearTimeout(pushTimer)
    if (!userId) { uid = null; return }
    let owner = null
    try { owner = localStorage.getItem(OWNER) } catch { /* ignore */ }
    try {
      const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).order('position')
      if (error) { uid = null; return } // table not created yet → device-only
      uid = userId
      try { localStorage.setItem(OWNER, userId) } catch { /* ignore */ }
      if (data && data.length) {
        list = data.map(fromRow)
        if (activeId && !list.some((p) => p.id === activeId)) activeId = null
        commitLocal()
      } else {
        // Empty on the server: adopt this device's profiles unless they belong to another account.
        if (owner && owner !== userId) { list = []; activeId = null }
        commitLocal()
        if (list.length) pushNow()
      }
    } catch { uid = null }
  },
  // Make sure there's always one profile (named after the account) to pick.
  ensure(name) {
    if (list.length) return
    const p = { id: 'p-' + Date.now().toString(36), name: name || 'Me', hue: hueFor(name || 'Me'), kids: false, auto: true }
    list = [p]; activeId = null; commit()
  },
  // Onboarding: turn the auto-made starter profile into the chosen one (or add a new one).
  add2(name, kids = false, hue) {
    const auto = list.find((p) => p.auto)
    if (auto) {
      const nm = String(name || '').trim().slice(0, 18) || auto.name
      list = list.map((p) => (p.id === auto.id ? { id: p.id, name: nm, hue: hue ?? p.hue, kids: !!kids, ...(p.avatar ? { avatar: p.avatar } : {}) } : p))
      commit()
      return list.find((p) => p.id === auto.id)
    }
    return this.add(name, kids, hue)
  },
  async setPin(id, pin) {
    const h = pin ? await hashPin(id, pin) : null
    list = list.map((p) => {
      if (p.id !== id) return p
      const { pin: _x, ...rest } = p
      void _x
      return h ? { ...rest, pin: h } : rest
    })
    commit()
  },
  async checkPin(id, pin) {
    const p = list.find((x) => x.id === id)
    if (!p?.pin) return true
    return (await hashPin(id, pin)) === p.pin
  },
  // Set (blob) or clear (null) a profile's photo. Signed in → uploaded to the avatars bucket; otherwise kept on this device.
  async setAvatar(id, blob) {
    const cur = list.find((p) => p.id === id)
    if (!cur) return
    let url = null
    if (blob) {
      if (uid) {
        const path = `${uid}/profile-${id}.jpg`
        const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' })
        if (!error) url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?t=${Date.now()}`
      }
      if (!url) url = await blobToDataUrl(blob)
    } else if (uid && cur.avatar && !cur.avatar.startsWith('data:')) {
      supabase.storage.from('avatars').remove([`${uid}/profile-${id}.jpg`]).catch(() => {})
    }
    list = list.map((p) => {
      if (p.id !== id) return p
      const { avatar: _a, ...rest } = p
      void _a
      return url ? { ...rest, avatar: url } : rest
    })
    commit()
  },
  setActive(id) { activeId = id; commit() },
  clearActive() { activeId = null; commit() },
  add(name, kids = false, hue) {
    const nm = String(name || '').trim().slice(0, 18)
    if (!nm || list.length >= MAX) return null
    const p = { id: 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: nm, hue: hue ?? hueFor(nm + list.length), kids: !!kids }
    list = [...list, p]; commit()
    return p
  },
  remove(id) {
    if (list.length <= 1 || list[0]?.id === id) return // the first profile owns the account's original data
    wipeProfileData(id)
    list = list.filter((p) => p.id !== id)
    if (activeId === id) activeId = null
    commit()
  },
  rename(id, name) {
    const nm = String(name || '').trim().slice(0, 18)
    if (!nm) return
    list = list.map((p) => (p.id === id ? { ...p, name: nm } : p))
    commit()
  },
  update(id, patch) {
    const nm = String(patch.name ?? '').trim().slice(0, 18)
    list = list.map((p) => (p.id === id ? { ...p, ...(nm ? { name: nm } : {}), ...(patch.hue != null ? { hue: patch.hue } : {}), ...(patch.kids != null ? { kids: !!patch.kids } : {}) } : p))
    commit()
  },
  max: MAX,
}

export const useProfiles = () => useSyncExternalStore(subscribe, getSnap, getSnap)
