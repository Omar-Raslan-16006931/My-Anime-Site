// "Surprise me" — tiny event bus so any button can open the overlay.
export function openSurprise() {
  window.dispatchEvent(new CustomEvent('yoru:surprise'))
}
