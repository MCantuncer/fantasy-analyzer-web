import { pct, ptsDiff } from '../lib/format'
import { ChangeDot } from './ChangeDot'
import './PlayoffsMark.css'

const spoken = (d: number) => (d > 0 ? `up ${d}` : d < 0 ? `down ${-d}` : 'no change')

/**
 * Your change in playoff odds: "▲5" in the helps-you blue, or an orange "▼" beside an ink figure
 * (the orange is too light for small text on a raised row). The arrow carries the sign.
 */
export function OddsChange({ before, after }: { before: number; after: number }) {
  const d = ptsDiff(before, after)
  return (
    <span className={`plo-d num ${d > 0 ? 'plo-help' : d < 0 ? 'plo-hurt' : ''}`} aria-hidden="true">
      {d !== 0 && <span className="plo-ar">{d > 0 ? '▲' : '▼'}</span>}
      {d === 0 ? '±0' : Math.abs(d)}
    </span>
  )
}

/** The other team's line, "Them 95% → 94% ▼1": all ink, the arrow carries the sign. */
export function TheirOdds({ before, after, className }: { before: number; after: number; className?: string }) {
  const d = ptsDiff(before, after)
  return (
    <span className={className ? `plo-them num ${className}` : 'plo-them num'}>
      <span className="sr-only">
        Their playoff odds {pct(before)} to {pct(after)}, {spoken(d)}.
      </span>
      <span aria-hidden="true">
        Them {pct(before)} → {pct(after)}{' '}
        <span className="plo-them-d">
          {d !== 0 && <span className="plo-ar">{d > 0 ? '▲' : '▼'}</span>}
          {d === 0 ? '±0' : Math.abs(d)}
        </span>
      </span>
    </span>
  )
}

/** The figure line: the after-odds, the Playoffs bar with its ghost tick at before, and ▲N. */
export function PlayoffsLine({ before, after, big }: { before: number; after: number; big?: string }) {
  return (
    <span className="plo-line">
      <span className="sr-only">
        {pct(after)}, from {pct(before)}, {spoken(ptsDiff(before, after))}
        {Math.abs(ptsDiff(before, after)) === 1 ? ' point' : ptsDiff(before, after) ? ' points' : ''}.
      </span>
      <b className={big ? `plo-big num ${big}` : 'plo-big num'} aria-hidden="true">
        {pct(after)}
      </b>
      <ChangeDot before={before} after={after} side="me" bar />
      <OddsChange before={before} after={after} />
    </span>
  )
}

/** Playoffs on a Moves trade row: the one-word name, the figure line, and the other team's line. */
export function PlayoffsMark({
  before,
  after,
  them,
}: {
  before: number
  after: number
  them: { before: number; after: number } | null
}) {
  return (
    <div className="plo">
      <span className="plo-k">Playoffs</span>
      <PlayoffsLine before={before} after={after} />
      {them && <TheirOdds before={them.before} after={them.after} />}
    </div>
  )
}
