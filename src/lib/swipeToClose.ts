import { useEffect, useRef, type RefObject } from 'react'

/**
 * Swipe a bottom sheet down to close it, like a native phone sheet. The sheet follows the finger;
 * let go past a quarter of its height (at most 140px) or with a quick flick and it slides away and
 * closes, otherwise it springs back.
 *
 * It never fights scrolling: a drag that starts inside content that is scrolled down scrolls that
 * content as usual, and a sideways drag (a wide table) is left alone. Only touch input counts, and
 * only while `media` matches, i.e. while the card is laid out as a bottom sheet.
 */

type Options = {
  /** The layout in which the card is a bottom sheet. */
  media?: string
  /** The dimmed layer behind the sheet, faded as the sheet goes down. Must not contain the sheet. */
  backdrop?: RefObject<HTMLElement | null>
  enabled?: boolean
}

/** Movement before we decide whether this is a downward drag. */
const SLOP = 6
/** Let go past this share of the sheet's height (capped at MAX_PULL) and it closes. */
const PULL = 0.25
const MAX_PULL = 140
/** Or flick down faster than this (px per ms) after at least FLICK_MIN px. */
const FLICK = 0.5
const FLICK_MIN = 24
const SETTLE_MS = 200
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** True when the touch starts in something that should keep the gesture: a field, a slider, or
 *  content between the finger and the sheet that is scrolled away from its top. */
function holds(target: EventTarget | null, sheet: HTMLElement): boolean {
  if (!(target instanceof Element)) return true
  if (target.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-swipe]')) return true
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.scrollTop > 0) return true
    if (el === sheet) break
  }
  return false
}

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useSwipeToClose(
  sheetRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  { media = '(max-width: 640px)', backdrop, enabled = true }: Options = {},
) {
  // Held in refs so a new onClose each render doesn't re-attach the listeners mid-drag.
  const close = useRef(onClose)
  const fade = useRef(backdrop)
  useEffect(() => {
    close.current = onClose
    fade.current = backdrop
  })

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet || !enabled) return

    let start: { x: number; y: number } | null = null
    let dragging = false
    let closing = false
    let offset = 0
    let samples: { y: number; t: number }[] = []
    let settle: ReturnType<typeof setTimeout> | undefined

    const paint = (dy: number, animate: boolean) => {
      offset = dy
      const transition = animate ? `${SETTLE_MS}ms ${EASE}` : ''
      sheet.style.transition = animate ? `transform ${transition}` : 'none'
      sheet.style.transform = dy > 0 ? `translate3d(0, ${dy}px, 0)` : ''
      const dim = fade.current?.current
      if (dim) {
        dim.style.transition = animate ? `opacity ${transition}` : 'none'
        dim.style.opacity = dy > 0 ? String(Math.max(0, 1 - dy / Math.max(sheet.offsetHeight, 1))) : ''
      }
    }

    // Back to the stylesheet's own look once a spring-back has finished.
    const tidy = () => {
      sheet.style.transition = ''
      sheet.style.transform = ''
      const dim = fade.current?.current
      if (dim) {
        dim.style.transition = ''
        dim.style.opacity = ''
      }
    }

    const springBack = () => {
      if (reducedMotion()) return tidy()
      paint(0, true)
      settle = setTimeout(tidy, SETTLE_MS)
    }

    const dismiss = () => {
      closing = true
      if (reducedMotion()) return close.current()
      paint(sheet.offsetHeight + 24, true)
      settle = setTimeout(() => close.current(), SETTLE_MS)
    }

    const onStart = (e: TouchEvent) => {
      start = null
      if (closing || e.touches.length !== 1) return
      if (!window.matchMedia?.(media).matches) return
      if (holds(e.target, sheet)) return
      clearTimeout(settle)
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY }
      samples = [{ y: t.clientY, t: e.timeStamp }]
    }

    const cancel = () => {
      const was = dragging
      start = null
      dragging = false
      if (was && !closing) springBack()
    }

    const onMove = (e: TouchEvent) => {
      if (!start || closing) return
      if (e.touches.length !== 1) return cancel()
      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (!dragging) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
        // Up or sideways: not ours, let the page scroll.
        if (dy <= 0 || Math.abs(dx) > dy) {
          start = null
          return
        }
        dragging = true
        // An opening animation would override the inline transform; it is over for this sheet.
        sheet.style.animation = 'none'
      }
      if (e.cancelable) e.preventDefault()
      samples.push({ y: t.clientY, t: e.timeStamp })
      if (samples.length > 6) samples.shift()
      paint(Math.max(0, dy), false)
    }

    const onEnd = (e: TouchEvent) => {
      const was = dragging
      start = null
      dragging = false
      if (!was || closing) return
      const first = samples[0]
      const last = samples[samples.length - 1]
      // A finger that stopped before letting go is not a flick.
      const still = e.timeStamp - last.t > 80
      const speed = !still && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0
      const far = offset > Math.min(MAX_PULL, sheet.offsetHeight * PULL)
      if (far || (speed > FLICK && offset > FLICK_MIN)) dismiss()
      else springBack()
    }

    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', cancel)
    return () => {
      clearTimeout(settle)
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', cancel)
    }
  }, [sheetRef, media, enabled])
}
