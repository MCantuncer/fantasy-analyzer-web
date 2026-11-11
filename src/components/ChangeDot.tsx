import type { CSSProperties } from 'react'
import { pointChange } from '../lib/tradeCheck'
import './ChangeDot.css'

/**
 * Before and after on one track: a muted ring for today, a solid dot for after the trade, and the
 * segment between them. Your side is green or coral; the other team's side is always partner violet,
 * full strength for a gain and faded for a loss. Values are shares (0..1) on a 0..100 axis that grows
 * away from the centre seam: leftward for you (`me`), rightward for them. Decorative: the numbers
 * beside it carry the meaning.
 */
export function ChangeDot({ before, after, side }: { before: number; after: number; side: 'me' | 'them' }) {
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
  return (
    <span className={`cd cd-${side} cd-${tone}`} style={style} aria-hidden="true">
      <span className="cd-track" />
      <span className="cd-seg" />
      <span className="cd-ring" />
      <span className="cd-dot" />
    </span>
  )
}
