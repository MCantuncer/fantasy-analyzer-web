import { ArrowDown, ArrowUp } from '@phosphor-icons/react'
import { pct, ptsDiff } from '../lib/format'
import './OddsChange.css'

/** A small sign (+ or −) set at about two thirds of the digits' size, raised to sit on their middle. */
export function Sign({ up }: { up: boolean }) {
  return (
    <span className="dl-sign" aria-hidden="true">
      {up ? '+' : '\u2212'}
    </span>
  )
}

/**
 * A signed whole number drawn as a small bold arrow, a small sign and the digits ("↑+8", "↓−3").
 * Both marks stay well under the digits' size so the number leads. Screen readers hear "up 8".
 */
export function Delta({ value, unit }: { value: number; unit?: string }) {
  const n = Math.round(value)
  if (n === 0) return <span className="dl">±0{unit ? ` ${unit}` : ''}</span>
  const up = n > 0
  const Arrow = up ? ArrowUp : ArrowDown
  return (
    <span className="dl">
      <Arrow className="dl-arrow" weight="bold" aria-hidden="true" />
      <span className="sr-only">{up ? 'up ' : 'down '}</span>
      <Sign up={up} />
      {Math.abs(n)}
      {unit ? ` ${unit}` : ''}
    </span>
  )
}

/** Compact "10% → 18% ▲8" for list rows. showBefore=false drops the "10% →" when the list states it once. */
export function OddsChange({
  before,
  after,
  showBefore = true,
}: {
  before: number
  after: number
  showBefore?: boolean
}) {
  const diff = ptsDiff(before, after)
  return (
    <span className="odds-change num">
      <span className="sr-only">Playoff odds from </span>
      {showBefore ? (
        <span className="before">{pct(before)} → </span>
      ) : (
        <span className="sr-only">{pct(before)} to </span>
      )}
      <span className="after">{pct(after)}</span>
      <span className={`delta ${diff >= 0 ? 'good' : 'bad'}`}>
        <Delta value={diff} />
        <span className="sr-only"> points</span>
      </span>
    </span>
  )
}
