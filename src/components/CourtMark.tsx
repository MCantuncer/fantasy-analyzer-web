import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'
import { animateSpan, buildSpan, measureSpan, setStatic, whenFontsReady, type Span, type SpanState } from '../lib/courtSpan'
import { useMediaQuery } from '../lib/useMediaQuery'
import './CourtMark.css'

/*
 * The COURT mark. At rest it is the folded CT ball on every screen (rest="closed" shows the COURT wordmark, and
 * "auto" picks the wordmark on wide screens). open() expands the ball: C and T pull apart, the bar breaks into
 * five floors and Categories, Odds, Upgrades, Rosters, Trades stand on them; close() folds it back. Drawing and
 * motion live in lib/courtSpan.ts. Decorative: the button around it carries the accessible name.
 */

export interface CourtMarkHandle {
  open(): void
  close(): void
  isOpen(): boolean
}

export const PHONE_QUERY = '(max-width: 640px)'

const SIZES = {
  phone: { u: 0.75, capH: 8.5, gap: 12 },
  desktop: { u: 0.875, capH: 12, gap: 22 },
}

export function CourtMark({
  rest = 'folded',
  veil = false,
  ref,
}: {
  rest?: 'auto' | 'folded' | 'closed'
  veil?: boolean
  ref?: Ref<CourtMarkHandle>
}) {
  const phone = useMediaQuery(PHONE_QUERY)
  const restState: SpanState = rest === 'auto' ? (phone ? 'folded' : 'closed') : rest
  const size = phone ? SIZES.phone : SIZES.desktop
  const host = useRef<HTMLSpanElement>(null)
  const span = useRef<Span | null>(null)
  const isOpen = useRef(false)

  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    isOpen.current = false
    const s = buildSpan(el, { ...size, state: restState, sizeAs: restState, veil })
    span.current = s
    let alive = true
    // Word widths depend on the web font: lay the open row out again once it has loaded.
    whenFontsReady(s).then(() => {
      if (!alive) return
      measureSpan(s)
      setStatic(s, isOpen.current ? 'open' : restState)
    })
    return () => {
      alive = false
      s.anims.forEach((a) => a.cancel())
      span.current = null
    }
  }, [restState, size, veil])

  useImperativeHandle(
    ref,
    () => ({
      open() {
        if (!span.current || isOpen.current) return
        isOpen.current = true
        animateSpan(span.current, restState, 'open')
      },
      close() {
        if (!span.current || !isOpen.current) return
        isOpen.current = false
        animateSpan(span.current, 'open', restState)
      },
      isOpen: () => isOpen.current,
    }),
    [restState],
  )

  return <span ref={host} className={`court-mark court-mark--${restState}`} aria-hidden="true" />
}
