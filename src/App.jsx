import { useState, useEffect, useRef, useCallback } from 'react'
import { weekSchedule } from './lib/schedule'
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { profileActions, useProfiles, profileKeyOf } from './lib/profiles'
import { supabase } from './supabase'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import Toasts from './components/Toasts'
import Home from './pages/Home'
import Anime from './pages/Anime'
import Me from './pages/Me'
import AnimeDetail from './pages/AnimeDetail'
import Movies from './pages/Movies'
import TVShows from './pages/TVShows'
import MovieDetail from './pages/MovieDetail'
import TVDetail from './pages/TVDetail'
import Search from './pages/Search'
import Downloads from './pages/Downloads'
import Category from './pages/Category'
import Simulcast from './pages/Simulcast'
import Profiles from './pages/Profiles'
import Welcome from './pages/Welcome'
import SurpriseOverlay from './components/SurpriseOverlay'
import { PreviewBar } from './components/ThemePreview'
import ProfileGreeting from './components/ProfileGreeting'
import PageStack from './components/PageStack'
import { initVault, subscribeVault, vaultLocked } from './lib/vault'
import { useSyncExternalStore } from 'react'

// Shown when this account uses Private history but this device hasn't been
// unlocked yet (history + list look empty until then).
function VaultBanner() {
  const locked = useSyncExternalStore(subscribeVault, vaultLocked, vaultLocked)
  const location = useLocation()
  if (!locked || location.pathname === '/profile') return null
  return (
    <Link to="/profile" className="vault-banner">
      Your private history is locked on this device. <strong>Unlock</strong>
    </Link>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  const lastUserIdRef = useRef(null)
  const initializedRef = useRef(false)

  const location = useLocation()
  const profSnap = useProfiles()
  const dataKey = profileKeyOf(profSnap) // switching profile remounts the pages so each shows its own data

  // Pull (or push) this account's "Who's watching?" profiles whenever the signed-in user changes.
  useEffect(() => { profileActions.sync(user?.id || null) }, [user?.id])

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

  const handleAuthRequired = useCallback(() => setShowAuth(true), [])

  // Load this account's Private history setting (and auto-unlock if this
  // device already has the key).
  useEffect(() => { initVault(user?.id) }, [user?.id])
  // Warm the airing schedule so Home / Simulcast already have it.
  useEffect(() => {
    const t = setTimeout(() => {
      const d = new Date(); d.setHours(0, 0, 0, 0)
      weekSchedule(d, 10, 7).catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [])

  // The welcome overlay is a sibling of the loading switch, so it stays mounted across it: on screen
  // from the very first frame, with neither the boot spinner nor placeholders showing before it.
  return (
    <>
    {loading ? (
      <div className="app-boot">
        <span className="spinner" />
      </div>
    ) : (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar user={user} profile={profile} />
      <VaultBanner />

      <PageStack key={dataKey} location={location} render={(loc) => (
        <Routes location={loc}>
          <Route path="/" element={<Home user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/search" element={<Search user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/me" element={<Me user={user} profile={profile} setProfile={setProfile} onAuthRequired={handleAuthRequired} onAuthClick={() => setShowAuth(true)} />} />
          <Route path="/recommend" element={<Navigate to="/search?ai=1" replace />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/category/:name" element={<Category />} />
          <Route path="/browse" element={<Navigate to={{ pathname: '/search', search: location.search }} replace />} />
          <Route path="/simulcast" element={<Simulcast />} />
          <Route path="/profiles" element={<Profiles user={user} profile={profile} />} />
          <Route path="/welcome" element={<Welcome user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/anime" element={<Anime />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/tv" element={<TVShows />} />
          <Route path="/movie/:id" element={<MovieDetail user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/tv/:id" element={<TVDetail user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/watchlist" element={<Navigate to="/me?s=list" replace />} />
          <Route path="/anime/:id" element={<AnimeDetail user={user} onAuthRequired={handleAuthRequired} />} />
          <Route path="/profile" element={<Navigate to="/me?s=account" replace />} />
          <Route path="/currently-watching" element={<Navigate to="/me" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )} />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <SurpriseOverlay />
      <PreviewBar />
      <Toasts />
    </div>
    )}
    <ProfileGreeting profile={profile} />
    </>
  )
}
