import { useNavigate } from 'react-router-dom'

// Landscape card (banner art, title + info on the art) used by the home rows.
// On phones the same card turns into a normal poster card with the title and
// info underneath, so phone rows are vertical cards only.
// item: { href, banner, poster, title, meta, progress(0..1) }
export default function WideCard({ item }) {
  const navigate = useNavigate()
  const go = () => item.href && navigate(item.href)
  const bar = item.progress > 0 && (
    <div className="wcard-progress"><span style={{ width: `${Math.round(item.progress * 100)}%` }} /></div>
  )

  return (
    <div className="wcard" onClick={go} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go() }}>
      <div className="wcard-art">
        {item.banner && <img className="wcard-banner" src={item.banner} alt="" loading="lazy" />}
        {item.poster && <img className="wcard-poster" src={item.poster} alt="" loading="lazy" />}
        <div className="wcard-over">
          <b>{item.title}</b>
          {item.meta && <small>{item.meta}</small>}
        </div>
        {bar}
      </div>
      <div className="wcard-below">
        <b>{item.title}</b>
        {item.meta && <small>{item.meta}</small>}
      </div>
    </div>
  )
}
