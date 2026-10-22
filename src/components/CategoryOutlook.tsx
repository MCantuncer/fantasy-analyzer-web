import type { CategoryOutlook as Outlook } from '../api/client'
import { ordinal, pct, projection } from '../lib/format'

const TAG_LABEL = { locked: 'Locked', swing: 'Swing', lost: 'Losing' } as const

export function CategoryOutlook({ categories }: { categories: Outlook[] }) {
  const sorted = [...categories].sort((a, b) => b.win_pct - a.win_pct)
  return (
    <section className="card">
      <h2>Your categories</h2>
      <p className="muted">How often you win each category in an average week. Swing categories are where moves pay off.</p>
      <ul className="bars">
        {sorted.map((c) => (
          <li key={c.category} className={`bar-row tag-${c.tag}`}>
            <span className="bar-label">{c.category}</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: pct(c.win_pct) }} />
              <span className="bar-mid" />
            </span>
            <span className="bar-value">{pct(c.win_pct)}</span>
            <span className="bar-meta">
              <span className={`badge badge-${c.tag}`}>{TAG_LABEL[c.tag]}</span>
              <span className="muted">
                {ordinal(c.league_rank)} · {projection(c.category, c.weekly_projection)}
                {c.category.endsWith('%') ? '' : '/wk'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
