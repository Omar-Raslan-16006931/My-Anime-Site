import { useEffect } from 'react'
import { SCHEMES, SCHEME_NAMES, previewScheme, setScheme, keepPreview, cancelPreview, useScheme, usePreviewing } from '../lib/theme'

// A tiny mock of the app drawn in a scheme's own colours, so a theme can be judged at a glance.
export function MiniApp({ name }) {
  const q = SCHEMES[name] || SCHEMES.Cinema
  const poster = (a, b) => ({ background: `linear-gradient(145deg, ${a}, ${b})` })
  return (
    <div className="tp-mini" style={{ background: q.bg, color: q.tx }} aria-hidden="true">
      <div className="tp-top"><b>YORU<i style={{ color: q.ac }}>.</i></b><span style={{ background: q.s2 }} /></div>
      <div className="tp-hero" style={{ background: q.s1 }}>
        <span className="tp-title" style={{ background: q.tx }} />
        <span className="tp-sub" style={{ background: q.t4 }} />
        <span className="tp-play" style={{ background: q.ac, color: q.onac }}>▶ Play</span>
      </div>
      <div className="tp-row">
        {[0, 1, 2, 3].map((i) => <span key={i} style={poster(q.s2, q.s3)} />)}
      </div>
      <div className="tp-dock" style={{ background: q.s1 }}>
        <i style={{ background: q.tx }} /><i style={{ background: q.t5 }} /><i style={{ background: q.t5 }} /><i style={{ background: q.t5 }} />
      </div>
    </div>
  )
}

// Theme picker: tapping a theme applies it to the whole app immediately (preview), with a mock above.
export default function ThemePicker({ onTry, instant = false }) {
  const scheme = useScheme()
  const previewing = usePreviewing()
  return (
    <div className="tp">
      <MiniApp name={scheme} />
      <div className="tp-side">
        <p className="tp-hint">{instant ? 'Tap a theme to see it live. You can change it any time in your account.' : previewing ? 'Previewing — browse the app, then keep or cancel.' : 'Tap a theme to try it across the whole app.'}</p>
        <div className="me-swatches tp-grid">
          {SCHEME_NAMES.map((k) => (
            <button key={k} type="button" className={'me-swatch' + (scheme === k ? ' on' : '')} aria-pressed={scheme === k} onClick={() => { (instant ? setScheme : previewScheme)(k); onTry?.(k) }}>
              <span className="me-swatch-chips"><i style={{ background: SCHEMES[k].bg }} /><i style={{ background: SCHEMES[k].s2 }} /><i style={{ background: SCHEMES[k].ac }} /></span>
              <b>{k}</b>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Floating bar shown while previewing: flip through themes while using the app, then keep or revert.
export function PreviewBar() {
  const previewing = usePreviewing()
  const scheme = useScheme()
  // Leave room under the page so the bar never covers the last content.
  useEffect(() => {
    document.documentElement.classList.toggle('tp-on', previewing)
    return () => document.documentElement.classList.remove('tp-on')
  }, [previewing])
  if (!previewing) return null
  return (
    <div className="tp-bar" role="region" aria-label="Theme preview">
      <div className="tp-bar-dots">
        {SCHEME_NAMES.map((k) => (
          <button key={k} type="button" aria-label={k} aria-pressed={scheme === k} className={scheme === k ? 'on' : ''} style={{ background: SCHEMES[k].ac }} onClick={() => previewScheme(k)} />
        ))}
      </div>
      <div className="tp-bar-row">
        <span>Previewing <b>{scheme}</b></span>
        <button type="button" className="tp-cancel" onClick={cancelPreview}>Cancel</button>
        <button type="button" className="tp-keep" onClick={keepPreview}>Keep</button>
      </div>
    </div>
  )
}
