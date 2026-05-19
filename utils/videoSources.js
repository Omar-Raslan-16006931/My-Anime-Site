const DEFAULT_DROPFILE_BASE = 'https://dropfile.cc'
const DEFAULT_VIDSRC_BASE = 'https://vidsrc.to'

export const QUALITY_OPTIONS = ['auto', '360p', '480p', '720p', '1080p']

function normalizeQuality(quality = 'auto') {
  const q = String(quality || 'auto').toLowerCase()
  return QUALITY_OPTIONS.includes(q) ? q : 'auto'
}

function buildUrl(base, path, params = {}) {
  const url = new URL(path, base)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

export function buildDropfileId(idType, id) {
  if (!id && id !== 0) return null

  switch (idType) {
    case 'imdb':
      return String(id)
    case 'tmdb':
      return String(id)
    case 'mal':
      return `mal-${id}`
    case 'anilist':
      return `anilist-${id}`
    default:
      return null
  }
}

export function getDropfilePlayerUrl({
  idType,
  id,
  season = 1,
  episode = 1,
  audio = 'sub',
  lang = 'en',
  quality = 'auto',
  type = 'tv',
  baseUrl = DEFAULT_DROPFILE_BASE
}) {
  const finalId = buildDropfileId(idType, id)
  if (!finalId) return null

  const normalizedQuality = normalizeQuality(quality)
  const params = { audio, lang }

  if (normalizedQuality !== 'auto') {
    params.quality = normalizedQuality
  }

  return buildUrl(baseUrl, `/player/${type}/${finalId}/${season}/${episode}`, params)
}

export function getVidsrcMovieUrl(
  id,
  { quality = 'auto', baseUrl = DEFAULT_VIDSRC_BASE } = {}
) {
  if (!id && id !== 0) return null

  const normalizedQuality = normalizeQuality(quality)
  const params = {}

  if (normalizedQuality !== 'auto') {
    params.quality = normalizedQuality
  }

  return buildUrl(baseUrl, `/embed/movie/${id}`, params)
}

export function getVidsrcTvUrl(
  id,
  season = 1,
  episode = 1,
  { quality = 'auto', baseUrl = DEFAULT_VIDSRC_BASE } = {}
) {
  if (!id && id !== 0) return null

  const normalizedQuality = normalizeQuality(quality)
  const params = {}

  if (normalizedQuality !== 'auto') {
    params.quality = normalizedQuality
  }

  return buildUrl(baseUrl, `/embed/tv/${id}/${season}/${episode}`, params)
}

function normalizeTitle(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/\bseason\s+\d+\b/gi, '')
    .replace(/\bpart\s+\d+\b/gi, '')
    .replace(/\bcour\s+\d+\b/gi, '')
    .replace(/\bepisode\s+\d+\b/gi, '')
    .replace(/\bep\s+\d+\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleFallbacks(title = '') {
  const normalized = normalizeTitle(title)
  const stripped = normalized
    .replace(/\bseason\s+\d+\b/gi, '')
    .replace(/\bpart\s+\d+\b/gi, '')
    .trim()

  return Array.from(
    new Set([
      title,
      normalized,
      stripped,
      stripped.replace(/\bfinal\b/gi, '').trim()
    ])
  ).filter(Boolean)
}

export function getDropfileCandidates({
  imdbId,
  tmdbId,
  malId,
  anilistId,
  season = 1,
  episode = 1,
  audio = 'sub',
  lang = 'en',
  quality = 'auto',
  type = 'tv'
}) {
  const candidates = []

  if (imdbId) {
    candidates.push({
      provider: 'dropfile',
      idType: 'imdb',
      id: imdbId,
      season,
      episode,
      audio,
      lang,
      quality,
      type,
      url: getDropfilePlayerUrl({
        idType: 'imdb',
        id: imdbId,
        season,
        episode,
        audio,
        lang,
        quality,
        type
      })
    })
  }

  if (tmdbId) {
    candidates.push({
      provider: 'dropfile',
      idType: 'tmdb',
      id: tmdbId,
      season,
      episode,
      audio,
      lang,
      quality,
      type,
      url: getDropfilePlayerUrl({
        idType: 'tmdb',
        id: tmdbId,
        season,
        episode,
        audio,
        lang,
        quality,
        type
      })
    })
  }

  if (malId) {
    candidates.push({
      provider: 'dropfile',
      idType: 'mal',
      id: malId,
      season,
      episode,
      audio,
      lang,
      quality,
      type,
      url: getDropfilePlayerUrl({
        idType: 'mal',
        id: malId,
        season,
        episode,
        audio,
        lang,
        quality,
        type
      })
    })
  }

  if (anilistId) {
    candidates.push({
      provider: 'dropfile',
      idType: 'anilist',
      id: anilistId,
      season,
      episode,
      audio,
      lang,
      quality,
      type,
      url: getDropfilePlayerUrl({
        idType: 'anilist',
        id: anilistId,
        season,
        episode,
        audio,
        lang,
        quality,
        type
      })
    })
  }

  return candidates.filter(Boolean)
}

export function getVidsrcCandidates({
  mediaType,
  imdbId,
  tmdbId,
  season = 1,
  episode = 1,
  quality = 'auto'
}) {
  const candidates = []

  if (mediaType === 'movie') {
    if (imdbId) {
      candidates.push({
        provider: 'vidsrc',
        idType: 'imdb',
        id: imdbId,
        url: getVidsrcMovieUrl(imdbId, { quality })
      })
    }

    if (tmdbId) {
      candidates.push({
        provider: 'vidsrc',
        idType: 'tmdb',
        id: tmdbId,
        url: getVidsrcMovieUrl(tmdbId, { quality })
      })
    }
  }

  if (mediaType === 'tv') {
    if (imdbId) {
      candidates.push({
        provider: 'vidsrc',
        idType: 'imdb',
        id: imdbId,
        url: getVidsrcTvUrl(imdbId, season, episode, { quality })
      })
    }

    if (tmdbId) {
      candidates.push({
        provider: 'vidsrc',
        idType: 'tmdb',
        id: tmdbId,
        url: getVidsrcTvUrl(tmdbId, season, episode, { quality })
      })
    }
  }

  return candidates.filter(Boolean)
}

export function resolveSourceCandidates({
  mediaType,
  isAnime = false,
  imdbId,
  tmdbId,
  malId,
  anilistId,
  season = 1,
  episode = 1,
  audio = 'sub',
  lang = 'en',
  quality = 'auto',
  title = ''
}) {
  const normalizedMediaType = mediaType === 'movie' ? 'movie' : 'tv'
  const titleChoices = titleFallbacks(title)

  const dropfileCandidates = getDropfileCandidates({
    imdbId,
    tmdbId,
    malId,
    anilistId,
    season,
    episode,
    audio,
    lang,
    quality,
    type: normalizedMediaType
  })

  const vidsrcCandidates = getVidsrcCandidates({
    mediaType: normalizedMediaType,
    imdbId,
    tmdbId,
    season,
    episode,
    quality
  })

  return {
    titleChoices,
    dropfileCandidates: isAnime ? dropfileCandidates : [],
    vidsrcCandidates,
    allCandidates: isAnime
      ? [...dropfileCandidates, ...vidsrcCandidates]
      : [...vidsrcCandidates, ...dropfileCandidates]
  }
}

export async function resolvePlayableSource(options) {
  const { titleChoices, allCandidates } = resolveSourceCandidates(options)

  let candidates = allCandidates

  if (options.preferredProvider) {
    const preferred = candidates.filter(c => c.provider === options.preferredProvider)
    const fallback = candidates.filter(c => c.provider !== options.preferredProvider)
    candidates = [...preferred, ...fallback]
  }

  const titleVariants = titleChoices.length ? titleChoices : ['']

  for (const candidate of candidates) {
    if (candidate?.url) {
      return {
        ...candidate,
        type: 'iframe',
        iframeUrl: candidate.url,
        finalUrl: candidate.url,
        url: candidate.url
      }
    }
  }

  if (options.title) {
    for (const titleVariant of titleVariants) {
      const retry = resolveSourceCandidates({
        ...options,
        title: titleVariant,
        imdbId: options.imdbId,
        tmdbId: options.tmdbId,
        malId: options.malId,
        anilistId: options.anilistId
      })

      for (const candidate of retry.allCandidates) {
        if (candidate?.url) {
          return {
            ...candidate,
            type: 'iframe',
            iframeUrl: candidate.url,
            finalUrl: candidate.url,
            url: candidate.url
          }
        }
      }
    }
  }

  return null
}