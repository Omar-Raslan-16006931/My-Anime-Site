// Tiny global toast bus — fire-and-forget notifications from anywhere.
export function toast(msg) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg } }))
}
