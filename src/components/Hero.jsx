import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

// Billboard hero. item: { title, backdrop, score, year, genres[], desc, href, kind }
export default function Hero({ item, onPlay }) {
  const navigate = useNavigate()
  if (!item) return null

  return (
    <div className="hero">
      <div className="hero-bg">
        {item.backdrop && <img src={item.backdrop} alt={item.title} />}
      </div>
      <div className="hero-overlay" />
      <div className="hero-content fade-in">
        {item.kind && <div className="hero-brand" style={{ marginBottom: 12 }}>{item.kind}</div>}
        <h1 className="hero-title">{item.title}</h1>
        <div className="hero-meta">
          {item.score ? <span className="gold"><Icon.star width="13" height="13" style={{ verticalAlign: -1 }} /> {Number(item.score).toFixed(1)}</span> : null}
          {item.year ? <span>{item.year}</span> : null}
          {(item.genres || []).slice(0, 3).map((g) => <span key={g}>{g}</span>)}
        </div>
        {item.desc && <p className="hero-desc">{item.desc}</p>}
        <div className="hero-actions">
          <button className="btn btn-light" onClick={() => (onPlay ? onPlay(item) : navigate(item.href))}>
            <Icon.play width="18" height="18" /> Play
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(item.href)}>
            <Icon.info width="18" height="18" /> More Info
          </button>
        </div>
      </div>
    </div>
  )
}
