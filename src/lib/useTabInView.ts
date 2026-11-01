import { useEffect, useRef } from 'react'

// On a phone the tab bar scrolls sideways, and the open tab can sit off screen (after a
// link, a reload or "View moves"). Keep the selected tab centred in view. Pass null while
// the bar is hidden, so it is centred again once it appears.
export function useTabInView(active: string | null) {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const bar = ref.current
    if (active === null) return
    const tab = bar?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!bar || !tab || bar.scrollWidth <= bar.clientWidth) return
    const b = bar.getBoundingClientRect()
    const t = tab.getBoundingClientRect()
    const shift = t.left + t.width / 2 - (b.left + b.width / 2)
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    bar.scrollBy?.({ left: shift, behavior: smooth ? 'smooth' : 'auto' })
  }, [active])
  return ref
}
