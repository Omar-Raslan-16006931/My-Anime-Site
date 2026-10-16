import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'
import { animeList } from '../lib/anime'
import { getPopularMovies, getPopularTV, getTmdbImage } from '../lib/tmdb'
import { normalizeGenres } from '../lib/categories'

const MIN = 7
let pool = null // cached across opens

async function loadPool() {
  if (pool && pool.length) return pool
  const [a, m, t] = await Promise.all([
    animeList('popular', 40).catch(() => []),
    getPopularMovies().catch(() => null),
    getPopularTV().catch(() => null),
  ])
  const out = []
  for (const x of a || []) {
    const poster = x.images?.jpg?.large_image_url
    if (poster && (x.score || 0) >= MIN) out.push({ id: 'a' + x.mal_id, href: `/anime/${x.mal_id}`, title: x.title_english || x.title, poster, type: 'Anime', score: x.score, genres: normalizeGenres(x.genres) })
  }
  for (const x of m?.results || []) {
    if (x.poster_path && (x.vote_average || 0) >= MIN) out.push({ id: 'm' + x.id, href: `/movie/${x.id}`, title: x.title, poster: getTmdbImage(x.poster_path), type: 'Movie', score: x.vote_average, genres: [] })
  }
  for (const x of t?.results || []) {
    if (x.poster_path && (x.vote_average || 0) >= MIN) out.push({ id: 't' + x.id, href: `/tv/${x.id}`, title: x.name, poster: getTmdbImage(x.poster_path), type: 'Series', score: x.vote_average, genres: [] })
  }
  pool = out
  return out
}

// Full-screen "Surprise me": a poster shuffles through titles, slows down and lands.
export default function SurpriseOverlay() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [shuf, setShuf] = useState(null) // { i, done, n }
  const timer = useRef(null)
  const items = useRef([])

  const roll = useCallback(async () => {
    clearTimeout(timer.current)
    const list = await loadPool()
    items.current = list
    const N = list.length
    if (!N) { setShuf({ i: -1, done: true, n: 0 }); return }
    const fin = Math.floor(Math.random() * N)
    const total = 14 + Math.floor(Math.random() * 6)
    let n = 0
    const step = () => {
      n += 1
      if (n >= total) { setShuf({ i: fin, done: true, n }); return }
      setShuf({ i: (fin + n * 7) % N, done: false, n })
      timer.current = setTimeout(step, 45 + n * n * 1.4)
    }
    step()
  }, [])

  const close = useCallback(() => { clearTimeout(timer.current); setOpen(false); setShuf(null) }, [])

  useEffect(() => {
    const onOpen = () => { setOpen(true); roll() }
    window.addEventListener('yoru:surprise', onOpen)
    return () => { window.removeEventListener('yoru:surprise', onOpen); clearTimeout(timer.current) }
  }, [roll])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, close])

  if (!open) return null
  const it = shuf && shuf.i >= 0 ? items.current[shuf.i] : null
  const done = !!shuf?.done
  const tilt = done ? 'scale(1.04)' : shuf && shuf.n % 2 ? 'rotate(-4deg) scale(.95)' : 'rotate(4deg) scale(.95)'
  const go = () => { const h = it?.href; close(); if (h) navigate(h) }

  return (
    <div className="y-shuf" role="dialog" aria-modal="true" aria-label="Surprise me">
      <button type="button" className="y-shuf-x" aria-label="Close" onClick={close}><Icon.close width="18" height="18" /></button>
      <div className="y-eyebrow ac" style={{ fontWeight: 600 }}>{done ? (it ? 'Tonight’s pick' : 'Nothing to pick from') : 'Rolling'}</div>
      <div className="y-shuf-poster" style={{ transform: tilt }}>
        {it?.poster ? <img src={it.poster} alt="" /> : <div className="y-skel" style={{ width: '100%', height: '100%' }} />}
      </div>
      <div className="y-shuf-title">{it?.title || (done ? 'Try again in a moment' : '…')}</div>
      {it && (
        <div className="y-shuf-meta">
          {it.type} · <Icon.star width="13" height="13" /> {Number(it.score).toFixed(1)}{it.genres?.length ? ` · ${it.genres.slice(0, 3).join(' · ')}` : ''}
        </div>
      )}
      {done && (
        <div className="y-shuf-btns">
          {it && <button type="button" className="y-btn ac" onClick={go}><Icon.play width="16" height="16" />Play</button>}
          <button type="button" className="y-btn out" onClick={roll}>Roll again</button>
        </div>
      )}
    </div>
  )
}
