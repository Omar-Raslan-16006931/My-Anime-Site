import { useMemo, useState } from 'react'

function buildSourceUrl({ source, malId, title, episode, dub }) {
  const audio = dub ? 'dub' : 'sub'
  switch (source) {
    case 'vidsrc':
      return `https://vidsrc.to/embed/anime/${malId}/1-${episode}`
    case 'animepahe':
      return `https://animepahe.ru/anime/${malId}`
    case 'gogoanime':
      return `https://gogoanime.tel/search.html?keyword=${encodeURIComponent(title)}`
    case 'zoro':
      return `https://aniwatch.to/search?keyword=${encodeURIComponent(title)}`
    default:
      return `https://dropfile.cc/player/tv/mal-${malId}/1/${episode}?audio=${audio}&lang=en`
  }
}

export default function VideoPlayer({
  open,
  malId,
  title,
  episode,
  initialSource = 'dropfile',
  initialDub = false,
  initialUrl = '',
  onClose,
  onSave,
}) {
  const [source, setSource] = useState(initialSource)
  const [dub, setDub] = useState(initialDub)

  const url = useMemo(() => {
    if (initialUrl) return initialUrl
    return buildSourceUrl({ source, malId, title, episode, dub })
  }, [initialUrl, source, malId, title, episode, dub])

  const watchNow = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!open) return null

  return (
    <div className="player-overlay">
      <div className="player-modal">
        <div className="player-modal__header">
          <div>
            <div className="player-modal__eyebrow">Now Playing</div>
            <div className="player-modal__title">Episode <span>{episode}</span></div>
            <div className="player-modal__subtitle">{title}</div>
          </div>
          <button className="player-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="player-modal__body">
          <div className="player-frame-wrap">
            <iframe
              title={`${title} episode ${episode}`}
              src={url}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="player-controls">
            <div className="segmented">
              {['SUB', 'DUB'].map((label, index) => (
                <button
                  key={label}
                  onClick={() => setDub(index === 1)}
                  className={`segmented__btn${dub === (index === 1) ? ' segmented__btn--active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <select value={source} onChange={(e) => setSource(e.target.value)} className="player-select">
              <option value="dropfile">dropfile.cc</option>
              <option value="vidsrc">vidsrc.to</option>
              <option value="animepahe">animepahe.ru</option>
              <option value="gogoanime">gogoanime</option>
              <option value="zoro">zoro</option>
            </select>

            <button className="btn btn-primary player-action" onClick={watchNow}>Open in new tab</button>

            {onSave && (
              <button
                className="btn btn-secondary player-action"
                onClick={() => onSave({
                  id: `${malId}_${episode}_${source}_${dub ? 'dub' : 'sub'}`,
                  malId,
                  title,
                  episode,
                  source,
                  dub,
                  url,
                  createdAt: Date.now(),
                })}
              >
                Save to Downloads
              </button>
            )}

            <div className="player-note">The player is embedded in the page. If a source blocks iframes, use the new tab button.</div>
          </div>
        </div>
      </div>
    </div>
  )
}