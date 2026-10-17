import { useEffect, useState } from 'react'

// Height-animated show/hide. Content mounts on first open and then stays mounted,
// so opening is smooth and closing never snaps.
export default function Collapse({ open, children, className = '' }) {
  const [seen, setSeen] = useState(open)
  useEffect(() => { if (open) setSeen(true) }, [open])
  return (
    <div className={'collapse' + (open ? ' open' : '') + (className ? ' ' + className : '')} aria-hidden={!open}>
      <div className="collapse-in">{seen && children}</div>
    </div>
  )
}
