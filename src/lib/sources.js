// Unified streaming-source registry.
//
// Every source declares which media kinds it supports and how to build a player
// target from a context object. Two target shapes exist:
//   { kind: 'resolve' }  -> player calls the AllManga proxy for a direct stream
//   { kind: 'embed', url } -> player loads url in an <iframe>
//
// ctx: { type:'anime'|'tv'|'movie', tmdbId, imdbId, malId, anilistId,
//        season, episode, title, audio:'sub'|'dub',
//        animeTmdb: { id, imdb, season, episode } | null }  // ani.zip mapping
//
// animeTmdb lets TMDB-keyed (TV) sources play anime with correct season mapping.

const dub = (ctx) => ctx.audio === 'dub'

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
  // ── AllManga (direct stream, anime) ────────────────────────────────────────
  {
    id: 'allmanga',
    label: 'AllManga',
    badge: 'DIRECT',
    kinds: ['anime'],
    build: (ctx) => (ctx.title ? { kind: 'resolve' } : null),
  },

  // ── StreamBert sources ─────────────────────────────────────────────────────
  {
    id: 'videasy',
    label: 'Videasy',
    badge: 'HD',
    kinds: ['anime', 'tv', 'movie'],
    build: (ctx) => {
      if (ctx.type === 'anime') {
        if (ctx.anilistId) return { kind: 'embed', url: `https://player.videasy.net/anime/${ctx.anilistId}/${ctx.episode}${dub(ctx) ? '?dub=true' : ''}` }
        const t = tvTriple(ctx)
        return t ? { kind: 'embed', url: `https://player.videasy.net/tv/${t.id}/${t.s}/${t.e}` } : null
      }
      if (ctx.type === 'movie' && ctx.tmdbId) return { kind: 'embed', url: `https://player.videasy.net/movie/${ctx.tmdbId}` }
      if (ctx.type === 'tv' && ctx.tmdbId) return { kind: 'embed', url: `https://player.videasy.net/tv/${ctx.tmdbId}/${ctx.season}/${ctx.episode}` }
      return null
    },
  },
  {
    id: 'vidsrc',
    label: 'VidSrc',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') {
        const id = ctx.tmdbId || ctx.imdbId
        return id ? { kind: 'embed', url: `https://vidsrc.to/embed/movie/${id}` } : null
      }
      const t = tvTriple(ctx)
      return t ? { kind: 'embed', url: `https://vidsrc.to/embed/tv/${t.id || t.imdb}/${t.s}/${t.e}` } : null
    },
  },
  {
    id: '2embed',
    label: '2Embed',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') {
        return ctx.tmdbId ? { kind: 'embed', url: `https://www.2embed.cc/embed/${ctx.tmdbId}` } : null
      }
      const t = tvTriple(ctx)
      return t?.id ? { kind: 'embed', url: `https://www.2embed.cc/embedtv/${t.id}&s=${t.s}&e=${t.e}` } : null
    },
  },

  // ── Extra embeds for breadth ───────────────────────────────────────────────
  {
    id: 'vidlink',
    label: 'VidLink',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'anime' && ctx.anilistId) {
        return { kind: 'embed', url: `https://vidlink.pro/anime/${ctx.anilistId}/${ctx.episode}/${dub(ctx) ? 'dub' : 'sub'}` }
      }
      if (ctx.type === 'movie') {
        return ctx.tmdbId ? { kind: 'embed', url: `https://vidlink.pro/movie/${ctx.tmdbId}` } : null
      }
      const t = tvTriple(ctx)
      return t?.id ? { kind: 'embed', url: `https://vidlink.pro/tv/${t.id}/${t.s}/${t.e}` } : null
    },
  },
  {
    id: 'vidfast',
    label: 'VidFast',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') {
        return ctx.tmdbId ? { kind: 'embed', url: `https://vidfast.pro/movie/${ctx.tmdbId}` } : null
      }
      const t = tvTriple(ctx)
      return t?.id ? { kind: 'embed', url: `https://vidfast.pro/tv/${t.id}/${t.s}/${t.e}` } : null
    },
  },
  {
    id: 'dropfile',
    label: 'Dropfile',
    kinds: ['anime'],
    build: (ctx) => {
      const id = ctx.malId ? `mal-${ctx.malId}` : ctx.anilistId ? `anilist-${ctx.anilistId}` : null
      if (!id) return null
      return { kind: 'embed', url: `https://dropfile.cc/player/tv/${id}/${ctx.season}/${ctx.episode}?audio=${ctx.audio}` }
    },
  },
]

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

// Returns the available sources for a context, each with a resolved target.
export function availableSources(ctx) {
  return SOURCES
    .filter((s) => s.kinds.includes(ctx.type))
    .map((s) => ({ source: s, target: s.build(ctx) }))
    .filter((x) => x.target)
}

export const DEFAULT_SOURCE = {
  anime: 'allmanga',
  tv: 'videasy',
  movie: 'videasy',
}
