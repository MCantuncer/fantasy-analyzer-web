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

/** One compact tile per category, in ESPN's fixed order: code, league rank, win share, outcome word.
 *  The outcome shows as a thin left edge and the word, never as a filled tile. */
export function CategoryTiles({
  categories,
  scout,
}: {
  categories: CategoryOutlook[]
  /** The team being scouted in the sample league, named in place of "you". */
  scout?: string
}) {
  const ordered = [...categories].sort((a, b) => place(a.category) - place(b.category))
  const count = (tag: keyof typeof TAG) => categories.filter((c) => c.tag === tag).length
  return (
    <section className="ct" aria-labelledby="tiles-title">
      <div className="ct-head">
        <h2 id="tiles-title">
          <Ranking size={20} aria-hidden="true" />
          How often {scout ?? 'you'} {scout ? 'wins' : 'win'} each category
        </h2>
        <span className="ct-note">
          {(Object.keys(TAG) as (keyof typeof TAG)[]).map((t, i) => (
            <span key={t}>
              {i > 0 && ' · '}
              {TAG[t].label} <span className="num">{count(t)}</span>
            </span>
          ))}
        </span>
      </div>
      <ul className="ct-grid">
        {ordered.map((c) => {
          const tag = TAG[c.tag]
          return (
            <li key={c.category} className={`ct-tile ct-${tag.tone}`}>
              <div className="ct-top">
                <span className="ct-code num">
                  {c.category}
                  {LOWER_IS_BETTER.has(c.category) && (
                    <ArrowDown size={10} weight="bold" aria-label="lower is better">
                      <title>Lower is better</title>
                    </ArrowDown>
                  )}
                </span>
                <span className="ct-rank num" title={`${ordinal(c.league_rank)} in the league`}>
                  <span className="sr-only">League rank </span>
                  {ordinal(c.league_rank)}
                </span>
              </div>
              <div className="ct-value num">
                {Math.round(c.win_pct * 100)}
                <small>%</small>
              </div>
              <div className="ct-tag">{tag.label}</div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
