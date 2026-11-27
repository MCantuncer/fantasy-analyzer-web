import type { CSSProperties } from 'react'
import { pointChange } from '../lib/tradeCheck'
import './ChangeDot.css'

/**
 * Before and after on one track: a muted ring for today, a solid dot for after the trade, and the
 * segment between them. Your side is blue (helps you) or orange (hurts you); the other team's side is always partner violet,
 * full strength for a gain and faded for a loss. Values are shares (0..1) on a 0..100 axis that grows
 * away from the centre seam: leftward for you (`me`), rightward for them. Decorative: the numbers
 * beside it carry the meaning.
 */
export function ChangeDot({
  before,
  after,
  side,
  bar = false,
}: {
  before: number
  after: number
  side: 'me' | 'them'
  /**
   * The Playoffs bar: a short left-to-right track filled to the lower value, the change between
   * before and after in its colour, and a ghost tick at before in place of the ring and dot, so a
   * move of a few points still shows.
   */
  bar?: boolean
}) {
  const clamp = (x: number) => Math.min(Math.max(x, 0), 1) * 100
  const b = clamp(before)
  const a = clamp(after)
  const moved = pointChange(before, after)
  const tone = side === 'them' ? (moved < 0 ? 'them-down' : 'them') : moved > 0 ? 'up' : moved < 0 ? 'down' : 'flat'
  const style = {
    '--cd-from': `${Math.min(a, b)}%`,
    '--cd-to': `${Math.max(a, b)}%`,
    '--cd-before': `${b}%`,
    '--cd-after': `${a}%`,
  } as CSSProperties
  if (bar)
    return (
      <span className={`cd cd-bar cd-${tone}`} style={style} aria-hidden="true">
        <span className="cd-track" />
        <span className="cd-fill" />
        {moved !== 0 && <span className="cd-seg" />}
        <span className="cd-tick" />
      </span>
    )
  return (
    <span className={`cd cd-${side} cd-${tone}`} style={style} aria-hidden="true">
      <span className="cd-track" />
      <span className="cd-seg" />
      <span className="cd-ring" />
      <span className="cd-dot" />
    </span>
  )
}
