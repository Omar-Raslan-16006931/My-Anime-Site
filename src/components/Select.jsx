import { useState, useEffect, useRef } from 'react'

// Themed drop-down (replaces the browser's native <select> list).
// options: [{ value, label }]. Opens with a smooth drop animation, closes on
// outside click / Escape, supports arrow keys, and scrolls to the current item.
export default function Select({ value, options, onChange, label = 'Select', className = '' }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const root = useRef(null)
  const list = useRef(null)
  const cur = options.find((o) => o.value === value) || options[0]

  useEffect(() => {
    if (!open) return
    const out = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', out)
    return () => document.removeEventListener('pointerdown', out)
  }, [open])

  // Scroll the selected option into view when opening.
  useEffect(() => {
    if (!open || !list.current) return
    const i = Math.max(0, options.findIndex((o) => o.value === value))
    setHi(i)
    const el = list.current.children[i]
    if (el) list.current.scrollTop = el.offsetTop - list.current.clientHeight / 2 + el.offsetHeight / 2
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (o) => { onChange(o.value); setOpen(false) }

  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      const n = Math.min(options.length - 1, Math.max(0, hi + (e.key === 'ArrowDown' ? 1 : -1)))
      setHi(n)
      const el = list.current?.children[n]
      el?.scrollIntoView({ block: 'nearest' })
    } else if ((e.key === 'Enter' || e.key === ' ') && open && hi >= 0) {
      e.preventDefault()
      pick(options[hi])
    }
  }

  return (
    <div className={'sel ' + (open ? 'open ' : '') + className} ref={root} onKeyDown={onKey}>
      <button type="button" className="sel-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span className="sel-val">{cur?.label}</span>
        <svg className="sel-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="sel-menu" role="listbox" ref={list} aria-hidden={!open}>
        {options.map((o, i) => (
          <button
            type="button"
            key={o.value}
            role="option"
            aria-selected={o.value === value}
            tabIndex={open ? 0 : -1}
            className={'sel-opt' + (o.value === value ? ' on' : '') + (i === hi ? ' hi' : '')}
            style={{ '--i': Math.min(i, 10) }}
            onMouseEnter={() => setHi(i)}
            onClick={() => pick(o)}
          >
            <span>{o.label}</span>
            {o.value === value && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
