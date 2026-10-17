// "Who's watching?" profiles. These live on this device (localStorage): each is
// a name, a colour and an optional Kids flag. Watch history and My List still
// belong to the signed-in account, so profiles are a per-device picker/label.
import { useSyncExternalStore } from 'react'

const KEY = 'yoru:profiles'
const ACTIVE = 'yoru:profile'
const MAX = 5

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

export const profileActions = {
  // Make sure there's always one profile (named after the account) to pick.
  ensure(name) {
    if (list.length) return
    const p = { id: 'p-' + Date.now().toString(36), name: name || 'Me', hue: hueFor(name || 'Me'), kids: false }
    list = [p]; activeId = null; commit()
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
    if (list.length <= 1) return
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
