import { signedInt } from '../lib/format'

// A 25-point swing fills one side of the chart.
const FULL = 0.25

/** Change in weekly win chance per category, as diverging bars. */
export function ImpactBars({ changes, label }: { changes: Record<string, number>; label: string }) {
  const rows = Object.entries(changes)
    .map(([cat, v]) => [cat, Math.round(v * 100)] as const)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1])
  if (!rows.length) return null
  return (
    <div>
      <div className="detail-label">{label}</div>
      <ul className="impact">
        {rows.map(([cat, v]) => {
          const width = `${Math.min(100, (Math.abs(v) / 100 / FULL) * 100)}%`
          return (
            <li key={cat}>
              <span>{cat}</span>
              <span className="neg" aria-hidden="true">
                {v < 0 && <span style={{ width }} />}
              </span>
              <span className="pos" aria-hidden="true">
                {v > 0 && <span style={{ width }} />}
              </span>
              <span className={`val num ${v > 0 ? 'good' : 'bad'}`}>{signedInt(v)} pts</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
