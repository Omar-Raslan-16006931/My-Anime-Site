// Offline downloads — iPhone app only.
//
// Uses native file transfer (not the browser), so it can send the Referer
// header AllManga requires and write real files into the app's Documents
// folder, which also shows up in the Files app under "On My iPhone > AniWave".
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { isNative } from './native'
import { allmangaResolve } from './allmanga'

export { isNative }

const KEY = 'aw:downloads'
const DIR = 'AniWave'
const ALLMANGA_HEADERS = {
  Referer: 'https://allmanga.to',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
}

// ── Tiny store (finished list in localStorage + in-memory active jobs) ──────
const listeners = new Set()
let active = {} // id -> { id, title, episode, audio, poster, bytes, total }

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
const emit = () => listeners.forEach((f) => { try { f() } catch { /* ignore */ } })

export function getDownloads() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function saveDownloads(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
  emit()
}
export const getActive = () => Object.values(active)

const safeName = (s) => String(s || 'Episode').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80)
export const downloadId = (malId, episode, audio) => `anime-${malId}-${episode}-${audio}`

export function isDownloaded(id) { return getDownloads().some((d) => d.id === id) }
export function isDownloading(id) { return !!active[id] }

// Resolve AllManga for this episode and save the first single-file (MP4)
// stream. Chunked (HLS) streams can't be saved as one file yet.
export async function downloadAnimeEpisode({ malId, title, episode, audio = 'sub', poster }) {
  if (!isNative) throw new Error('Downloads work in the AniWave iPhone app.')
  const id = downloadId(malId, episode, audio)
  if (isDownloaded(id)) throw new Error('Already downloaded')
  if (active[id]) throw new Error('Already downloading')

  active[id] = { id, title, episode, audio, poster, bytes: 0, total: 0, stage: 'Finding file…' }
  emit()

  let progressHandle = null
  try {
    const res = await allmangaResolve({ title, episode, translationType: audio })
    const streams = res?.ok ? res.streams || [] : []
    const file = streams.find((s) => s.type === 'mp4' && !String(s.url).includes('.m3u8'))
    if (!file) {
      throw new Error(streams.length
        ? 'This episode only exists as a stream, so it can’t be saved yet.'
        : 'AllManga doesn’t have this episode.')
    }

    const fileName = `${safeName(title)} - E${episode} (${audio.toUpperCase()}).mp4`
    const path = `${DIR}/${fileName}`
    await Filesystem.mkdir({ path: DIR, directory: Directory.Documents, recursive: true }).catch(() => {})
    const { uri } = await Filesystem.getUri({ directory: Directory.Documents, path })

    active[id] = { ...active[id], stage: 'Downloading' }
    emit()

    progressHandle = await FileTransfer.addListener('progress', (p) => {
      if (!active[id]) return
      // Only one transfer usually runs at a time; match by URL when we can.
      if (p.url && p.url !== file.url && getActive().length > 1) return
      active[id] = { ...active[id], bytes: p.bytes || 0, total: p.lengthComputable ? p.contentLength || 0 : 0 }
      emit()
    })

    await FileTransfer.downloadFile({
      url: file.url,
      path: uri,
      progress: true,
      headers: ALLMANGA_HEADERS,
      connectTimeout: 60000,
      readTimeout: 120000,
    })

    const stat = await Filesystem.stat({ directory: Directory.Documents, path }).catch(() => null)
    saveDownloads([
      {
        id, kind: 'anime', malId, title, episode, audio, poster: poster || null,
        path, size: stat?.size || active[id]?.total || 0, quality: file.quality || '', at: Date.now(),
      },
      ...getDownloads().filter((d) => d.id !== id),
    ])
  } catch (e) {
    const http = e?.data?.httpStatus || e?.httpStatus
    throw new Error(http ? `The video server refused the download (${http}). Try again later.` : (e?.message || 'Download failed'))
  } finally {
    try { await progressHandle?.remove() } catch { /* ignore */ }
    delete active[id]
    emit()
  }
}

export async function deleteDownload(id) {
  const d = getDownloads().find((x) => x.id === id)
  if (d) await Filesystem.deleteFile({ directory: Directory.Documents, path: d.path }).catch(() => {})
  saveDownloads(getDownloads().filter((x) => x.id !== id))
}

// A URL the in-app <video> can play straight from the device.
export async function playableSrc(d) {
  const { uri } = await Filesystem.getUri({ directory: Directory.Documents, path: d.path })
  return Capacitor.convertFileSrc(uri)
}

export function formatSize(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}
