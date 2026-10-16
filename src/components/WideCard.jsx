import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

const Chev = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
)

// Landscape card (banner art, title on the art). On PC, hovering lifts the card
// and opens an info panel (Play, My List, More info, score, genres) right under
// it. On phones the same card turns into a poster card with the title below.
// item: { href, banner, poster, title, meta, score, genres[], progress(0..1) }
// Optional: inList (bool), onToggleList(item) → shows the "+" button.
export default function WideCard({ item, inList = false, onToggleList }) {
  const navigate = useNavigate()
  const go = () => item.href && navigate(item.href)
  const bar = item.progress > 0 && (
    <div className="ywc-progress"><span style={{ width: `${Math.round(item.progress * 100)}%` }} /></div>
  )
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.() }
  const score = item.score ? Number(item.score).toFixed(1) : null

  return (
    <div className="ywc" onClick={go} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go() }}>
      <div className="ywc-art">
        {item.banner && <img className="ywc-banner" src={item.banner} alt="" loading="lazy" />}
        {item.poster && <img className="ywc-poster" src={item.poster} alt="" loading="lazy" />}
        <div className="ywc-over"><b>{item.title}</b></div>
        {bar}
      </div>

      <div className="ywc-below">
        <b>{item.title}</b>
        {item.meta && <small>{item.meta}</small>}
      </div>

      <div className="ywc-info">
        <div className="ywc-btns">
          <button type="button" className="ywc-btn ac" aria-label="Play" onClick={stop(go)}><Icon.play width="15" height="15" /></button>
          {onToggleList && (
            <button type="button" className="ywc-btn" aria-label={inList ? 'In My List' : 'Add to My List'} aria-pressed={inList} onClick={stop(() => onToggleList(item))}>
              {inList ? <Icon.check width="16" height="16" /> : <Icon.plus width="16" height="16" />}
            </button>
          )}
          <button type="button" className="ywc-btn end" aria-label="More info" onClick={stop(go)}><Chev /></button>
        </div>
        <div className="ywc-meta">
          {score && <span className="ywc-score"><Icon.star width="12" height="12" />{score}</span>}
          {score && item.meta && <i>·</i>}
          {item.meta && <span>{item.meta}</span>}
        </div>
        {item.genres?.length ? <div className="ywc-genres">{item.genres.slice(0, 3).join(' · ')}</div> : null}
      </div>
    </div>
  )
}
