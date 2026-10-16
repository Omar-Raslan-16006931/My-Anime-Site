import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'
import { animeList, animeByGenre } from '../lib/anime'
import { getPopularMovies, getPopularTV, getTmdbImage } from '../lib/tmdb'
import { normalizeGenres, PRIORITY_CATEGORIES } from '../lib/categories'
import { primeAudio, whoosh, tick, win, sparks } from '../lib/casino'

let pool = null // cached across opens
const rnd = (n) => 1 + Math.floor(Math.random() * n)
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Wide, unfiltered pool (no rating cut-off): several anime lists, a random genre
// page, and random pages of popular movies and series.
async function loadPool() {
  if (pool && pool.length) return pool
  const genre = pickOne(PRIORITY_CATEGORIES)
  const [lists, byGenre, m1, m2, t1, t2] = await Promise.all([
    Promise.all(['popular', 'trending', 'top', 'movies', 'airing'].map((k) => animeList(k, 50).catch(() => []))),
    animeByGenre(genre, rnd(5), 40).catch(() => ({ list: [] })),
    getPopularMovies(rnd(12)).catch(() => null),
    getPopularMovies(rnd(12)).catch(() => null),
    getPopularTV(rnd(12)).catch(() => null),
    getPopularTV(rnd(12)).catch(() => null),
  ])
  const seen = new Set()
  const out = []
  const add = (it) => { if (it.poster && !seen.has(it.id)) { seen.add(it.id); out.push(it) } }
  for (const x of [...lists.flat(), ...(byGenre.list || [])]) {
    add({ id: 'a' + x.mal_id, kind: 'anime', href: `/anime/${x.mal_id}`, title: x.title_english || x.title, poster: x.images?.jpg?.large_image_url, type: 'Anime', score: x.score, genres: normalizeGenres(x.genres) })
  }
  for (const x of [...(m1?.results || []), ...(m2?.results || [])]) {
    add({ id: 'm' + x.id, kind: 'movie', href: `/movie/${x.id}`, title: x.title, poster: x.poster_path ? getTmdbImage(x.poster_path) : null, type: 'Movie', score: x.vote_average, genres: [] })
  }
  for (const x of [...(t1?.results || []), ...(t2?.results || [])]) {
    add({ id: 't' + x.id, kind: 'tv', href: `/tv/${x.id}`, title: x.name, poster: x.poster_path ? getTmdbImage(x.poster_path) : null, type: 'Series', score: x.vote_average, genres: [] })
  }
  pool = out
  return out
}

// Uniform pick across the three kinds first, so anime doesn't drown out movies and series.
function randomIndex(list) {
  const kinds = ['anime', 'movie', 'tv'].filter((k) => list.some((x) => x.kind === k))
  const kind = pickOne(kinds)
  const idx = []
  list.forEach((x, i) => { if (x.kind === kind) idx.push(i) })
  return pickOne(idx)
}

// Full-screen "Surprise me": a poster shuffles through titles, slows down and lands.
export default function SurpriseOverlay() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [shuf, setShuf] = useState(null) // { i, done, n }
  const timer = useRef(null)
  const items = useRef([])
  const posterRef = useRef(null)
  const canvasRef = useRef(null)
  const fx = useRef(null)
  const center = () => {
    const r = posterRef.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 200, h: 300 }
  }

  const roll = useCallback(async () => {
    clearTimeout(timer.current)
    const list = await loadPool()
    items.current = list
    const N = list.length
    if (!N) { setShuf({ i: -1, done: true, n: 0 }); return }
    const fin = randomIndex(list)
    const total = 22 + Math.floor(Math.random() * 5)
    let n = 0
    primeAudio()
    whoosh()
    const land = () => {
      const c = center()
      setShuf({ i: fin, done: true, n, total })
      win()
      const f = fx.current
      if (!f) return
      f.burst(c.x, c.y, 120, { speed: 12, g: 0.22, life: 72, r: 3 })
      f.burst(c.x - c.w / 2, c.y + c.h / 2, 46, { speed: 10, g: 0.2, life: 64, angle: -2.2, spread: 1.2 })
      f.burst(c.x + c.w / 2, c.y + c.h / 2, 46, { speed: 10, g: 0.2, life: 64, angle: -0.95, spread: 1.2 })
      setTimeout(() => f.burst(c.x, c.y - c.h / 2, 70, { speed: 7, g: 0.1, life: 84, r: 2 }), 200)
      setTimeout(() => f.confetti(110), 120)
      setTimeout(() => f.confetti(60), 900)
    }
    const step = () => {
      n += 1
      if (n >= total) { land(); return }
      const c = center()
      setShuf({ i: (fin + n * 7) % N, done: false, n, total, tilt: (Math.random() - 0.5) * 10 })
      tick(n, total)
      const f = fx.current
      f?.burst(c.x + (n % 2 ? c.w / 2 : -c.w / 2), c.y + (Math.random() - 0.5) * c.h, 5 + (n > total * 0.7 ? 5 : 0), { speed: 4 + n * 0.14, g: 0.12, life: 26, r: 1.8, angle: n % 2 ? 0 : Math.PI, spread: 1.6 })
      if (n === total - 1) { timer.current = setTimeout(step, 400); return }
      timer.current = setTimeout(step, 36 + n * n * 0.8)
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
    if (!open || !canvasRef.current) return undefined
    fx.current = sparks(canvasRef.current)
    return () => { fx.current?.stop(); fx.current = null }
  }, [open])

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
  const n = shuf?.n || 0
  const prog = n / (shuf?.total || 24)
  const tilt = done ? 'rotate(0deg) scale(1.06)' : `rotate(${(shuf?.tilt || 0).toFixed(1)}deg) scale(${(0.93 + prog * 0.05).toFixed(3)})`
  const amp = done ? 0 : 2 + prog * 9
  const go = () => { const h = it?.href; close(); if (h) navigate(h) }

  return (
    <div className={'y-shuf' + (done ? ' won' : '')} role="dialog" aria-modal="true" aria-label="Surprise me">
      <canvas ref={canvasRef} className="y-shuf-fx" aria-hidden="true" />
      {done && <span className="y-shuf-flash-screen" aria-hidden="true" />}
      <button type="button" className="y-shuf-x" aria-label="Close" onClick={close}><Icon.close width="18" height="18" /></button>
      <div className="y-eyebrow ac" style={{ fontWeight: 600 }}>{done ? (it ? '★ Jackpot · tonight’s pick ★' : 'Nothing to pick from') : 'Rolling…'}</div>
      {done && <span className="y-shuf-rays" aria-hidden="true" />}
      <div className={'y-shuf-stage' + (done ? ' won' : '')} ref={posterRef} style={{ '--amp': amp + 'px', animationName: done ? 'yoSlam' : n % 2 ? 'yoShakeA' : 'yoShakeB' }}>
        <div className="y-shuf-card" style={{ transform: tilt }}>
          <div className="y-shuf-pop" style={{ animationName: done ? 'none' : n % 2 ? 'yoPopA' : 'yoPopB' }}>
            <span className="y-shuf-frame" aria-hidden="true" />
            <span className="y-shuf-frame b" aria-hidden="true" />
            <div className="y-shuf-poster">
              {it?.poster ? <img src={it.poster} alt="" /> : <div className="y-skel" style={{ width: '100%', height: '100%' }} />}
              {!done && n > 0 && <span key={n} className="y-shuf-flash" />}
            </div>
          </div>
        </div>
      </div>
      <div className="y-shuf-title">{it?.title || (done ? 'Try again in a moment' : '…')}</div>
      {it && (
        <div className="y-shuf-meta">
          {it.type}{it.score ? <> · <Icon.star width="13" height="13" /> {Number(it.score).toFixed(1)}</> : null}{it.genres?.length ? ` · ${it.genres.slice(0, 3).join(' · ')}` : ''}
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
