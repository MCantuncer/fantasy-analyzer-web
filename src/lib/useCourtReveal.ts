import { useEffect, useRef, type PointerEvent, type RefObject } from 'react'
import type { CourtMarkHandle } from '../components/CourtMark'
import { OPEN_TOTAL, T, reducedMotion } from './courtSpan'

/*
 * When the COURT mark opens in the top bar:
 * - a mouse resting 140ms on the brand button opens it, leaving closes it at once;
 * - keyboard focus (:focus-visible) opens it, blur or Esc closes it;
 * - a click or tap plays it once (open, hold, close) after the caller has already navigated;
 * - any other pointerdown or a scroll closes it.
 */
export function useCourtReveal(mark: RefObject<CourtMarkHandle | null>, button: RefObject<HTMLElement | null>) {
  const hover = useRef(false)
  const intent = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined)

  const focusVisible = () => {
    const b = button.current
    if (!b || document.activeElement !== b) return false
    try {
      return b.matches(':focus-visible')
    } catch {
      return false
    }
  }

  const open = () => {
    clearTimeout(hold.current)
    mark.current?.open()
  }
  const close = () => {
    clearTimeout(hold.current)
    clearTimeout(intent.current)
    mark.current?.close()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onDown = (e: globalThis.PointerEvent) => {
      if (button.current?.contains(e.target as Node)) return
      if (mark.current?.isOpen() && !hover.current) close()
    }
    const onScroll = () => {
      if (mark.current?.isOpen() && !hover.current) close()
    }
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onDown)
    addEventListener('scroll', onScroll, { passive: true })
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('pointerdown', onDown)
      removeEventListener('scroll', onScroll)
      clearTimeout(hold.current)
      clearTimeout(intent.current)
    }
    // close() only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    onPointerEnter(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return
      hover.current = true
      clearTimeout(intent.current)
      intent.current = setTimeout(open, T.INTENT)
    },
    onPointerLeave(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return
      hover.current = false
      clearTimeout(intent.current)
      if (!focusVisible()) close()
    },
    onFocus() {
      if (focusVisible()) open()
    },
    onBlur() {
      if (!hover.current) close()
    },
    /** Call after navigating: plays the opening once, then folds back unless hovered or focused. */
    playOnce() {
      if (mark.current?.isOpen()) return
      open()
      hold.current = setTimeout(
        () => {
          if (!hover.current && !focusVisible()) close()
        },
        reducedMotion() ? 1200 : OPEN_TOTAL + T.HOLD,
      )
    },
  }
}
