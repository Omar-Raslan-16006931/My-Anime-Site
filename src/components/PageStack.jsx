import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigationType } from 'react-router-dom'

// Page transitions: the page you leave fades and slides out (pinned where it was, so it never jumps
// to the top), while the new page fades and slides in from the side your tab order says it lives on.
// Interruptible: switching again drops whatever was still leaving and starts straight away.
const ORDER = ['/', '/simulcast', '/search', '/me']
const slot = (p) => ORDER.findIndex((o) => (o === '/' ? p === '/' : p === o || p.startsWith(o + '/')))
const OUT_MS = 240

let uid = 0
export default function PageStack({ location, render }) {
  const navType = useNavigationType()
  const [stack, setStack] = useState(() => [{ id: ++uid, loc: location, path: location.pathname, state: 'still' }])
  const dir = useRef(1)
  const timer = useRef(0)

  useLayoutEffect(() => {
    const cur = stack.find((s) => s.state !== 'out')
    if (cur && cur.path === location.pathname) return
    const a = slot(cur ? cur.path : '/'), b = slot(location.pathname)
    dir.current = a >= 0 && b >= 0 ? (b >= a ? 1 : -1) : navType === 'POP' ? -1 : 1
    const scroll = window.scrollY
    clearTimeout(timer.current)
    setStack([
      ...(cur ? [{ ...cur, state: 'out', scroll, dir: dir.current }] : []),
      { id: ++uid, loc: location, path: location.pathname, state: 'in', dir: dir.current },
    ])
    timer.current = setTimeout(() => setStack((s) => s.filter((p) => p.state !== 'out')), OUT_MS + 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <div className="pg-wrap">
      {stack.map((s) => (
        <div
          key={s.id}
          className={'route-anim pg pg-' + s.state + (s.dir < 0 ? ' back' : '')}
          style={s.state === 'out' ? { top: -s.scroll } : undefined}
          aria-hidden={s.state === 'out' || undefined}
          inert={s.state === 'out' ? '' : undefined}
        >
          {render(s.state === 'out' ? s.loc : location)}
        </div>
      ))}
    </div>
  )
}
