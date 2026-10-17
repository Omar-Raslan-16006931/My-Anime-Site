import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useProfiles, vivid } from '../lib/profiles'

// A short "welcome" moment: the profile tile, "Welcome back, name", then it dissolves into the app.
//  • App open: fades in and out on its own (once per session).
//  • After picking a profile ("yoru:greet" with detail.fly): this overlay takes over the picked tile
//    from its very first frame and flies it to the centre itself — one element the whole way, so
//    there is no hand-over and nothing can snap.
export default function ProfileGreeting() {
  const { active } = useProfiles()
  const [g, setG] = useState(null) // { p, fly? }
  const tileRef = useRef(null)

  useEffect(() => {
    let fresh = false
    try { fresh = !sessionStorage.getItem('yoru:greeted'); sessionStorage.setItem('yoru:greeted', '1') } catch { /* ignore */ }
    if (fresh && active && !/^\/(profiles|welcome)/.test(window.location.pathname)) setG({ p: active })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const on = (e) => { if (e?.detail?.profile) setG({ p: e.detail.profile, fly: e.detail.fly || null }) }
    window.addEventListener('yoru:greet', on)
    return () => window.removeEventListener('yoru:greet', on)
  }, [])

  useEffect(() => {
    if (!g) return undefined
    const t = setTimeout(() => setG(null), g.fly ? 3150 : 2900)
    return () => clearTimeout(t)
  }, [g])

  // The tile starts exactly where the picked one was, springs inwards (smaller), springs back out bigger
  // than it started while moving toward the middle, then settles at the middle at its normal size.
  useLayoutEffect(() => {
    const el = tileRef.current
    if (!g?.fly || !el) return undefined
    const f = g.fly
    const end = el.getBoundingClientRect()
    const dx = f.cx - (end.left + end.width / 2)
    const dy = f.cy - (end.top + end.height / 2)
    const fin = 124 / f.w // final scale (the tile's normal welcome size)
    const at = (k, sc, ease) => ({ transform: `translate(${(dx * k).toFixed(2)}px, ${(dy * k).toFixed(2)}px) scale(${sc})`, easing: ease })
    el.style.boxShadow = f.shadow || ''
    const anim = el.animate([
      { ...at(1, 1, 'cubic-bezier(0.33, 0, 0.2, 1)'), offset: 0 },                      // where the tap landed
      { ...at(1, 0.84, 'cubic-bezier(0.34, 1.56, 0.64, 1)'), offset: 0.13 },            // spring inwards
      { ...at(0.46, 1.2, 'cubic-bezier(0.4, 0, 0.2, 1)'), offset: 0.44 },               // spring out, bigger than before, moving
      { ...at(0.1, fin * 1.05, 'cubic-bezier(0.3, 0, 0.2, 1)'), offset: 0.8 },          // easing into the middle
      { ...at(0, fin, 'linear'), offset: 1 },                                          // settled, normal size
    ], { duration: 1350, fill: 'forwards' })
    anim.finished.then(() => { el.style.boxShadow = '' }).catch(() => {})
    return () => anim.cancel()
  }, [g])

  if (!g) return null
  const { p, fly } = g
  const tileStyle = { background: vivid(p.hue ?? 0) }
  if (fly) {
    // Same box, radius and font as the picker tile; the final size comes from scale only.
    const m = (124 - fly.w) / 2
    Object.assign(tileStyle, { width: fly.w, height: fly.w, borderRadius: fly.radius, fontSize: fly.font, margin: m, transform: `scale(${124 / fly.w})`, flex: 'none' })
  }
  return (
    <div className={'greet ' + (fly ? 'fly' : 'open')} key={p.id + (fly ? 'f' : 'o')} aria-hidden="true">
      <div className="greet-bg" />
      <div className="greet-inner">
        <div className="greet-tile" ref={tileRef} style={tileStyle}>{p.name[0].toUpperCase()}</div>
        <div className="greet-name">Welcome back, {p.name}</div>
      </div>
    </div>
  )
}
