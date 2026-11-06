import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Whether the element's first child fits inside it without sideways scrolling, updating as
 * either one resizes. False until measured, and where ResizeObserver is missing (tests).
 */
export function useFitsWidth(ref: RefObject<HTMLElement | null>): boolean {
  const [fits, setFits] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    const inner = el?.firstElementChild as HTMLElement | null | undefined
    if (!el || !inner || typeof ResizeObserver === 'undefined') return
    const check = () => setFits(inner.offsetWidth <= el.clientWidth + 1)
    const observer = new ResizeObserver(check)
    observer.observe(el)
    observer.observe(inner)
    check()
    return () => observer.disconnect()
  }, [ref])
  return fits
}
