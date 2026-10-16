// Yoru colour schemes. Every scheme exposes the same semantic tokens, which are
// written to the document as CSS variables (--y-*). The default is "Cinema".
// h0/hr/c/k tint the striped placeholders and the per-title "glow" colours.
import { useSyncExternalStore } from 'react'

export const SCHEMES = {
  Cinema: { n: 'Cinema', bg2: '#0a0a0a', bg: '#141414', s1: '#1f1f1f', s2: '#2f2f2f', s3: '#262626', tx: '#ffffff', t2: '#e5e5e5', t3: '#b3b3b3', t4: '#8c8c8c', t5: '#737373', ac: 'oklch(0.58 0.23 27)', onac: '#ffffff', h0: 0, hr: 360, c: 0.006, k: 0.12 },
  Mono: { n: 'Mono', bg2: '#080808', bg: '#101010', s1: '#1a1a1a', s2: '#2a2a2a', s3: '#222222', tx: '#ffffff', t2: '#e0e0e0', t3: '#b0b0b0', t4: '#8a8a8a', t5: '#707070', ac: 'oklch(0.97 0 0)', onac: '#0a0a0a', h0: 0, hr: 360, c: 0.004, k: 0.08 },
  Crimson: { n: 'Crimson', bg2: '#070606', bg: '#0d0b0b', s1: '#181414', s2: '#271f1f', s3: '#1f1919', tx: '#f6f1f0', t2: '#d8cecd', t3: '#a89c9b', t4: '#857a79', t5: '#6f6564', ac: 'oklch(0.62 0.22 25)', onac: '#ffffff', h0: 340, hr: 60, c: 0.06, k: 1.5 },
  Violet: { n: 'Violet', bg2: '#0b0716', bg: '#110b22', s1: '#1b1333', s2: '#2b2050', s3: '#231a42', tx: '#f3effd', t2: '#d3c9ee', t3: '#a496cc', t4: '#8272ad', t5: '#6c5c93', ac: 'oklch(0.7 0.2 305)', onac: '#12091f', h0: 270, hr: 60, c: 0.08, k: 2 },
  Cyan: { n: 'Cyan', bg2: '#040b16', bg: '#07111f', s1: '#0d1b30', s2: '#15294a', s3: '#112240', tx: '#eaf6ff', t2: '#bdd6ea', t3: '#8aa8c4', t4: '#6a89a6', t5: '#567490', ac: 'oklch(0.86 0.14 205)', onac: '#04101c', h0: 180, hr: 70, c: 0.06, k: 1.6 },
  Mint: { n: 'Mint', bg2: '#050a08', bg: '#09100d', s1: '#111b17', s2: '#1b2d26', s3: '#152420', tx: '#eefaf4', t2: '#c3dccf', t3: '#8fb09f', t4: '#6e9080', t5: '#5a7a6b', ac: 'oklch(0.88 0.17 160)', onac: '#04120b', h0: 130, hr: 70, c: 0.06, k: 1.6 },
  Solar: { n: 'Solar', bg2: '#070707', bg: '#0d0d0b', s1: '#181815', s2: '#272721', s3: '#20201b', tx: '#f7f6ee', t2: '#d9d7c6', t3: '#aaa892', t4: '#88866f', t5: '#727058', ac: 'oklch(0.9 0.17 98)', onac: '#141200', h0: 60, hr: 60, c: 0.05, k: 1.2 },
  Coral: { n: 'Coral', bg2: '#0c0810', bg: '#140d18', s1: '#1f1426', s2: '#321f3a', s3: '#281a30', tx: '#fdf0f2', t2: '#e6cdd3', t3: '#b898a2', t4: '#967782', t5: '#7f6270', ac: 'oklch(0.75 0.16 18)', onac: '#1a0a0e', h0: 330, hr: 60, c: 0.07, k: 1.6 },
  Ultramarine: { n: 'Ultramarine', bg2: '#050818', bg: '#090e2a', s1: '#101a42', s2: '#1b2b6b', s3: '#152357', tx: '#eef1ff', t2: '#c5cdf2', t3: '#919fd6', t4: '#7080b8', t5: '#5c6c9e', ac: 'oklch(0.74 0.17 255)', onac: '#050a22', h0: 230, hr: 50, c: 0.09, k: 2 },
  Tangerine: { n: 'Tangerine', bg2: '#0a0705', bg: '#120c07', s1: '#1d140b', s2: '#302010', s3: '#261a0d', tx: '#fff3e6', t2: '#ecd2b8', t3: '#bf9f80', t4: '#9b7e62', t5: '#826a52', ac: 'oklch(0.8 0.17 62)', onac: '#1a0d00', h0: 20, hr: 60, c: 0.07, k: 1.6 },
}

export const SCHEME_NAMES = Object.keys(SCHEMES)
const KEY = 'yoru:scheme'
const TOKENS = ['bg2', 'bg', 's1', 's2', 's3', 'tx', 't2', 't3', 't4', 't5', 'ac', 'onac']

let current = 'Cinema'
try {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  if (saved && SCHEMES[saved]) current = saved
} catch { /* storage blocked */ }

const listeners = new Set()

export function applyScheme(name = current) {
  if (typeof document === 'undefined') return
  const q = SCHEMES[name] || SCHEMES.Cinema
  const st = document.documentElement.style
  TOKENS.forEach((k) => st.setProperty('--y-' + k, q[k]))
  // The status-bar / overscroll area on phones follows the page colour.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', q.bg)
}

export function getScheme() { return current }

export function setScheme(name) {
  if (!SCHEMES[name]) return
  current = name
  try { localStorage.setItem(KEY, name) } catch { /* ignore */ }
  applyScheme(name)
  listeners.forEach((l) => l())
}

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb) }
export const useScheme = () => useSyncExternalStore(subscribe, getScheme, getScheme)

// ---- Colour helpers that follow the active scheme ----
export const q = () => SCHEMES[current] || SCHEMES.Cinema
const hue = (h) => { const s = q(); return s.h0 + (((h || 0) * 0.31) % s.hr) }
// Striped placeholder for art that has no image.
export const stripe = (h, l = 0.3) => {
  const s = q(); const c = hue(h)
  return `repeating-linear-gradient(135deg, oklch(${l} ${s.c} ${c}) 0 2px, oklch(${l - 0.03} ${s.c * 0.8} ${c}) 2px 11px)`
}
// Soft accent tint for a given hue (avatars, genre outlines).
export const glow = (h) => `oklch(0.78 ${0.06 * q().k} ${hue(h)})`
export const deep = (h) => `oklch(0.19 ${0.015 * q().k} ${hue(h)})`

// A stable hue from any string (used for profile avatars and genre tiles).
export function hueOf(str) {
  let n = 0
  for (const ch of String(str || '')) n = (n * 31 + ch.charCodeAt(0)) % 360
  return n
}

applyScheme()
