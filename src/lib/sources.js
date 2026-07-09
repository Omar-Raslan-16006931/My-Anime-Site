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
  // Kept as a selectable "direct" option and as an automatic fallback, but no
  // longer the default — its upstream (api.allanime.day) is flaky and often
  // returns no match, which is what produced the "not found" errors.
  {
    id: 'allmanga',
    label: 'AllManga',
    badge: 'DIRECT',
    kinds: ['anime'],
    build: (ctx) => (ctx.title ? { kind: 'resolve' } : null),
  },

  // ── Primary embeds (verified live domains) ─────────────────────────────────
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
    id: 'vidlink',
    label: 'VidLink',
    badge: 'HD',
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
    id: 'vidsrccc',
    label: 'VidSrc.cc',
    kinds: ['anime', 'tv', 'movie'],
    build: (ctx) => {
      if (ctx.type === 'anime') {
        return ctx.anilistId
          ? { kind: 'embed', url: `https://vidsrc.cc/v2/embed/anime/${ctx.anilistId}/${ctx.episode}/${dub(ctx) ? 'dub' : 'sub'}` }
          : null
      }
      if (ctx.type === 'movie' && ctx.tmdbId) return { kind: 'embed', url: `https://vidsrc.cc/v2/embed/movie/${ctx.tmdbId}` }
      const t = tvTriple(ctx)
      return t?.id ? { kind: 'embed', url: `https://vidsrc.cc/v2/embed/tv/${t.id}/${t.s}/${t.e}` } : null
    },
  },
  {
    id: 'vidsrc',
    label: 'VidSrc',
    kinds: ['tv', 'movie', 'anime'],
    // vidsrc.to was seized/dead (cause of the infinite spinner). vidsrc.xyz is
    // the canonical live host and uses a query-parameter API.
    build: (ctx) => {
      if (ctx.type === 'movie') {
        const id = ctx.tmdbId || ctx.imdbId
        return id ? { kind: 'embed', url: `https://vidsrc.xyz/embed/movie?tmdb=${id}` } : null
      }
      const t = tvTriple(ctx)
      const id = t?.id || t?.imdb
      return id ? { kind: 'embed', url: `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${t.s}&episode=${t.e}` } : null
    },
  },
  {
    id: 'embedsu',
    label: 'Embed.su',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') {
        return ctx.tmdbId ? { kind: 'embed', url: `https://embed.su/embed/movie/${ctx.tmdbId}` } : null
      }
      const t = tvTriple(ctx)
      return t?.id ? { kind: 'embed', url: `https://embed.su/embed/tv/${t.id}/${t.s}/${t.e}` } : null
    },
  },
  {
    id: 'autoembed',
    label: 'AutoEmbed',
    kinds: ['tv', 'movie', 'anime'],
    build: (ctx) => {
      if (ctx.type === 'movie') {
        return ctx.tmdbId ? { kind: 'embed', url: `https://player.autoembed.cc/embed/movie/${ctx.tmdbId}` } : null
      }
      const t = tvTriple(ctx)
      return t?.id ? { kind: 'embed', url: `https://player.autoembed.cc/embed/tv/${t.id}/${t.s}/${t.e}` } : null
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
    id: '2embed',
    label: '2Embed',
    kinds: ['tv', 'movi