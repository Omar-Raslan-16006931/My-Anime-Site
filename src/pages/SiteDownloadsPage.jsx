import { useMemo, useState } from 'react'
import VideoPlayer from '../components/VideoPlayer'
import { readSiteDownloads, removeSiteDownload, writeSiteDownloads } from '../utils/siteDownloads'

function formatTime(ts) {
  if (!ts) return 'just now'
  const minutes = Math.floor((Date.now() - ts) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function SiteDownloadsPage({ onGoHome }) {
  const [downloads, setDownloads] = useState(() => readSiteDownloads())
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(null)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return downloads
    return downloads.filter((item) => {
      return [item.title, item.source, String(item.episode), item.type]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    })
  }, [downloads, search])

  const handleRemove = (id) => {
    const next = removeSiteDownload(id)
    setDownloads(next)
  }

  const clearAll = () => {
    writeSiteDownloads([])
    setDownloads([])
  }

  return (
    <div className="downloads-page">
      <header className="page-hero">
        <div>
          <div className="page-hero__eyebrow">Downloads</div>
          <h1 className="page-hero__title">Your saved stream queue</h1>
          <p className="page-hero__subtitle">
            Saved entries reopen in the built-in player. This queue stores URLs and watch state locally in your browser.
          </p>
        </div>
        <div className="page-hero__meta">
          <div className="meta-chip">{downloads.length} saved</div>
          <div className="meta-chip">Built-in player</div>
        </div>
      </header>

      <div className="downloads-toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved entries"
        />
        <button className="btn btn-secondary" onClick={clearAll}>
          Clear all
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="notice-card">
          <div>
            <strong>No saved downloads yet.</strong> Open an episode in the player and use Save to Downloads.
          </div>
          <button className="btn btn-primary" onClick={onGoHome}>
            Browse shows
          </button>
        </div>
      ) : (
        <div className="downloads-grid">
          {filtered.map((item) => (
            <article className="download-card" key={item.id}>
              <div className="download-card__poster">
                {item.poster ? <img src={item.poster} alt={item.title} /> : <div className="download-card__fallback">No art</div>}
              </div>
              <div className="download-card__body">
                <div className="download-card__topline">
                  <h3>{item.title}</h3>
                  <span>{formatTime(item.createdAt)}</span>
                </div>
                <div className="download-card__meta">
                  <span>Ep. {item.episode || 'N/A'}</span>
                  <span>{item.source}</span>
                  <span>{item.dub ? 'Dub' : 'Sub'}</span>
                </div>
                <div className="download-card__actions">
                  <button className="btn btn-primary" onClick={() => setActive(item)}>Play</button>
                  <button className="btn btn-secondary" onClick={() => handleRemove(item.id)}>Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {active && (
        <VideoPlayer
          open
          malId={active.malId}
          title={active.title}
          episode={active.episode}
          initialSource={active.source}
          initialDub={active.dub}
          initialUrl={active.url}
          onClose={() => setActive(null)}
          onSave={(entry) => {
            const next = removeSiteDownload(active.id)
            const updated = [{ ...entry, poster: active.poster, type: active.type }, ...next]
            writeSiteDownloads(updated)
            setDownloads(updated)
          }}
        />
      )}
    </div>
  )
}