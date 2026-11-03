import { useId, useState } from 'react'
import type { CategoryOutlook as Outlook } from '../api/client'
import { ordinal, pct, projection } from '../lib/format'
import { TAG } from './CategoryTiles'
import './CategoryOutlook.css'

const HINT = {
  locked: 'upgrades wasted',
  swing: 'where moves help',
  lost: 'likely punts',
} as const

export function CategoryOutlook({ categories }: { categories: Outlook[] }) {
  const [help, setHelp] = useState(false)
  const helpId = useId()
  const sorted = [...categories].sort((a, b) => b.win_pct - a.win_pct)
  const groups = (Object.keys(TAG) as (keyof typeof TAG)[])
    .map((tag) => ({ tag, cats: sorted.filter((c) => c.tag === tag) }))
    .filter((g) => g.cats.length > 0)

  return (
    <section className="card stack co" aria-labelledby="cats-title">
      <div>
        <div className="co-head">
          <h2 id="cats-title">Your categories</h2>
          <button
            type="button"
            className="co-help"
            aria-expanded={help}
            aria-controls={helpId}
            aria-label="What this shows"
            onClick={() => setHelp(!help)}
          >
            ?
          </button>
        </div>
        {help && (
          <p className="small muted" id={helpId}>
            How often you win each category in an average week. The line marks 50%. Upgrades in categories you already
            win are wasted, so moves target the swing categories.
          </p>
        )}
        <p className="co-legend small muted" aria-hidden="true">
          Win chance <span className="co-legend-mid" /> 50% · <span className="co-rank">rank</span> · avg a week
        </p>
      </div>
      {groups.map(({ tag, cats }) => (
        <div key={tag} className="co-group">
          <h3 className={`co-group-head ${TAG[tag].tone}`}>
            <span className={`co-dot fill-${TAG[tag].tone}`} aria-hidden="true" />
            {TAG[tag].label} <span className="num">{cats.length}</span>
            <span className="co-hint">{HINT[tag]}</span>
          </h3>
          <ul className="co-rows">
            {cats.map((c) => (
              <li key={c.category} className="co-row">
                <span className="co-cat num">{c.category}</span>
                <span className="co-rank" title={`${ordinal(c.league_rank)} in the league`}>
                  <span className="sr-only">League rank </span>
                  {ordinal(c.league_rank)}
                </span>
                <span className="bar-track" aria-hidden="true">
                  <span className={`fill-${TAG[tag].tone}`} style={{ width: pct(c.win_pct) }} />
                  <span className="bar-mid" />
                </span>
                <span className="co-pct num">
                  <span className="sr-only">wins </span>
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
