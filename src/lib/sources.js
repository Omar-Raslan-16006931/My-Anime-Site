// Unified streaming-source registry.
//
// Every source declares which media kinds it supports and how to build a player
// target from a context object. Two target shapes exist:
//   { kind: 'resolve' }    -> player calls the AllManga proxy for a direct stream
//   { kind: 'embed', url } -> player loads url in an <iframe>
//
// ctx: { type:'anime'|'tv'|'movie', tmdbId, imdbId, malId, anilistId,
//        season, episode, title, audio:'sub'|'dub',
//        animeTmdb: { id, imdb, season, episode } | null }  // ani.zip mapping
//
// URL formats were checked against the providers' own docs (Oct 2026):
//   • VidLink anime  → MAL id   (/anime/{MAL}/{ep}/{sub|dub})  — we used to pass
//     an AniList id here, which is why VidLink "never found" anime.
//   • MegaPlay       → MAL or AniList id (/stream/mal|ani/{id}/{ep}/{sub|dub})
//   • VidFast moved  vidfast.pro → vidfast.vc

const dub = (ctx) => ctx.audio === 'dub'
const lang = (ctx) => (dub(ctx) ? 'dub' : 'sub')
const embed = (url) => ({ kind: 'embed', url })

// TMDB id + season/episode for TV-style embeds, regardless of media kind.
const tvTriple = (ctx) => {
  if (ctx.type === 'anime') {
    const m = ctx.animeTmdb
    return m ? { id: m.id, imdb: m.imdb, s: m.season, e: m.episode } : null
  }
  if (!ctx.tmdbId && !ctx.imdbId) return null
  return { id: ctx.tmdbId, imdb: ctx.imdbId, s: ctx.season, e: ctx.episode }
}

export const SOURCES = [
  {
    id: 'vidlink',
    label: 'VidLink',
    badge: 'HD',
    kinds: ['anime', 'tv', 'movie'],
    build: (ctx) => {
      if (ctx.type === 'anime') {
        return ctx.malId ? embed(`https://vidlink.pro/anime/${ctx.malId}/${ctx.episode}/${lang(ctx)}?fallback=true`) : null
      }
      if (ctx.type === 'movie') return ctx.tmdbId ? embed(`https://vidlink.pro/movie/${ctx.tmdbId}`) : null
      return ctx.tmdbId ? embed(`https://vidlink.pro/tv/${ctx.tmdbId}/${ctx.season}/${ctx.episode}`) : null
    },
  },
  {
    id: 'megaplay',
    label: 'MegaPlay',
    badge: 'SUB/DUB',
    kinds: ['anime'],
    build: (ctx) => (ctx.malId ? embed(`https://megaplay.buzz/stream/mal/${ctx.malId}/${ctx.episode}/${lang(ctx)}`) : null),
  },
  {
    // Same library, different id mapping — covers shows MegaPlay hasn't mapped by MAL.
    id: 'megaplay-ani',
    label: 'MegaPlay 2',
    kinds: ['anime'],
    build: (ctx) => (ctx.anilistId ? embed(`https://megaplay.buzz/stream/ani/${ctx.anilistId}/${ctx.episode}/${lang(ctx)}`) : null),
  },
  {
    id: 'videasy',
    label: 'Videasy',
    badge: 'HD',
    kinds: ['anime', 'tv', 'movie'],
    build: (ctx) => {
      if (ctx.type === 'anime') {
        if (ctx.anilistId) return embed(`https://player.videasy.net/anime/${ctx.anilistId}/${ctx.episode}${dub(ctx) ? '?dub=true' : ''}`)
        const t = tvTriple(ctx)
        return t?.id ? embed(`https://player.videasy.net/tv/${t.id}/${t.s}/${t.e}`) : null
      }
      if (ctx.type === 'movie') return ctx.tmdbId ? embed(`https://player.videasy.net/movie/${ctx.tmdbId}`) : null
      return ctx.tmdbId ? embed(`https://player.videasy.net/tv/${ctx.tmdbId}/${ctx.season}/${ctx.episode}`) : null
    },
  },
  {
    id: 'vidfast',
    label: 'VidFast',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') return ctx.tmdbId ? embed(`https://vidfast.vc/movie/${ctx.tmdbId}`) : null
      const t = tvTriple(ctx)
      return t?.id ? embed(`https://vidfast.vc/tv/${t.id}/${t.s}/${t.e}`) : null
    },
  },
  {
    id: 'vidsrccc',
    label: 'VidSrc.cc',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') return ctx.tmdbId ? embed(`https://vidsrc.cc/v2/embed/movie/${ctx.tmdbId}`) : null
      const t = tvTriple(ctx)
      return t?.id ? embed(`https://vidsrc.cc/v2/embed/tv/${t.id}/${t.s}/${t.e}`) : null
    },
  },
  {
    id: 'allmanga',
    label: 'AllManga',
    badge: 'DIRECT',
    kinds: ['anime'],
    build: (ctx) => (ctx.title ? { kind: 'resolve' } : null),
  },
  {
    id: 'vidsrc',
    label: 'VidSrc',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') {
        const id = ctx.tmdbId || ctx.imdbId
        return id ? embed(`https://vidsrc.xyz/embed/movie?tmdb=${id}`) : null
      }
      const t = tvTriple(ctx)
      return t?.id ? embed(`https://vidsrc.xyz/embed/tv?tmdb=${t.id}&season=${t.s}&episode=${t.e}`) : null
    },
  },
  {
    id: 'autoembed',
    label: 'AutoEmbed',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') return ctx.tmdbId ? embed(`https://player.autoembed.cc/embed/movie/${ctx.tmdbId}`) : null
      const t = tvTriple(ctx)
      return t?.id ? embed(`https://player.autoembed.cc/embed/tv/${t.id}/${t.s}/${t.e}`) : null
    },
  },
  {
    id: '2embed',
    label: '2Embed',
    kinds: ['tv', 'movie'],
    build: (ctx) => {
      if (ctx.type === 'movie') return ctx.tmdbId ? embed(`https://www.2embed.cc/embed/${ctx.tmdbId}`) : null
      const t = tvTriple(ctx)
      return t?.id ? embed(`https://www.2embed.cc/embedtv/${t.id}&s=${t.s}&e=${t.e}`) : null
    },
  },
]

// Display / fallback order per media kind (most reliable first).
const ORDER = {
  anime: ['vidlink', 'megaplay', 'videasy', 'megaplay-ani', 'allmanga', 'vidfast', 'vidsrccc', 'vidsrc', 'autoembed'],
  tv: ['videasy', 'vidlink', 'vidfast', 'vidsrccc', 'vidsrc', 'autoembed', '2embed'],
  movie: ['videasy', 'vidlink', 'vidfast', 'vidsrccc', 'vidsrc', 'autoembed', '2embed'],
}

export const DEFAULT_SOURCE = { anime: 'vidlink', tv: 'videasy', movie: 'videasy' }

// Returns the available sources for a context (ordered), each with a target.
export function availableSources(ctx) {
  const order = ORDER[ctx.type] || []
  return SOURCES
    .filter((s) => s.kinds.includes(ctx.type))
    .map((s) => ({ source: s, target: s.build(ctx) }))
    .filter((x) => x.target)
    .sort((a, b) => {
      const ai = order.indexOf(a.source.id)
      const bi = order.indexOf(b.source.id)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
}

// Remember the source that last worked for the user, per media kind.
const prefKey = (type) => `aw:src:${type}`
export function getPreferredSource(type) {
  try { return localStorage.getItem(prefKey(type)) || DEFAULT_SOURCE[type] || 'vidlink' } catch { return DEFAULT_SOURCE[type] || 'vidlink' }
}
export function setPreferredSource(type, id) {
  try { localStorage.setItem(prefKey(type), id) } catch { /* ignore */ }
}

export const DOWNLOAD_SOURCES = [
  {
    id: 'dlhub',
    label: 'DLHub',
    buildUrl: (title) => `https://dlhub.cc/search?q=${encodeURIComponent(title)}`,
  },
  {
    id: 'videodownloader',
    label: 'VideoDownloader',
    buildUrl: (title) => `https://videodownloader.site/?q=${encodeURIComponent(title)}`,
  },
  {
    id: 'nyaa',
    label: 'Nyaa',
    buildUrl: (title) => `https://nyaa.si/?q=${encodeURIComponent(title)}`,
  },
  {
    id: '1337x',
    label: '1337x',
    buildUrl: (title) => `https://1337x.to/search/${encodeURIComponent(title)}/1/`,
  },
]
