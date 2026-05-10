import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import Home from './pages/Home'
import Watchlist from './pages/Watchlist'
import Profile from './pages/Profile'
import AnimeDetail from './pages/AnimeDetail'
import CurrentlyWatching from './pages/CurrentlyWatching'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [currentPage, setCurrentPage] = useState('home')
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedAnime, setSelectedAnime] = useState(null)

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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--text2)',
        fontSize: 18
      }}>
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
        currentPage={currentPage}
        setCurrentPage={(page) => {
          setCurrentPage(page)
          setSelectedAnime(null)
        }}
      />

      {selectedAnime ? (
        <AnimeDetail
          anime={selectedAnime}
          user={user}
          onAuthRequired={handleAuthRequired}
          onBack={handleBack}
        />
      ) : (
        <>
          {currentPage === 'home' && (
            <Home
              user={user}
              onAuthRequired={handleAuthRequired}
              onSelect={handleSelectAnime}
            />
          )}

          {currentPage === 'watchlist' && (
            <Watchlist
              user={user}
              onAuthRequired={handleAuthRequired}
              onSelect={handleSelectAnime}
            />
          )}

          {currentPage === 'profile' && user && (
            <Profile
              user={user}
              profile={profile}
              setProfile={setProfile}
            />
          )}

          {currentPage === 'currently-watching' && user && (
            <CurrentlyWatching
              user={user}
              onAuthRequired={handleAuthRequired}
              onSelect={handleSelectAnime}
            />
          )}
        </>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}