import type { CategoryOutlook } from '../api/client'
import { ordinal, pct } from '../lib/format'

export const TAG = {
  locked: { label: 'Winning', tone: 'good' },
  swing: { label: 'Swing', tone: 'warn' },
  lost: { label: 'Losing', tone: 'bad' },
} as const

export function CategoryTiles({ categories }: { categories: CategoryOutlook[] }) {
  const sorted = [...categories].sort((a, b) => b.win_pct - a.win_pct)
  return (
    <section aria-labelledby="tiles-title">
      <div className="section-head">
        <h2 id="tiles-title">How often you win each category</h2>
        <span className="small muted">League rank in brackets. Moves aim at the swing categories.</span>
      </div>
      <ul className="tiles">
        {sorted.map((c) => {
          const tag = TAG[c.tag]
          return (
            <li key={c.category} className="tile">
              <div className="tile-head">
                <strong>{c.category}</strong>
                <span className="small muted">({ordinal(c.league_rank)})</span>
              </div>
              <div className="tile-value num">{pct(c.win_pct)}</div>
              <div className="meter" aria-hidden="true">
                <span className={`fill-${tag.tone}`} style={{ width: pct(c.win_pct) }} />
              </div>
              <div className={`tile-tag ${tag.tone}`}>{tag.label}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
