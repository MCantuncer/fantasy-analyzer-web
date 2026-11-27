import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * How many of a row's items fit on one line, whole, with room left for a "+N" mark after them.
 * The row's items carry `data-fit`, the mark carries `data-fit-more`. Every item counts until
 * measured, and where ResizeObserver is missing (tests). At least one item always shows. Anything
 * marked `is-quiet` (hidden only while the "+N" follows) is measured as shown.
 */
export function useFitCount(ref: RefObject<HTMLElement | null>, count: number): number {
  const [fit, setFit] = useState(count)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') {
      setFit(count)
      return
    }
    const check = () => {
      const items = [...el.querySelectorAll<HTMLElement>('[data-fit]')]
      const more = el.querySelector<HTMLElement>('[data-fit-more]')
      // Show everything for a moment to read each item's natural width, then put it back as it was.
      const was = [...items, ...(more ? [more] : [])].map((n) => [n, n.hidden] as const)
      for (const [n] of was) n.hidden = false
      const quiet = [...el.querySelectorAll<HTMLElement>('.is-quiet')]
      for (const n of quiet) n.classList.remove('is-quiet')
      // scrollWidth: an item shrinking behind an ellipsis still reports its full width.
      const widths = items.map((n) => Math.max(n.offsetWidth, n.scrollWidth))
      const moreWidth = more?.offsetWidth ?? 0
      for (const n of quiet) n.classList.add('is-quiet')
      for (const [n, hidden] of was) n.hidden = hidden
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0
      const room = el.clientWidth + 0.5
      const span = (k: number) => widths.slice(0, k).reduce((sum, w) => sum + w, 0) + gap * (k - 1)
      let k = widths.length
      if (span(k) > room) {
        k -= 1
        while (k > 1 && span(k) + gap + moreWidth > room) k -= 1
      }
      setFit(Math.max(1, k))
    }
    const observer = new ResizeObserver(check)
    observer.observe(el)
    check()
    return () => observer.disconnect()
  }, [ref, count])
  return Math.min(fit, count)
}
