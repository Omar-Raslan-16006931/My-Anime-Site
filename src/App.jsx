import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import Search from './pages/Search'
import Downloads from './pages/Downloads'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [routeLoading, setRouteLoading] = useState(false)

  const lastUserIdRef = useRef(null)
  const initializedRef = useRef(false)

  const location = useLocation()

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

  // (Removed: swipe-between-tabs gesture. On phones it fired by accident while
  // scrolling carousels/pages and caused random page jumps.)

  // Forced 0.5s loading state on every route change so pages don't snap in.
  // Also reset scroll to the top so a new page never opens mid-scroll.
  useEffect(() => {
    window.scrollTo(0, 0)
    setRouteLoading(true)
    const t = setTimeout(() => setRouteLoading(false), 500)
    return () => clearTimeout(t)
  }, [location.pathname])

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

      {routeLoading && (
        <div key={'rl-' + location.pathname} className="route-loader"><span className="spinner lg" /></div>
      )}

      <div key={location.pathname} className="route-anim">
        <Routes location={location}>
          <Route path="/" element={<Home user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/search" element={<Search />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/anime" element={<Anime />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/tv" element={<TVShows />} />
          <Route path="/movie/:id" element={<MovieDetail user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/tv/:id" element={<TVDetail user={user} onAuthRequired={handleAuthRequired} />} />
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
