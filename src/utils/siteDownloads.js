const KEY = 'siteDownloads'

export function readSiteDownloads() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function writeSiteDownloads(downloads) {
  localStorage.setItem(KEY, JSON.stringify(downloads))
}

export function addSiteDownload(entry) {
  const downloads = readSiteDownloads()
  const nextEntry = {
    id: entry.id || `${entry.malId || 'media'}_${entry.episode || 'x'}_${Date.now()}`,
    createdAt: Date.now(),
    ...entry,
  }
  const next = [nextEntry, ...downloads.filter((item) => item.id !== nextEntry.id)]
  writeSiteDownloads(next)
  return nextEntry
}

export function removeSiteDownload(id) {
  const next = readSiteDownloads().filter((item) => item.id !== id)
  writeSiteDownloads(next)
  return next
}