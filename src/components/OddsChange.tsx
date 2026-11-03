import { pct, ptsDiff, signedInt } from '../lib/format'

/** Compact "10% → 18% +8" for list rows. showBefore=false drops the "10% →" when the list states it once. */
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
        {signedInt(diff)}
        <span className="sr-only"> points</span>
      </span>
    </span>
  )
}
