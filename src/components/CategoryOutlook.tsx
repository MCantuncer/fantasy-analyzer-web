import type { CSSProperties } from 'react'
import { ChartBar } from '@phosphor-icons/react'
import type { CategoryOutlook as Outlook } from '../api/client'
import { ordinal, pct, projection } from '../lib/format'
import './CategoryOutlook.css'

/**
 * Winning, Swing, Losing: plain win-chance order, top to bottom. Colour is light on outcomes only: the
 * Winning and Losing words and their bars. Swing is neutral, so it gets ink and weight instead.
 */
const GROUPS = [
  { tag: 'locked', label: 'Winning', tone: 'won', hint: 'upgrades wasted' },
  { tag: 'swing', label: 'Swing', tone: 'in', hint: 'where moves help' },
  { tag: 'lost', label: 'Losing', tone: 'lost', hint: 'likely punts' },
] as const

export function CategoryOutlook({ categories }: { categories: Outlook[] }) {
  const sorted = [...categories].sort((a, b) => b.win_pct - a.win_pct)
  const groups = GROUPS.map((g) => ({ ...g, cats: sorted.filter((c) => c.tag === g.tag) })).filter(
    (g) => g.cats.length > 0,
  )

  return (
    <section className="co" aria-labelledby="cats-title">
      <div className="co-head">
        <h2 id="cats-title" className="co-title">
          <ChartBar size={22} aria-hidden="true" />
          Your categories
        </h2>
      </div>
      <div className="co-ch" aria-hidden="true">
        <span>Rank</span>
        <span className="co-ch-bar">Win chance</span>
        <span className="co-ch-avg">A week</span>
      </div>
      {groups.map((g) => (
        <div key={g.tag} className={`co-group co-${g.tone}`}>
          <h3 className="co-g">
            <b>
              {g.label} <span className="num">{g.cats.length}</span>
            </b>
            <span className="co-hint">{g.hint}</span>
          </h3>
          <ul className="co-rows">
            {g.cats.map((c) => (
              <li key={c.category} className="co-row">
                <span className="co-rank num">
                  <span className="sr-only">League rank </span>
                  {ordinal(c.league_rank)}
                  <span className="sr-only">, </span>
                </span>
                <span className="co-cat">{c.category}</span>
                <span className="co-bar" aria-hidden="true">
                  <i style={{ '--w': pct(c.win_pct) } as CSSProperties} />
                  <b />
                </span>
                <span className="co-pct num">
                  <span className="sr-only">, wins </span>
                  {pct(c.win_pct)}
                </span>
                <span className="co-avg num" title={c.category.endsWith('%') ? 'Average' : 'Average a week'}>
                  <span className="sr-only">, averages </span>
                  {projection(c.category, c.weekly_projection)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
