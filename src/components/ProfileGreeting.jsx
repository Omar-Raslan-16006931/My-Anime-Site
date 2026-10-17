import { useEffect, useState } from 'react'
import { useProfiles, vivid } from '../lib/profiles'

// A short "welcome" moment: the active profile's tile pops in, says hi, then dissolves into the app.
// Plays once when the app opens, and again whenever a profile is chosen (event "yoru:greet").
export default function ProfileGreeting() {
  const { active } = useProfiles()
  const [show, setShow] = useState(null) // profile snapshot being greeted
  const [cont, setCont] = useState(false) // continuing seamlessly from the profile picker
  const [look, setLook] = useState(null) // the picker tile's exact size/radius/font to match on hand-over

  useEffect(() => {
    let fresh = false
    try { fresh = !sessionStorage.getItem('yoru:greeted'); sessionStorage.setItem('yoru:greeted', '1') } catch { /* ignore */ }
    if (fresh && active && !/^\/(profiles|welcome)/.test(window.location.pathname)) setShow(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const on = (e) => {
      setCont(!!e?.detail?.cont)
      setLook(e?.detail?.look || null)
      try {
        const a = JSON.parse(localStorage.getItem('yoru:profiles') || '[]').find((p) => p.id === localStorage.getItem('yoru:profile'))
        if (a) setShow(a)
      } catch { /* ignore */ }
    }
    window.addEventListener('yoru:greet', on)
    return () => window.removeEventListener('yoru:greet', on)
  }, [])

  useEffect(() => {
    if (!show) return undefined
    const t = setTimeout(() => setShow(null), cont ? 2300 : 2900)
    return () => clearTimeout(t)
  }, [show, cont])

  if (!show) return null
  // Hand-over from the picker: identical box, radius, font and scale, so there is no visible change at all.
  const tileStyle = { background: vivid(show.hue ?? 0) }
  if (cont && look) {
    const m = (124 - look.w) / 2
    Object.assign(tileStyle, { width: look.w, height: look.w, borderRadius: look.radius, fontSize: look.font, margin: m, transform: `scale(${124 / look.w})`, flex: 'none' })
  }
  return (
    <div className={'greet' + (cont ? ' cont' : '')} key={show.id + (cont ? 'c' : '')} aria-hidden="true">
      <div className="greet-inner">
        <div className="greet-tile" style={tileStyle}>{show.name[0].toUpperCase()}</div>
        <div className="greet-name">Welcome back, {show.name}</div>
      </div>
    </div>
  )
}
