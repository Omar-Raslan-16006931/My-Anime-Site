import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, categoryPath } from '../lib/categories'

// Categories panel. Desktop: unrolls under the top bar. Phone: slides up above
// the tab bar. Always mounted so it animates open AND closed; closes on an
// outside tap, Escape, or picking a category.
export default function CategoryMenu({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div className={'cat-scrim' + (open ? ' open' : '')} onClick={onClose} />
      <div className={'cat-menu' + (open ? ' open' : '')} role="dialog" aria-label="Categories" aria-hidden={!open}>
        <div className="cat-menu-title">Categories</div>
        <div className="cat-menu-grid">
          {CATEGORIES.map((g, i) => (
            <Link
              key={g}
              to={categoryPath(g)}
              className="cat-menu-item"
              style={{ '--i': i }}
              tabIndex={open ? 0 : -1}
              onClick={onClose}
            >
              {g}
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
