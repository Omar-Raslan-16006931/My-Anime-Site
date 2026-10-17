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

  // Layout effect: the overlay is in place before the first paint, so the page behind never flashes.
  useLayoutEffect(() => {
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
    const t = setTimeout(() => setG(null), g.fly ? 2700 : 2900)
    return () => clearTimeout(t)
  }, [g])

  // FLIP: measure where the tile ends up, start it exactly where the picked tile was, then glide.
  useLayoutEffect(() => {
    const el = tileRef.current
    if (!g?.fly || !el) return undefined
    const f = g.fly
    const end = el.getBoundingClientRect()
    const dx = f.cx - (end.left + end.width / 2)
    const dy = f.cy - (end.top + end.height / 2)
    const finalT = el.style.transform
    el.style.transition = 'none'
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1)`
    el.style.boxShadow = f.shadow || ''
    void el.offsetWidth
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 0.95s cubic-bezier(0.65, 0, 0.35, 1), box-shadow 0.8s ease'
      el.style.transform = finalT
      el.style.boxShadow = ''
    }))
    return () => cancelAnimationFrame(id)
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
