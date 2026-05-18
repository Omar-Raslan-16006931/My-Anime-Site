import { useState, useEffect } from 'react'
import { storage, STORAGE_KEYS, isElectron } from './utils/storage'
import { supabase } from './supabase'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import Home from './pages/Home'
import Watchlist from './pages/Watchlist'
import Profile from './pages/Profile'
import AnimeDetail from './pages/AnimeDetail'
import CurrentlyWatching from './pages/CurrentlyWatching'
import DownloadsPage from './pages/SiteDownloadsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [currentPage, setCurrentPage] = useState(() => storage.get(STORAGE_KEYS.START_PAGE) || 'home')
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedAnime, setSelectedAnime] = useState(null)
  const [downloads, setDownloads] = useState([])
  const [progress, setProgress] = useState(() => storage.get(STORAGE_KEYS.WATCH_PROGRESS) || {})
  const [watched, setWatched] = useState(() => storage.get(STORAGE_KEYS.WATCHED) || {})
  const [history, setHistory] = useState(() => storage.get(STORAGE_KEYS.HISTORY) || [])
  const [highlightId, setHighlightId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    storage.set(STORAGE_KEYS.START_PAGE, currentPage)
  }, [currentPage])

  useEffect(() => {
    storage.set(STORAGE_KEYS.WATCH_PROGRESS, progress)
  }, [progress])

  useEffect(() => {
    storage.set(STORAGE_KEYS.WATCHED, watched)
  }, [watched])

  useEffect(() => {
    storage.set(STORAGE_KEYS.HISTORY, history)
  }, [history])

  useEffect(() => {
    let cancelled = false

    const loadDownloads = async () => {
      if (!isElectron || !window.electron?.getDownloads) return
      try {
        const data = await window.electron.getDownloads()
        if (!cancelled) setDownloads(data || [])
      } catch {}
    }

    loadDownloads()

    const onDownloadProgress = window.electron?.onDownloadProgress?.((update) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((item) => item.id === update.id)
        if (idx === -1) return [update, ...prev]
        const next = [...prev]
        next[idx] = { ...next[idx], ...update }
        return next
      })
      if (update?.status === 'completed') setHighlightId(update.id)
    })

    const onUpdateProgress = window.electron?.onUpdateProgress?.(() => {})

    return () => {
      cancelled = true
      if (window.electron?.offDownloadProgress) window.electron.offDownloadProgress(onDownloadProgress)
      if (window.electron?.offUpdateProgress) window.electron.offUpdateProgress(onUpdateProgress)
    }
  }, [])

  const fetchProfile = async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    setProfile(data)
    setLoading(false)
  }

  const handleSelectAnime = (anime) => {
    setSelectedAnime(anime)
    window.scrollTo(0, 0)
  }

  const handleBack = () => {
    setSelectedAnime(null)
  }

  const handleAuthRequired = () => setShowAuth(true)

  const handleHistory = (item) => {
    if (!item?.id) return
    setHistory((prev) => {
      const filtered = prev.filter((entry) => entry.id !== item.id)
      return [{ ...item, ts: Date.now() }, ...filtered].slice(0, 100)
    })
  }

  const handleSaveProgress = (key, seconds) => {
    if (!key) return
    setProgress((prev) => ({ ...prev, [key]: seconds }))
  }

  const handleMarkWatched = (key) => {
    if (!key) return
    setWatched((prev) => ({ ...prev, [key]: true }))
  }

  const handleMarkUnwatched = (key) => {
    if (!key) return
    setWatched((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleDeleteDownload = async (id) => {
    setDownloads((prev) => prev.filter((item) => item.id !== id))
    if (window.electron?.deleteDownload) {
      await window.electron.deleteDownload({ id, filePath: null })
    }
  }

  const handleUpdateDownload = (id, patch) => {
    setDownloads((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading__card">
          <div className="app-loading__eyebrow">Anime Vault</div>
          <div className="app-loading__title">Loading your library</div>
          <div className="app-loading__subtitle">Syncing your profile and local state.</div>
        </div>
      </div>
    )
  }

  const pageProps = {
    user,
    onAuthRequired: handleAuthRequired,
    onSelect: handleSelectAnime,
  }

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        profile={profile}
        onAuthClick={() => setShowAuth(true)}
        currentPage={currentPage}
        setCurrentPage={(page) => {
          setCurrentPage(page)
          setSelectedAnime(null)
          setSearchOpen(false)
        }}
        onOpenDownloads={() => setCurrentPage('downloads')}
        onOpenSettings={() => setCurrentPage('settings')}
        isElectron={isElectron}
      />

      {selectedAnime ? (
        <main className="page-frame page-frame--wide">
          <AnimeDetail
            anime={selectedAnime}
            user={user}
            onAuthRequired={handleAuthRequired}
            onBack={handleBack}
          />
        </main>
      ) : (
        <main className="page-frame">
          {currentPage === 'home' && <Home {...pageProps} />}
          {currentPage === 'watchlist' && <Watchlist {...pageProps} />}
          {currentPage === 'profile' && user && (
            <Profile user={user} profile={profile} setProfile={setProfile} />
          )}
          {currentPage === 'currently-watching' && <CurrentlyWatching {...pageProps} />}
          {currentPage === 'downloads' && (
            <DownloadsPage
              onGoHome={() => setCurrentPage('home')}
            />
          )}
          {currentPage === 'settings' && (
            <SettingsPage
              user={user}
              profile={profile}
              setCurrentPage={setCurrentPage}
              onOpenDownloads={() => setCurrentPage('downloads')}
              onOpenAuth={() => setShowAuth(true)}
            />
          )}
        </main>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}