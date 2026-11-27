import { ArrowDown, Ranking } from '@phosphor-icons/react'
import type { CategoryOutlook } from '../api/client'
import { ordinal } from '../lib/format'
import './CategoryTiles.css'

export const TAG = {
  locked: { label: 'Winning', tone: 'good' },
  swing: { label: 'Swing', tone: 'swing' },
  lost: { label: 'Losing', tone: 'bad' },
} as const

/** Categories where fewer is better. */
const LOWER_IS_BETTER = new Set(['TO'])

/** ESPN's 9-cat order. Anything else keeps its place after these. */
const ORDER = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']

function place(cat: string) {
  const i = ORDER.indexOf(cat)
  return i === -1 ? ORDER.length : i
}

/**
 * The category line (Quiet Lead): nine cells on one soft field in ESPN's order, no rims or boxes.
 * Each cell has the code, the league rank, the win share and the state word. Winning and Losing
 * cells get light rising from the bottom edge and a coloured word; Swing stays neutral.
 */
export function CategoryTiles({
  categories,
  scout,
}: {
  categories: CategoryOutlook[]
  /** The team being scouted in the sample league, named in place of "you". */
  scout?: string
}) {
  const ordered = [...categories].sort((a, b) => place(a.category) - place(b.category))
  return (
    <section className="ct" aria-labelledby="tiles-title">
      <h2 className="ct-title" id="tiles-title">
        <Ranking size={20} aria-hidden="true" />
        How often {scout ?? 'you'} {scout ? 'wins' : 'win'} each category
      </h2>
      <ul className="ct-line">
        {ordered.map((c) => {
          const tag = TAG[c.tag]
          const share = Math.round(c.win_pct * 100)
          const lower = LOWER_IS_BETTER.has(c.category)
          return (
            <li
              key={c.category}
              className={`ct-cell ct-${tag.tone}`}
              aria-label={`${c.category}${lower ? ' (lower is better)' : ''}: wins ${share}% of weeks, ${ordinal(c.league_rank)} in the league, ${tag.label}`}
            >
              <span className="ct-top" aria-hidden="true">
                <span className="ct-code num">
                  {c.category}
                  {lower && <ArrowDown size={10} weight="bold" />}
                </span>
                <span className="ct-rank num">{ordinal(c.league_rank)}</span>
              </span>
              <span className="ct-pct num" aria-hidden="true">
                {share}
                <small>%</small>
              </span>
              <span className="ct-word" aria-hidden="true">
                {tag.label}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
