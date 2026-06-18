import { DOWNLOAD_SOURCES } from '../lib/sources'

export default function DownloadLinks({ title }) {
  if (!title) return null
  return (
    <div className="dl-row">
      <span className="dl-label">Download:</span>
      {DOWNLOAD_SOURCES.map((s) => (
        <a key={s.id} className="dl-chip" href={s.buildUrl(title)} target="_blank" rel="noopener noreferrer">
          ⬇ {s.label}
        </a>
      ))}
    </div>
  )
}
