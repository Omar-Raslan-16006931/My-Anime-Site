import { useEffect, useState } from 'react'
import { useProfiles, vivid } from '../lib/profiles'

// A short "welcome" moment: the active profile's tile pops in, says hi, then dissolves into the app.
// Plays once when the app opens, and again whenever a profile is chosen (event "yoru:greet").
export default function ProfileGreeting() {
  const { active } = useProfiles()
  const [show, setShow] = useState(null) // profile snapshot being greeted

  useEffect(() => {
    let fresh = false
    try { fresh = !sessionStorage.getItem('yoru:greeted'); sessionStorage.setItem('yoru:greeted', '1') } catch { /* ignore */ }
    if (fresh && active && !/^\/(profiles|welcome)/.test(window.location.pathname)) setShow(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const on = () => {
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
    const t = setTimeout(() => setShow(null), 2900)
    return () => clearTimeout(t)
  }, [show])

  if (!show) return null
  return (
    <div className="greet" key={show.id} aria-hidden="true">
      <div className="greet-inner">
        <div className="greet-tile" style={{ background: vivid(show.hue ?? 0) }}>{show.name[0].toUpperCase()}</div>
        <div className="greet-name">Welcome back, {show.name}</div>
      </div>
    </div>
  )
}
