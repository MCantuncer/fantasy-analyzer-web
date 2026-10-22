import { pct } from '../lib/format'

export function OddsChange({ before, after }: { before: number; after: number }) {
  // Difference of the rounded numbers, so the delta matches what is shown.
  const diff = Math.round(after * 100) - Math.round(before * 100)
  return (
    <div className="odds">
      <span className="muted">Playoff odds</span>
      <strong>
        {pct(before)} → {pct(after)}
      </strong>
      <span className={diff >= 0 ? 'delta up' : 'delta down'}>
        {diff >= 0 ? '+' : '−'}
        {Math.abs(diff)} pts
      </span>
    </div>
  )
}
