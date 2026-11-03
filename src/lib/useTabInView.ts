import { useEffect, useState } from 'react'

// On a phone the tab bar scrolls sideways, and the open tab can sit off screen (after a
// link, a reload or "View moves"). Keep the selected tab centred in view. Pass null while
// the bar is hidden, so it is centred again once it appears. The ref is a callback, so a bar
// that mounts again is centred too, and so is one whose tabs arrive later or whose widths
// change once web fonts load.
export function useTabInView(active: string | null) {
  const [bar, setBar] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (active === null || !bar) return
    const centre = (smooth: boolean) => {
      const tab = bar.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!tab || bar.scrollWidth <= bar.clientWidth) return
      const b = bar.getBoundingClientRect()
      const t = tab.getBoundingClientRect()
      const shift = t.left + t.width / 2 - (b.left + b.width / 2)
      if (Math.abs(shift) < 1) return
      bar.scrollBy?.({ left: shift, behavior: smooth ? 'smooth' : 'auto' })
    }
    centre(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    let live = true
    document.fonts?.ready.then(() => live && centre(false))
    // Tabs can arrive after the bar (e.g. once the league loads): centre again when they change.
    const seen = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => centre(false))
    seen?.observe(bar, { childList: true })
    return () => {
      live = false
      seen?.disconnect()
    }
  }, [active, bar])
  return setBar
}
