import { useLayoutEffect, useRef } from 'react'

// Slides the children of `ref` (marked with data-flip="<key>") from their old
// position to their new one whenever `dep` changes, so removing an item makes
// its neighbours glide into the gap instead of jumping.
export function useFlip(ref, dep) {
  const prev = useRef(new Map())
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const next = new Map()
    for (const c of el.children) {
      const k = c.dataset.flip
      if (!k) continue
      const pos = { x: c.offsetLeft, y: c.offsetTop }
      next.set(k, pos)
      const p = prev.current.get(k)
      if (p && (p.x !== pos.x || p.y !== pos.y) && c.animate) {
        // `translate` (not `transform`) so it composes with a tile's own animation, e.g. the manage-mode wobble.
        c.animate(
          [{ translate: `${p.x - pos.x}px ${p.y - pos.y}px` }, { translate: '0px 0px' }],
          { duration: 680, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        )
      }
    }
    prev.current = next
  }, [ref, dep])
}
