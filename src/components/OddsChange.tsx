import { pct, ptsDiff } from '../lib/format'
import './OddsChange.css'

/**
 * A signed whole number drawn as "▲8" / "▼3": a sized triangle instead of the + or − sign.
 * Screen readers hear "up 8" / "down 3".
 */
export function Delta({ value, unit }: { value: number; unit?: string }) {
  const n = Math.round(value)
  if (n === 0) return <span className="dl">±0{unit ? ` ${unit}` : ''}</span>
  const up = n > 0
  return (
    <span className="dl">
      <span className={`dl-arrow ${up ? 'up' : 'down'}`} aria-hidden="true" />
      <span className="sr-only">{up ? 'up ' : 'down '}</span>
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
