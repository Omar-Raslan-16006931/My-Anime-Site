import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icons'
import {
  isNative, subscribe, getDownloads, getActive, deleteDownload, playableSrc, formatSize,
} from '../lib/offline'

// Stable snapshots for useSyncExternalStore.
let snap = { done: [], active: [] }
const read = () => {
  const done = getDownloads()
  const active = getActive()
  if (JSON.stringify(done) !== JSON.stringify(snap.done) || JSON.stringify(active) !== JSON.stringify(snap.active)) {
    snap = { done, active }
  }
  return snap
}

export default function Downloads() {
  const navigate = useNavigate()
  const { done, active } = useSyncExternalStore(subscribe, read, read)
  const [playing, setPlaying] = useState(null) // { src, d }

  if (!isNative) {
    return (
      <div className="page">
        <h1 className="section-title" style={{ marginBottom: 14 }}>Downloads</h1>
        <div className="empty">
          <div className="emoji">📲</div>
          <p>Offline downloads work in the AniWave iPhone app.</p>
        </div>
      </div>
    )
  }

  const open = async (d) => {
    try { setPlaying({ src: await playableSrc(d), d }) } catch { /* file missing */ }
  }
  const remove = async (d) => {
    if (window.confirm(`Delete episode ${d.episode} of ${d.title}?`)) await deleteDownload(d.id)
  }

  return (
    <div className="page">
      <h1 className="section-title" style={{ marginBottom: 14 }}>Downloads</h1>

      {active.length > 0 && (
        <section className="dlp-sec">
          <h2 className="dlp-h">Downloading</h2>
          <div className="dlp-list">
            {active.map((a) => {
              const pct = a.total ? Math.min(100, Math.round((a.bytes / a.total) * 100)) : null
              return (
                <div key={a.id} className="dlp-item">
                  <div className="dlp-thumb">{a.poster && <img src={a.poster} alt="" />}</div>
                  <div className="dlp-body">
                    <div className="dlp-title">{a.title}</div>
                    <div className="dlp-meta">
                      Episode {a.episode} · {a.stage === 'Downloading'
                        ? (pct != null ? `${pct}% · ${formatSize(a.bytes)} of ${formatSize(a.total)}` : formatSize(a.bytes) || 'Starting…')
                        : a.stage}
                    </div>
                    <div className="dlp-bar"><span style={{ width: `${pct ?? 6}%` }} /></div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {done.length === 0 && active.length === 0 ? (
        <div className="empty">
          <div className="emoji">⬇️</div>
          <p>No downloads yet.</p>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>Play an anime episode and tap <strong>Save offline</strong>.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => navigate('/anime')}>Browse anime</button>
        </div>
      ) : done.length > 0 && (
        <section className="dlp-sec">
          <h2 className="dlp-h">Saved on this iPhone</h2>
          <div className="dlp-list">
            {done.map((d) => (
              <div key={d.id} className="dlp-item">
                <button className="dlp-thumb dlp-play" onClick={() => open(d)} aria-label={`Play episode ${d.episode}`}>
                  {d.poster && <img src={d.poster} alt="" />}
                  <span className="dlp-play-ic"><Icon.play width="16" height="16" /></span>
                </button>
                <button className="dlp-body dlp-open" onClick={() => open(d)}>
                  <div className="dlp-title">{d.title}</div>
                  <div className="dlp-meta">
                    Episode {d.episode} · {String(d.audio || 'sub').toUpperCase()}{d.size ? ` · ${formatSize(d.size)}` : ''}
                  </div>
                </button>
                <button className="icon-btn dlp-del" onClick={() => remove(d)} aria-label="Delete download">
                  <Icon.trash width="16" height="16" />
                </button>
              </div>
            ))}
          </div>
          <p className="dlp-note">Files are also in the Files app under On My iPhone › AniWave.</p>
        </section>
      )}

      {playing && <OfflinePlayer src={playing.src} d={playing.d} onClose={() => setPlaying(null)} />}
    </div>
  )
}

function OfflinePlayer({ src, d, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div className="modal player-modal" onClick={onClose}>
      <div className="modal-card player-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Offline · Episode {d.episode}</div>
            <div className="ttl">{d.title}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon.close width="18" height="18" /></button>
        </div>
        <div className="player-frame">
          <video src={src} controls autoPlay playsInline />
        </div>
      </div>
    </div>
  )
}
