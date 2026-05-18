import { useState, useEffect } from 'react'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (id) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    setProfile(data)
    setLoading(false)
  }

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