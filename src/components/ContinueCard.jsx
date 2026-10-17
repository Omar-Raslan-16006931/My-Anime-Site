import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

// "Continue watching" card: art with a play dot and progress bar, title + episode
// label underneath, and a three-dot menu to hide it from the row.
// item: { href, banner, poster, title, meta, progress(0..1) }
export default function ContinueCard({ item, onRemove }) {
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const how = useRef('remove')
  const art = item.banner || item.poster
  const go = () => item.href && navigate(item.href)

  useEffect(() => {
    if (!menu) return undefined
    const close = () => setMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menu])

  return (
    <div className={'ycc' + (leaving ? ' leaving' : '')} onClick={leaving ? undefined : go} onAnimationEnd={(e) => { if (leaving && e.target === e.currentTarget) onRemove?.(item, how.current) }} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go() }}>
      <button type="button" className="ycc-dots" aria-label="More options" aria-expanded={menu} onClick={(e) => { e.stopPropagation(); setMenu((v) => !v) }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
      {menu && (
        <div className="ycc-menu" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { how.current = 'watched'; setMenu(false); setLeaving(true) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            Mark as watched
          </button>
          <button type="button" onClick={() => { how.current = 'remove'; setMenu(false); setLeaving(true) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            Remove
          </button>
        </div>
      )}
      <div className="ycc-art">
        {art && <img src={art} alt="" loading="lazy" className={item.banner ? '' : 'poster'} />}
        <span className="ycc-shade" />
        <span className="ycc-play"><Icon.play width="12" height="12" /></span>
        <div className="ycc-bar"><span style={{ width: `${Math.round((item.progress || 0.04) * 100)}%` }} /></div>
      </div>
      <div className="ycc-row">
        <b>{item.title}</b>
        {item.meta && <small>{item.meta}</small>}
      </div>
    </div>
  )
}
