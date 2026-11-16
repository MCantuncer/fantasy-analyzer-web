import type { CSSProperties } from 'react'

/**
 * Front Row (Can, 2026-11-15): a game's box score opens in place, right under the game's row, and the
 * page never moves you. These are the motion constants and the one helper that keeps a thing still on
 * screen while the layout around it grows or shrinks.
 */

export const FR_MS = { open: 300, hop: 260, close: 220, fadeIn: 190, fadeDelay: 90 } as const
export const FR_EASE_OPEN = 'cubic-bezier(.2,.8,.2,1)' // quick start, long calm settle, no overshoot
export const FR_EASE_CLOSE = 'cubic-bezier(.4,0,.2,1)'

/** Reduced motion asked for, or no Web Animations to run (then the box simply appears and goes). */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof Element === 'undefined' || !('animate' in Element.prototype)) return true
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

let stop: (() => void) | null = null

/** The close curve, cubic-bezier(.4,0,.2,1), for moving the held thing to a new spot in step with the box. */
function easeClose(x: number): number {
  const [x1, y1, x2, y2] = [0.4, 0, 0.2, 1]
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  let t = x
  for (let i = 0; i < 8; i++) {
    const d = (3 * ax * t + 2 * bx) * t + cx
    if (Math.abs(d) < 1e-6) break
    t -= (((ax * t + bx) * t + cx) * t - x) / d
  }
  t = Math.min(1, Math.max(0, t))
  return ((ay * t + by) * t + cy) * t
}

/**
 * Keeps `get()` on screen while the layout around it grows or shrinks, at y0 (taken before the layout
 * changed) or travelling from y0 to y1 over `ms`. Stops the moment the reader scrolls (wheel, touch, a
 * scroll key), so it never fights them. Native scroll anchoring is off only while it runs.
 */
export function holdAt(get: () => Element | null, y0: number, ms: number, y1?: number) {
  stop?.()
  const root = document.documentElement
  root.classList.add('sc-tweening')
  let raf = 0
  const t0 = performance.now()
  const end = t0 + ms + 60
  const keys = new Set(['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', ' ', 'Home', 'End'])
  const quit = () => {
    cancelAnimationFrame(raf)
    root.classList.remove('sc-tweening')
    removeEventListener('wheel', quit, true)
    removeEventListener('touchstart', quit, true)
    removeEventListener('keydown', onKey, true)
    if (stop === quit) stop = null
  }
  const onKey = (e: KeyboardEvent) => {
    if (keys.has(e.key) && !(e.target instanceof HTMLButtonElement)) quit()
  }
  const tick = () => {
    const el = get()
    if (el) {
      const p = ms > 0 ? Math.min(1, (performance.now() - t0) / ms) : 1
      const want = y1 == null ? y0 : y0 + (y1 - y0) * easeClose(p)
      const dy = el.getBoundingClientRect().top - want
      if (Math.abs(dy) > 0.5) window.scrollBy(0, dy)
    }
    if (performance.now() < end) raf = requestAnimationFrame(tick)
    else quit()
  }
  addEventListener('wheel', quit, { capture: true, passive: true })
  addEventListener('touchstart', quit, { capture: true, passive: true })
  addEventListener('keydown', onKey, true)
  stop = quit
  tick()
}

/** Where a game sits in the grid: the id of the last card in its row (the box goes right after it). */
export function rowEndOf(ids: number[], id: number, cols: number): number | null {
  const k = ids.indexOf(id)
  if (k < 0) return null
  if (cols <= 0) return ids[ids.length - 1] ?? null
  return ids[Math.min(Math.floor(k / cols) * cols + cols - 1, ids.length - 1)]
}

/** The edge a game card grows from when it comes forward: edge cards grow inward, so they never overhang the box. */
export function tabOrigin(ids: number[], id: number, cols: number): string {
  if (cols <= 1) return '0% 100%'
  const k = ids.indexOf(id)
  const at = k % cols
  if (at === 0) return '0% 100%'
  if (at === cols - 1) return '100% 100%'
  return '50% 100%'
}

/** Style for a game card: where it grows from when it comes forward as the open box's tab. */
export function tabStyle(origin: string): CSSProperties {
  return { '--sc-tab-origin': origin } as CSSProperties
}
