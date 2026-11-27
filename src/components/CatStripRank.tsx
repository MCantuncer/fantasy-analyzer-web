import type { CSSProperties } from 'react'
import { rankBar } from '../lib/catStrip'
import './CatStrip.css'

const statLabel = (stat: string) => (stat === 'TO' ? 'TO↓' : stat)

/** The category labels over a column of `rank` strips, in the same nine columns. */
export function CatStripRankHead({ categories }: { categories: readonly string[] }) {
  return (
    <div className="cs-rank cs-rhead" aria-hidden="true" style={{ '--n': categories.length } as CSSProperties}>
      {categories.map((c) => (
        <span key={c} className="cs-rl">
          {statLabel(c)}
        </span>
      ))}
    </div>
  )
}

/**
 * CatStrip's `rank` variant (League builds): a team's weekly rank in each category as a short bar
 * from the middle of the league, up for strong and down for weak, with the rank beside it. 1st–2nd
 * fade in green, likely punts in coral (rank too), everything else is a neutral stub. Screen
 * readers hear one item per category, "FG% rank 8, likely punt".
 */
export function CatStripRank({
  ranks,
  weak,
  n,
  categories,
  label,
}: {
  ranks: Record<string, number>
  /** The team's likely punts. */
  weak: readonly string[]
  /** Teams in the league. */
  n: number
  categories: readonly string[]
  label: string
}) {
  return (
    <ul className="cs-rank" role="list" aria-label={label} style={{ '--n': categories.length } as CSSProperties}>
      {categories.map((c) => {
        const r = ranks[c]
        if (r == null)
          return (
            <li key={c} aria-label={`${c} no rank`}>
              <span className="cs-rn num" aria-hidden="true">
                –
              </span>
            </li>
          )
        const punt = weak.includes(c)
        const bar = rankBar(r, n, punt)
        const said = `${c} rank ${r}${punt ? ', likely punt' : r <= 2 ? ', top two' : ''}`
        return (
          <li key={c} aria-label={said}>
            <span className="cs-rb" aria-hidden="true">
              <i
                className={`${bar.dir === 'up' ? 'cs-rup' : 'cs-rdn'} cs-${bar.tone}`}
                style={{ '--share': bar.share.toFixed(3) } as CSSProperties}
              />
            </span>
            <span className={`cs-rn num cs-rn-${bar.tone}`} aria-hidden="true">
              {r}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
