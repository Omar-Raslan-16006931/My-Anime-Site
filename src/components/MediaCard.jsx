import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

// Unified poster card used across rows and grids.
// item: { href, poster, title, sub, score, kind, rank, progress(0..1), fav, onFav }
//  • In rows (and everywhere on phones) the title sits on the poster.
//  • In PC grids the title and details sit under the poster.
//  • `rank` renders the outlined Top-10 numeral behind the poster.
export default function MediaCard({ item, onClick }) {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const go = () => {
    if (onClick) return onClick(item)
    if (item.href) navigate(item.href)
  }
  const detail = [item.kind || item.sub].filter(Boolean)
  const score = item.score ? Number(item.score).toFixed(1) : null

  return (
    <div
      className={'card' + (item.rank ? ' ranked' : '')}
      onClick={go}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') go() }}
    >
      {item.rank ? <span className="card-rank" aria-hidden="true">{item.rank}</span> : null}
      <div className="card-poster">
        {item.poster ? (
          <img
            ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setLoaded(true) }}
            src={item.poster}
            alt={item.title}
            loading="lazy"
            className={'img-fade' + (loaded ? ' is-loaded' : '')}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
            <Icon.film width="28" height="28" />
          </div>
        )}

        <div className="card-over">
          <b>{item.title}</b>
          <small>
            {detail.join(' · ')}
            {detail.length && score ? ' · ' : ''}
            {score ? <><Icon.star width="10" height="10" /> {score}</> : null}
          </small>
        </div>

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
      <div className="card-sub">
        {detail.join(' · ')}
        {detail.length && score ? ' · ' : ''}
        {score ? <><Icon.star width="10" height="10" /> {score}</> : null}
      </div>
    </div>
  )
}
