import type { CategoryOutlook as Outlook } from '../api/client'
import { ordinal, pct, projection } from '../lib/format'
import { TAG } from './CategoryTiles'

export function CategoryOutlook({ categories }: { categories: Outlook[] }) {
  const sorted = [...categories].sort((a, b) => b.win_pct - a.win_pct)
  return (
    <section className="card stack" aria-labelledby="cats-title">
      <div>
        <h2 id="cats-title">Your categories</h2>
        <p className="small muted">
          How often you win each category in an average week. The line marks 50%. Upgrades in categories you already
          win are wasted, so moves target the swing categories.
        </p>
      </div>
      <ul className="bars">
        {sorted.map((c) => {
          const tag = TAG[c.tag]
          return (
            <li key={c.category} className="bar-row">
              <span className="bar-label">{c.category}</span>
              <span className="bar-track" aria-hidden="true">
                <span className={`fill-${tag.tone}`} style={{ width: pct(c.win_pct) }} />
                <span className="bar-mid" />
              </span>
              <span className="bar-value num">{pct(c.win_pct)}</span>
              <span className="bar-meta">
                <strong className={tag.tone}>{tag.label}</strong>
                <span className="muted">
                  {ordinal(c.league_rank)} in the league · {projection(c.category, c.weekly_projection)}
                  {c.category.endsWith('%') ? '' : ' a week'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
