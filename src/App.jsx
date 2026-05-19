import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import Home from './pages/Home'
import Watchlist from './pages/Watchlist'
import Profile from './pages/Profile'
import AnimeDetail from './pages/AnimeDetail'
import CurrentlyWatching from './pages/CurrentlyWatching'
import Movies from './pages/Movies'
import TVShows from './pages/TVShows'
import MovieDetail from './pages/MovieDetail'
import TVDetail from './pages/TVDetail'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  const lastUserIdRef = useRef(null)
  const initializedRef = useRef(false)

  const fetchProfile = useCallback(async (id) => {
    if (!id) {
      setProfile(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (!error) {
      setProfile(data)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

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

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      const nextUser = session?.user ?? null
      const nextUserId = nextUser?.id ?? null
      const prevUserId = lastUserIdRef.current

      if (!initializedRef.current) return

      if (event === 'SIGNED_OUT') {
        lastUserIdRef.current = null
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUser(nextUser)

        if (nextUserId && nextUserId !== prevUserId) {
          lastUserIdRef.current = nextUserId
          setLoading(true)
          await fetchProfile(nextUserId)
        }

        return
      }

      if (event === 'INITIAL_SESSION') {
        return
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const handleAuthRequired = () => setShowAuth(true)

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--text2)',
          fontSize: 18
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar
        user={user}
        profile={profile}
        onAuthClick={() => setShowAuth(true)}
      />

      <Routes>
        <Route
          path="/"
          element={
            <Home
              user={user}
              onAuthRequired={handleAuthRequired}
            />
          }
        />

        <Route
          path="/movies"
          element={<Movies />}
        />

        <Route
          path="/tv"
          element={<TVShows />}
        />

        <Route
          path="/movie/:id"
          element={<MovieDetail />}
        />

        <Route
          path="/tv/:id"
          element={<TVDetail />}
        />

        <Route
          path="/watchlist"
          element={
            <Watchlist
              user={user}
              onAuthRequired={handleAuthRequired}
            />
          }
        />

        <Route
          path="/anime/:id"
          element={
            <AnimeDetail
              user={user}
              onAuthRequired={handleAuthRequired}
            />
          }
        />

        <Route
          path="/profile"
          element={
            user ? (
              <Profile
                user={user}
                profile={profile}
                setProfile={setProfile}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/currently-watching"
          element={
            user ? (
              <CurrentlyWatching
                user={user}
                onAuthRequired={handleAuthRequired}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}