import { shotPct } from '../lib/shooting'
import './ShotSplit.css'

/** One FG or FT cell: made/attempted on top the way ESPN prints it, the percentage small underneath, inside the same column. */
export function ShotSplit({ made, attempts, label }: { made: number; attempts: number; label: 'FG' | 'FT' }) {
  const pct = shotPct(made, attempts)
  return (
    <span className="shot-split" aria-label={`${label} ${made} of ${attempts}${attempts > 0 ? `, ${pct}` : ''}`}>
      <span className="shot-split-ma" aria-hidden="true">
        {made}/{attempts}
      </span>
      <span className="shot-split-pct" aria-hidden="true">
        {pct}
      </span>
    </span>
  )
}
