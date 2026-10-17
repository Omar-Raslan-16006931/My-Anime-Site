import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchAnime } from '../lib/anime'
import { searchMovies, searchTV, getTmdbImage } from '../lib/tmdb'

// Desktop top-bar search: results appear right under the box as you type (anime, movies, TV).
// Enter opens the full Explore results; Esc or a click outside closes it.
export default function QuickSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [res, setRes] = useState(null) // null = idle/loading
  const [hi, setHi] = useState(-1)
  const box = useRef(null)
  const seq = useRef(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRes(null); return undefined }
    const id = ++seq.current
    const t = setTimeout(async () => {
      const [a, m, tv] = await Promise.all([
        searchAnime(term, 5).catch(() => []),
        searchMovies(term).catch(() => null),
        searchTV(term).catch(() => null),
      ])
      if (id !== seq.current) return
      const tm = (r, type) => (r?.results || []).slice(0, 4).map((x) => ({
        key: `${type}:${x.id}`, href: `/${type}/${x.id}`, title: x.title || x.name, type: type === 'movie' ? 'Movie' : 'TV',
        year: (x.release_date || x.first_air_date || '').slice(0, 4), poster: x.poster_path ? getTmdbImage(x.poster_path, 'w92') : null, pop: x.popularity || 0,
      }))
      const an = (a || []).slice(0, 4).map((x, i) => ({
        key: `anime:${x.mal_id}`, href: `/anime/${x.mal_id}`, title: x.title_english || x.title, type: 'Anime', year: x.year || '',
        poster: x.images?.jpg?.image_url || x.images?.jpg?.large_image_url || null, pop: 1000 - i,
      }))
      // Interleave so every kind shows up near the top.
      const lists = [an, tm(m, 'movie'), tm(tv, 'tv')]
      const out = []
      for (let i = 0; i < 4; i++) lists.forEach((l) => { if (l[i]) out.push(l[i]) })
      setRes(out.slice(0, 8)); setHi(-1)
    }, 260)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!open) return undefined
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])

  const go = (href) => { setOpen(false); setQ(''); setRes(null); document.activeElement?.blur?.(); navigate(href) }
  const submit = (e) => {
    e.preventDefault()
    if (hi >= 0 && res?.[hi]) return go(res[hi].href)
    const v = q.trim()
    go(v ? `/search?q=${encodeURIComponent(v)}` : '/search')
  }
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur() }
    else if (e.key === 'ArrowDown' && res?.length) { e.preventDefault(); setHi((h) => (h + 1) % res.length) }
    else if (e.key === 'ArrowUp' && res?.length) { e.preventDefault(); setHi((h) => (h <= 0 ? res.length - 1 : h - 1)) }
  }
  const showing = open && q.trim().length >= 2

  return (
    <div className="y-qs" ref={box}>
      <form className={'y-search' + (q ? ' has-text' : '')} onSubmit={submit} role="search">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="6" cy="6" r="4.5" /><line x1="9.5" y1="9.5" x2="13" y2="13" /></svg>
        <input type="search" enterKeyHint="search" placeholder="Titles, genres, people" value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          aria-label="Search anime, shows and movies" aria-expanded={showing} aria-controls="y-qs-list" autoComplete="off" />
      </form>
      {showing && (
        <div className="y-qs-panel" id="y-qs-list" role="listbox">
          {res === null ? (
            <div className="y-qs-msg"><span className="spinner" style={{ width: 16, height: 16 }} />Searching…</div>
          ) : res.length === 0 ? (
            <div className="y-qs-msg">No results for “{q.trim()}”</div>
          ) : (
            <>
              {res.map((r, i) => (
                <button type="button" key={r.key} role="option" aria-selected={i === hi} className={'y-qs-row' + (i === hi ? ' hi' : '')} onMouseEnter={() => setHi(i)} onClick={() => go(r.href)}>
                  <span className="y-qs-art">{r.poster && <img src={r.poster} alt="" />}</span>
                  <span className="y-qs-txt"><b>{r.title}</b><small>{r.type}{r.year ? ` · ${r.year}` : ''}</small></span>
                </button>
              ))}
              <button type="button" className="y-qs-all" onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}>See all results for “{q.trim()}”</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
