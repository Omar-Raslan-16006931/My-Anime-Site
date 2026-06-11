import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import Toasts from './components/Toasts'
import Home from './pages/Home'
import Anime from './pages/Anime'
import Watchlist from './pages/Watchlist'
import Profile from './pages/Profile'
import AnimeDetail from './pages/AnimeDetail'
import CurrentlyWatching from './pages/CurrentlyWatching'
import Movies from './pages/Movies'
import TVShows from './pages/TVShows'
import MovieDetail from './pages/MovieDetail'
import TVDetail from './pages/TVDetail'

// Main tab order — used for slide direction and mobile swipe navigation.
const TABS = ['/', '/anime', '/tv', '/movies', '/watchlist']

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  const lastUserIdRef = useRef(null)
  const initializedRef = useRef(false)

  const location = useLocation()
  const navigate = useNavigate()
  const prevPathRef = useRef(location.pathname)

  const fetchProfile = useCallback(async (id) => {
    if (!id) {
      setProfile(null)
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (!error) setProfile(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      const nextUser = session?.user ?? null
      setUser(nextUser)

      if (nextUser?.id) {
        lastUserIdRef.current = nextUser.id
        await fetchProfile(nextUser.id)
      } else {
        lastUserIdRef.current = null
        setProfile(null)
        setLoading(false)
      }
      initializedRef.current = true
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || !initializedRef.current) return

      const nextUser = session?.user ?? null
      const nextUserId = nextUser?.id ?? null
      const prevUserId = lastUserIdRef.current

      if (event === 'SIGNED_OUT') {
        lastUserIdRef.current = null
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      // IMPORTANT: token refreshes fire when the browser tab regains focus.
      // Re-setting the user object there remounts pages mid-playback, so only
      // touch state when the actual user changes (or their profile data did).
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (nextUserId && nextUserId !== prevUserId) {
          lastUserIdRef.current = nextUserId
          setUser(nextUser)
          setLoading(true)
          await fetchProfile(nextUserId)
        }
        return
      }

      if (event === 'USER_UPDATED' && nextUserId) {
        lastUserIdRef.current = nextUserId
        setUser(nextUser)
        await fetchProfile(nextUserId)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // Swipe left/right between main tabs on mobile. Ignores gestures that start
  // inside horizontally scrollable UI (carousels, players, inputs).
  useEffect(() => {
    let sx = 0, sy = 0, t0 = 0, valid = false

    const onStart = (e) => {
      valid = false
      if (window.innerWidth >= 880) return
      if (e.target.closest('.row-track, .modal, .player-frame, .tabs, .ep-thumb, input, select, textarea, iframe, video')) return
      valid = true
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
      t0 = Date.now()
    }
    const onEnd = (e) => {
      if (!valid) return
      const dx = e.changedTouches[0].clientX - sx
      const dy = e.changedTouches[0].clientY - sy
      if (Date.now() - t0 > 600 || Math.abs(dx) < 72 || Math.abs(dy) > 56) return
      const idx = TABS.indexOf(location.pathname)
      if (idx === -1) return
      const next = idx + (dx < 0 ? 1 : -1)
      if (next >= 0 && next < TABS.length) navigate(TABS[next])
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [location.pathname, navigate])

  // Slide direction for tab-to-tab transitions; plain fade everywhere else.
  const prevIdx = TABS.indexOf(prevPathRef.current)
  const curIdx = TABS.indexOf(location.pathname)
  const slide = prevIdx !== -1 && curIdx !== -1 && prevIdx !== curIdx
    ? (curIdx > prevIdx ? ' slide-left' : ' slide-right')
    : ''
  useEffect(() => { prevPathRef.current = location.pathname }, [location.pathname])

  const handleAuthRequired = useCallback(() => setShowAuth(true), [])

  if (loading) {
    return (
      <div className="app-boot">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar user={user} profile={profile} onAuthClick={() => setShowAuth(true)} />

      <div key={location.pathname} className={'route-anim' + slide}>
        <Routes location={location}>
          <Route path="/" element={<Home user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/anime" element={<Anime />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/tv" element={<TVShows />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="/tv/:id" element={<TVDetail />} />
          <Route path="/watchlist" element={<Watchlist user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/anime/:id" element={<AnimeDetail user={user} onAuthRequired={handleAuthRequired} />} />
          <Route
            path="/profile"
            element={user ? <Profile user={user} profile={profile} setProfile={setProfile} /> : <Navigate to="/" replace />}
          />
          <Route
            path="/currently-watching"
            element={user ? <CurrentlyWatching user={user} onAuthRequired={handleAuthRequired} /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <Toasts />
    </div>
  )
}
