import { useLayoutEffect, useRef, type MouseEvent } from 'react'

// Lists of moves open one row at a time. Tapping a row below an open one closes the one
// above, so everything under it slides up by the height of the closed details and the
// screen lands near the end of the new row (or past it). Put the returned handler on the
// list's onClickCapture and pass the open key: the tapped row stays where the finger was,
// then, if its details would start below the screen, it scrolls up under the top bar.
const ROWS = '.move-row, .offer-row'
/** Share of the screen the opened details need below their row before we scroll them up. */
const MIN_ROOM = 0.4

export function useKeepRowInView(open: unknown) {
  const pending = useRef<{ row: HTMLElement; top: number } | null>(null)

  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>(ROWS)
    if (!row || !e.currentTarget.contains(row)) return
    pending.current = { row, top: row.getBoundingClientRect().top }
  }

  useLayoutEffect(() => {
    const p = pending.current
    pending.current = null
    if (!p || !p.row.isConnected) return
    // Undo the slide first, before paint, so nothing visibly jumps.
    const drift = p.row.getBoundingClientRect().top - p.top
    if (drift) window.scrollBy(0, drift)
    if (p.row.getAttribute('aria-expanded') !== 'true') return
    const r = p.row.getBoundingClientRect()
    const barBottom = Math.max(0, document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0)
    if (r.top >= barBottom && window.innerHeight - r.bottom >= window.innerHeight * MIN_ROOM) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: r.top - barBottom - 8, behavior: reduce ? 'auto' : 'smooth' })
  }, [open])

  return onClickCapture
}
