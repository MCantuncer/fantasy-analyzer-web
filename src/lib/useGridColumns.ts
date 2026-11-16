import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * How many columns a CSS grid lays out right now, read from its computed template so it follows the
 * stylesheet's breakpoints. 0 means the element isn't a grid at the moment (the phone swipe strip is
 * a flex row).
 */
export function useGridColumns(ref: RefObject<HTMLElement | null>): number {
  const [cols, setCols] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const cs = getComputedStyle(el)
      const n = cs.display === 'grid' ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 0
      setCols((c) => (c === n ? c : n))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  })
  return cols
}
