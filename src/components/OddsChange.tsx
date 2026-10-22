import { pct, ptsDiff, signedInt } from '../lib/format'

/** Compact "10% → 18% +8" for list rows. */
export function OddsChange({ before, after }: { before: number; after: number }) {
  const diff = ptsDiff(before, after)
  return (
    <span className="odds-change num">
      <span className="sr-only">Playoff odds from </span>
      <span className="before">{pct(before)} → </span>
      <span className="after">{pct(after)}</span>
      <span className={`delta ${diff >= 0 ? 'good' : 'bad'}`}>
        {signedInt(diff)}
        <span className="sr-only"> points</span>
      </span>
    </span>
  )
}
