import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

// Unified poster card used across rows and grids.
// item: { href, poster, title, sub, score, kind, progress(0..1), fav, onFav }
export default function MediaCard({ item, onClick }) {
  const navigate = useNavigate()
  const go = () => {
    if (onClick) return onClick(item)
    if (item.href) navigate(item.href)
  }

  return (
    <div className="card" onClick={go}>
      <div className="card-poster">
        {item.poster ? (
          <img src={item.poster} alt={item.title} loading="lazy" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
            <Icon.film width="28" height="28" />
          </div>
        )}

        {item.score ? (
          <span className="card-score"><Icon.star width="10" height="10" />{Number(item.score).toFixed(1)}</span>
        ) : null}
        {item.kind ? <span className="card-kind">{item.kind}</span> : null}

        {item.onFav && (
          <button
            className={'card-fav' + (item.fav ? ' on' : '')}
            onClick={(e) => { e.stopPropagation(); item.onFav(item) }}
            aria-label="Toggle list"
          >
            {item.fav ? <Icon.check width="16" height="16" /> : <Icon.plus width="16" height="16" />}
          </button>
        )}

        {item.progress > 0 && (
          <div className="card-progress"><span style={{ width: `${Math.round(item.progress * 100)}%` }} /></div>
        )}
      </div>

      <div className="card-title">{item.title}</div>
      {item.sub ? <div className="card-sub">{item.sub}</div> : null}
    </div>
  )
}
