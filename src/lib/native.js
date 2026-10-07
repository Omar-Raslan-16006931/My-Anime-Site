// Native (iPhone app) helpers. On the website these are no-ops.
import { Capacitor } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()

// Inside the app, pages are served from the device, not from your website, so
// relative "/api/..." calls need your live site's address. Set VITE_API_BASE
// (e.g. https://your-site.vercel.app) when building the app.
const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

export function apiUrl(path) {
  return isNative && API_BASE ? `${API_BASE}${path}` : path
}

// Absolute version (for handing a URL to another site, e.g. VidLink's sub_file).
export function absoluteUrl(pathOrUrl) {
  try { return new URL(pathOrUrl, window.location.href).href } catch { return pathOrUrl }
}
