import { useEffect, useMemo, useState } from 'react'
import { BACKUP_KEYS, collectBackupData, restoreBackupData } from '../utils/backup'
import { checkForUpdates } from '../utils/updates'
import { STORAGE_KEYS, storage } from '../utils/storage'

const START_PAGES = [
  { value: 'home', label: 'Home' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'currently-watching', label: 'Currently Watching' },
  { value: 'profile', label: 'Profile' },
]

const ACCENTS = [
  '#e11d48',
  '#f97316',
  '#0ea5e9',
  '#22c55e',
  '#8b5cf6',
  '#f43f5e',
]

function Section({ eyebrow, title, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section__header">
        <div className="settings-section__eyebrow">{eyebrow}</div>
        <h2 className="settings-section__title">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Toggle({ label, checked, onChange, description }) {
  return (
    <label className="settings-toggle">
      <div>
        <div className="settings-toggle__label">{label}</div>
        {description && <div className="settings-toggle__description">{description}</div>}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export default function SettingsPage({ user, profile, setCurrentPage, onOpenDownloads, onOpenAuth }) {
  const [accentColor, setAccentColor] = useState(() => storage.get(STORAGE_KEYS.ACCENT_COLOR) || '#e11d48')
  const [fontSize, setFontSize] = useState(() => storage.get(STORAGE_KEYS.FONT_SIZE) || 16)
  const [compactMode, setCompactMode] = useState(() => storage.get(STORAGE_KEYS.COMPACT_MODE) ?? false)
  const [reduceAnimations, setReduceAnimations] = useState(() => storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS) ?? false)
  const [historyEnabled, setHistoryEnabled] = useState(() => storage.get(STORAGE_KEYS.HISTORY_ENABLED) ?? true)
  const [startPage, setStartPage] = useState(() => storage.get(STORAGE_KEYS.START_PAGE) || 'home')
  const [cacheSize, setCacheSize] = useState(null)
  const [blockStats, setBlockStats] = useState(null)
  const [updateState, setUpdateState] = useState({ status: 'idle', message: '' })
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor)
    document.documentElement.style.setProperty('--accent2', accentColor)
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`)
    document.body.dataset.compact = compactMode ? 'true' : 'false'
    document.body.dataset.reduceMotion = reduceAnimations ? 'true' : 'false'
    storage.set(STORAGE_KEYS.ACCENT_COLOR, accentColor)
    storage.set(STORAGE_KEYS.FONT_SIZE, Number(fontSize))
    storage.set(STORAGE_KEYS.COMPACT_MODE, compactMode)
    storage.set(STORAGE_KEYS.REDUCE_ANIMATIONS, reduceAnimations)
    storage.set(STORAGE_KEYS.HISTORY_ENABLED, historyEnabled)
    storage.set(STORAGE_KEYS.START_PAGE, startPage)
  }, [accentColor, fontSize, compactMode, reduceAnimations, historyEnabled, startPage])

  useEffect(() => {
    let mounted = true
    if (window.electron?.getCacheSize) {
      window.electron.getCacheSize().then((res) => {
        if (mounted) setCacheSize(res?.bytes ?? 0)
      })
    }
    if (window.electron?.getBlockStats) {
      window.electron.getBlockStats().then((stats) => {
        if (mounted) setBlockStats(stats)
      })
    }
    return () => {
      mounted = false
    }
  }, [])

  const backupSummary = useMemo(() => `${BACKUP_KEYS.length} keys`, [])

  const exportBackup = () => {
    const data = collectBackupData()
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anime-vault-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSaveMessage('Backup exported.')
  }

  const importBackup = async (file) => {
    if (!file) return
    const text = await file.text()
    const parsed = JSON.parse(text)
    const data = parsed?.data || parsed
    restoreBackupData(data)
    setSaveMessage('Backup imported. Refresh the page to reload cached settings.')
  }

  const clearCaches = async () => {
    if (window.electron?.clearAppCache) {
      await window.electron.clearAppCache()
      setCacheSize(0)
      setSaveMessage('Cache cleared.')
    }
  }

  const checkUpdates = async () => {
    setUpdateState({ status: 'loading', message: 'Checking for updates...' })
    try {
      const info = await checkForUpdates()
      setUpdateState({
        status: info.hasUpdate ? 'update' : 'ok',
        message: info.hasUpdate
          ? `Update available: ${info.latest}`
          : `You are on the latest release (${info.current}).`,
      })
    } catch (error) {
      setUpdateState({ status: 'error', message: error.message })
    }
  }

  return (
    <div className="settings-layout">
      <header className="page-hero page-hero--settings">
        <div>
          <div className="page-hero__eyebrow">Settings</div>
          <h1 className="page-hero__title">Tune the site to your workflow</h1>
          <p className="page-hero__subtitle">
            Appearance, startup behavior, backups, and Electron-only tools are all grouped here.
          </p>
        </div>
        <div className="page-hero__meta">
          <div className="meta-chip">Backup keys: {backupSummary}</div>
          <div className="meta-chip">Cache: {cacheSize === null ? '...' : `${(cacheSize / 1024 / 1024).toFixed(1)} MB`}</div>
          <div className="meta-chip">Blocked requests: {blockStats?.total ?? 0}</div>
        </div>
      </header>

      {!user && (
        <div className="notice-card">
          <div>
            <strong>Signed out.</strong> Profile and library syncing are disabled until you log in.
          </div>
          <button className="btn btn-primary" onClick={onOpenAuth}>Sign in</button>
        </div>
      )}

      <div className="settings-grid">
        <Section eyebrow="Appearance" title="Visual style">
          <div className="settings-stack">
            <div>
              <div className="settings-label">Accent color</div>
              <div className="swatch-row">
                {ACCENTS.map((color) => (
                  <button
                    key={color}
                    className={`swatch${accentColor === color ? ' swatch--active' : ''}`}
                    style={{ background: color }}
                    onClick={() => setAccentColor(color)}
                    aria-label={`Use ${color} accent`}
                  />
                ))}
              </div>
            </div>

            <label className="settings-slider">
              <div className="settings-label">Font size</div>
              <input
                type="range"
                min="14"
                max="18"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <span>{fontSize}px</span>
            </label>

            <Toggle label="Compact mode" checked={compactMode} onChange={setCompactMode} description="Reduce card spacing and overall density." />
            <Toggle label="Reduce motion" checked={reduceAnimations} onChange={setReduceAnimations} description="Tone down transitions and motion effects." />
          </div>
        </Section>

        <Section eyebrow="Startup" title="Where the app opens">
          <div className="settings-stack">
            <div>
              <div className="settings-label">Default page</div>
              <div className="pill-grid">
                {START_PAGES.map((page) => (
                  <button
                    key={page.value}
                    className={`pill${startPage === page.value ? ' pill--active' : ''}`}
                    onClick={() => setStartPage(page.value)}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            </div>
            <Toggle label="Keep history enabled" checked={historyEnabled} onChange={setHistoryEnabled} description="Store recently opened items and download watch history." />
            <div className="settings-hint">
              Signed in as {profile?.username || user?.email || 'guest'}
            </div>
          </div>
        </Section>

        <Section eyebrow="Data" title="Backups and cache">
          <div className="settings-stack">
            <div className="settings-row">
              <div>
                <div className="settings-label">Export backup</div>
                <div className="settings-copy">Download your local site settings and history as a JSON file.</div>
              </div>
              <button className="btn btn-secondary" onClick={exportBackup}>Export</button>
            </div>

            <label className="settings-file">
              <input type="file" accept="application/json" onChange={(e) => importBackup(e.target.files?.[0])} />
              <span>Import backup</span>
            </label>

            <div className="settings-row">
              <div>
                <div className="settings-label">Clear cache</div>
                <div className="settings-copy">Reset Electron browser cache and local media caches.</div>
              </div>
              <button className="btn btn-secondary" onClick={clearCaches} disabled={!window.electron?.clearAppCache}>Clear</button>
            </div>

            {saveMessage && <div className="settings-status">{saveMessage}</div>}
          </div>
        </Section>

        <Section eyebrow="Desktop" title="Electron tools">
          <div className="settings-stack">
            <div className="settings-row">
              <div>
                <div className="settings-label">Downloads hub</div>
                <div className="settings-copy">Open the desktop download manager from the site shell.</div>
              </div>
              <button className="btn btn-primary" onClick={onOpenDownloads}>Open downloads</button>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">Update checker</div>
                <div className="settings-copy">Check the desktop release channel for newer builds.</div>
              </div>
              <button className="btn btn-secondary" onClick={checkUpdates}>Check updates</button>
            </div>

            <div className={`settings-status settings-status--${updateState.status}`}>
              {updateState.message || 'No update check run yet.'}
            </div>
          </div>
        </Section>
      </div>

      <div className="settings-footer">
        <button className="btn btn-ghost" onClick={() => setCurrentPage('home')}>Back to home</button>
      </div>
    </div>
  )
}
