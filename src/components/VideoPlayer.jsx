import { useState } from 'react'

export default function VideoPlayer({ malId, title, episode, onClose }) {
  const [src, setSrc] = useState('dropfile')
  const [dub, setDub] = useState(false)

 const buildURL = () => {
  const audio = dub ? 'dub' : 'sub'
  switch (src) {
    case 'vidsrc':
      return `https://vidsrc.to/embed/anime/${malId}/1-${episode}`
    case 'animepahe':
      return `https://animepahe.ru/anime/${malId}`
    case 'gogoanime':
      return `https://gogoanime.tel/search.html?keyword=${encodeURIComponent(title)}`
    case 'zoro':
      return `https://aniwatch.to/search?keyword=${encodeURIComponent(title)}`
    default: // dropfile
      return `https://dropfile.cc/player/tv/mal-${malId}/1/${episode}?audio=${audio}&lang=en`
  }
}

  const watchNow = () => {
    window.open(buildURL(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', width: '100%', maxWidth: 520,
        overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Now Selected</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Episode <span style={{ color: 'var(--accent)' }}>{episode}</span></div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{title}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg3)', color: 'var(--text2)',
            width: 34, height: 34, borderRadius: '50%', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)'
          }}>×</button>
        </div>

        {/* Controls */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Sub / Dub */}
          <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 999, padding: 3, gap: 3, width: 'fit-content' }}>
            {['SUB', 'DUB'].map((t, i) => (
              <button key={t} onClick={() => setDub(i === 1)} style={{
                padding: '4px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                letterSpacing: '0.05em',
                background: dub === (i === 1) ? 'var(--accent)' : 'transparent',
                color: dub === (i === 1) ? '#fff' : 'var(--text2)',
                transition: 'all 0.2s'
              }}>{t}</button>
            ))}
          </div>

          {/* Source selector */}
          <select value={src} onChange={e => setSrc(e.target.value)} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 8, padding: '8px 12px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none'
          }}>
            <option value="dropfile">dropfile.cc</option>
            <option value="vidsrc">vidsrc.to</option>
            <option value="animepahe">animepahe.ru</option>
          </select>

          {/* Play button */}
          <button onClick={watchNow} style={{
            background: 'var(--accent)', color: '#fff',
            padding: '14px', borderRadius: 999, fontWeight: 700,
            fontSize: 15, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(225,29,72,0.35)',
            transition: 'background 0.2s, transform 0.2s'
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Watch Now
          </button>

          {/* Hint */}
          <div style={{
            fontSize: 12, color: 'var(--text2)', display: 'flex',
            alignItems: 'center', gap: 6, padding: '8px 12px',
            background: 'var(--bg3)', borderRadius: 6
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            Opens in a new tab · works on all sources, no iframe blocking
          </div>
        </div>
      </div>
    </div>
  )
}