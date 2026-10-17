import { useEffect, useRef } from 'react'

// Right-hand column of the PC player page: season picker + the episode list.
// items: [{ num, title, thumb, meta, seen }]   seasons: [{ value, label }] | null
export default function PlayerEpisodes({ heading = 'Episodes', seasons, season, onSeason, items, current, onPick, loading }) {
  const cur = useRef(null)
  useEffect(() => { cur.current?.scrollIntoView({ block: 'center' }) }, [current, season, items.length])
  return (
    <div className="pe">
      <div className="pe-head">
        <h3>{heading}{items.length ? <span>{items.length}</span> : null}</h3>
        {seasons && seasons.length > 1 && (
          <select className="select-min pe-season" value={season} onChange={(e) => onSeason?.(Number(e.target.value))} aria-label="Season">
            {seasons.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>
      <div className="pe-list">
        {loading ? <div className="pe-empty"><span className="spinner" /></div> : items.length === 0 ? <div className="pe-empty">No episodes found.</div> : items.map((it) => {
          const on = it.num === current
          return (
            <button key={it.num} ref={on ? cur : null} type="button" className={'pe-ep' + (on ? ' on' : '') + (it.seen ? ' seen' : '')} onClick={() => onPick?.(it.num)}>
              <span className="pe-still">
                {it.thumb ? <img src={it.thumb} alt="" loading="lazy" /> : null}
                <b>{it.num}</b>
              </span>
              <span className="pe-txt">
                <span className="pe-title">{it.title}</span>
                {it.meta ? <span className="pe-meta">{it.meta}</span> : null}
              </span>
              {on ? <span className="pe-now" aria-label="Playing"><i /><i /><i /></span> : it.seen ? <svg className="pe-seen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Watched"><path d="M20 6 9 17l-5-5" /></svg> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
