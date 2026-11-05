import type { CategoryOutlook } from '../api/client'
import { ordinal } from '../lib/format'
import './CategoryTiles.css'

export const TAG = {
  locked: { label: 'Winning', tone: 'good' },
  swing: { label: 'Swing', tone: 'swing' },
  lost: { label: 'Losing', tone: 'bad' },
} as const

/** Shape per outcome, so the tag reads without colour: ■ winning, ◆ swing, ▼ losing. */
const GLYPH = { good: '■', swing: '◆', bad: '▼' } as const

export function CategoryTiles({ categories }: { categories: CategoryOutlook[] }) {
  const sorted = [...categories].sort((a, b) => b.win_pct - a.win_pct)
  return (
    <section aria-labelledby="tiles-title">
      <div className="section-head">
        <h2 id="tiles-title">How often you win each category</h2>
        <span className="small muted">League rank in the corner. Moves aim at the swing categories.</span>
      </div>
      <ul className="ct-grid">
        {sorted.map((c) => {
          const tag = TAG[c.tag]
          const win = Math.round(c.win_pct * 100)
          return (
            <li key={c.category} className={`ct-tile ct-${tag.tone}`}>
              <div className="ct-head">
                <strong>{c.category}</strong>
                <span className="ct-rank num" title={`${ordinal(c.league_rank)} in the league`}>
                  <span aria-hidden="true">{GLYPH[tag.tone]}</span>
                  <span className="sr-only">League rank </span>
                  {ordinal(c.league_rank)}
                </span>
              </div>
              <div className="ct-value num">
                {win}
                <small>%</small>
              </div>
              <div className="ct-meter" aria-hidden="true">
                <span className="ct-fill" style={{ width: `${win}%` }} />
                <span className="ct-notch" />
              </div>
              <div className="ct-tag">{tag.label}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
