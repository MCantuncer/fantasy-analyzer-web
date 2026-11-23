import type { ReactNode } from 'react'
import { CATEGORY_ORDER } from '../lib/statOrder'
import './CatStrip.css'

export interface CatStripProps {
  /** Change in weekly win chance per category, as a fraction (0.09 is +9 points), keyed by category. */
  changes: Record<string, number>
  /** The heading over the strip, e.g. "What he does for you" or "Your weekly win chance". */
  title: string
  /** The line opposite the heading, e.g. "+0.07 categories won a week". */
  summary?: ReactNode
  /** Which categories get a column. Defaults to the keys of changes; always laid out in CATEGORY_ORDER. */
  categories?: readonly string[]
  /** The change that fills a bar's full 28px each way. Larger changes are capped there. */
  full?: number
}

const BAR = 28
const MIN_BAR = 3

function ordered(cats: readonly string[]): string[] {
  const known = CATEGORY_ORDER.filter((c) => cats.includes(c))
  return [...known, ...cats.filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c))]
}

/**
 * Change in weekly win chance per category as nine short columns: a 12px bar up or down from a
 * zero line, and the signed number of points under it (0 is muted). Screen readers hear one item
 * per category, "AST +9 points".
 */
export function CatStrip({ changes, title, summary, categories, full = 0.15 }: CatStripProps) {
  const cats = ordered(categories ?? Object.keys(changes))
  return (
    <div className="cs-wrap">
      <div className="cs-head">
        <span className="cs-title">{title}</span>
        {summary && <span className="cs-sum">{summary}</span>}
      </div>
      <ul className="cs" role="list" style={{ gridTemplateColumns: `repeat(${cats.length}, minmax(0, 1fr))` }}>
        {cats.map((c) => {
          const v = Math.round((changes[c] ?? 0) * 100)
          const h = v === 0 ? 0 : Math.max(MIN_BAR, Math.min(BAR, (Math.abs(v) / 100 / full) * BAR))
          const sign = v > 0 ? '+' : v < 0 ? '−' : ''
          return (
            <li key={c} aria-label={v === 0 ? `${c} no change` : `${c} ${sign}${Math.abs(v)} points`}>
              <span className="cs-c" aria-hidden="true">
                {c}
              </span>
              <span className="cs-bar" aria-hidden="true">
                {v !== 0 && <i className={v > 0 ? 'cs-up' : 'cs-down'} style={{ height: h }} />}
              </span>
              <span className={`cs-v num ${v > 0 ? 'good' : v < 0 ? 'bad' : 'cs-zero'}`} aria-hidden="true">
                {v === 0 ? '0' : `${sign}${Math.abs(v)}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
