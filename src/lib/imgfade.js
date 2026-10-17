// Lazy images fade in once decoded instead of popping in (and never flash blank).
// CSS hides `img[loading=lazy]:not(.loaded)`; this marks them loaded.
if (typeof document !== 'undefined') {
  const mark = (img) => img.classList.add('loaded')
  const watch = (img) => {
    if (img.tagName !== 'IMG' || img.classList.contains('loaded')) return
    if (img.complete && img.naturalWidth > 0) { mark(img); return }
    img.addEventListener('load', () => mark(img), { once: true })
    img.addEventListener('error', () => mark(img), { once: true })
    setTimeout(() => mark(img), 6000) // never leave one invisible
  }
  const scan = (root) => {
    if (root.tagName === 'IMG') watch(root)
    root.querySelectorAll?.('img').forEach(watch)
  }
  new MutationObserver((list) => {
    for (const m of list) {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n) })
      if (m.type === 'attributes' && m.target.tagName === 'IMG') { m.target.classList.remove('loaded'); watch(m.target) }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
  scan(document.documentElement)
}
