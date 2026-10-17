import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigationType } from 'react-router-dom'

// Netflix-style page transitions:
//  • Between tabs: a quick crossfade, nothing moves.
//  • Opening a title: the title page rises up from the bottom like a sheet over the fading page.
//  • Going back from a title: the title page drops away and the page underneath fades back.
// The page you leave stays pinned where it was (no jump to the top). Interruptible.
const isTitle = (p) => /^\/(anime|movie|tv)\/[^/]+/.test(p)
const OUT_MS = 320

let uid = 0
export default function PageStack({ location, render }) {
  const navType = useNavigationType()
  const [stack, setStack] = useState(() => [{ id: ++uid, loc: location, path: location.pathname, state: 'still' }])
  const dir = useRef('fade')
  const timer = useRef(0)

  useLayoutEffect(() => {
    const cur = stack.find((s) => s.state !== 'out')
    if (cur && cur.path === location.pathname) return
    const from = cur ? cur.path : '/'
    // up = a title opens over the page; down = a title closes back to what was under it; fade = tabs
    dir.current = isTitle(location.pathname) && !(isTitle(from) && navType === 'POP') ? 'up' : isTitle(from) ? 'down' : 'fade'
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
          className={'route-anim pg pg-' + s.state + (s.dir ? ' ' + s.dir : '')}
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
