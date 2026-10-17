import { useEffect, useRef, useState } from 'react'
import Collapse from './Collapse'
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
const Check = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>

export function PreviewBar() {
  const previewing = usePreviewing()
  const scheme = useScheme()
  const [min, setMin] = useState(false)
  const [shown, setShown] = useState(previewing) // stays mounted while the bar animates away
  const [done, setDone] = useState(null) // 'keep' | 'cancel' while the button confirms itself
  const last = useRef(scheme) // label stays put during the exit instead of flipping to the reverted theme
  if (previewing && !done) last.current = scheme

  useEffect(() => {
    document.documentElement.classList.toggle('tp-on', previewing)
    let t
    if (previewing) { setShown(true) } else { t = setTimeout(() => { setShown(false); setMin(false); setDone(null) }, 520) }
    return () => { clearTimeout(t) }
  }, [previewing])
  useEffect(() => () => document.documentElement.classList.remove('tp-on'), [])

  // Keep: the button turns into a tick, then the bar slides away. Cancel: the bar slides away as the theme reverts.
  const finish = (kind) => {
    if (done) return
    setDone(kind)
    setTimeout(() => (kind === 'keep' ? keepPreview() : cancelPreview()), kind === 'keep' ? 520 : 140)
  }

  if (!shown) return null
  const label = last.current
  return (
    <div className={'tp-bar' + (min ? ' min' : '') + (!previewing ? ' out' : '')} role="region" aria-label="Theme preview">
      <button type="button" className="tp-handle" onClick={() => setMin((v) => !v)} aria-label={min ? 'Expand theme bar' : 'Minimise theme bar'} aria-expanded={!min}>
        <span className="tp-grip" />
        <span className="tp-swap"><em className="a">Browse the app while you pick</em><em className="b">Previewing <b>{scheme}</b></em></span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="tp-caret"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <Collapse open={!min}>
        <div className="tp-body">
          <div className="tp-chips" role="radiogroup" aria-label="Theme">
            {SCHEME_NAMES.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={scheme === k} className={scheme === k ? 'on' : ''} onClick={() => previewScheme(k)}>
                <i style={{ background: SCHEMES[k].ac, boxShadow: `inset 0 0 0 5px ${SCHEMES[k].bg}` }} />{k}
              </button>
            ))}
          </div>
          <div className="tp-bar-row">
            <button type="button" className={'tp-cancel' + (done === 'cancel' ? ' busy' : '')} onClick={() => finish('cancel')}>Cancel</button>
            <button type="button" className={'tp-keep' + (done === 'keep' ? ' ok' : '')} onClick={() => finish('keep')}>
              <span className="k-a">Keep {label}</span>
              <span className="k-b"><Check />Saved</span>
            </button>
          </div>
        </div>
      </Collapse>
    </div>
  )
}
