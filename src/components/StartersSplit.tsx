import type { CSSProperties } from 'react'
import { teamLight } from '../lib/nbaTeams'
import { TeamLogo } from './PlayerHead'
import './StartersSplit.css'

/*
 * Starters and bench, "The Cut" with a bench title (Can, 2026-11-07). With no sort, the box score is cut
 * in two: a channel of page colour runs through the card between the starting five and the bench, both
 * blocks round their corners into it, and the cut carries the team's logo and a confident "Bench 8" in
 * a soft glow of the team's colour. It is one table: the cut is a row, so the columns stay lined up.
 */
export function BenchBreak({ count, abbrev }: { count: number; abbrev: string }) {
  const style = { '--tc': teamLight(abbrev) ?? 'var(--accent)' } as CSSProperties
  return (
    <tr className="sc-bench-break" style={style}>
      <th scope="rowgroup" colSpan={12}>
        <span className="sc-cut">
          <span className="sc-cut-label">
            <TeamLogo abbrev={abbrev} size={22} />
            <span className="sc-cut-title">Bench</span>
            <span className="sc-cut-count num">{count}</span>
          </span>
        </span>
      </th>
    </tr>
  )
}

/** Screen readers hear "Starter" after a starter's name while a sort has merged the list. */
export function StarterNote() {
  return <span className="sr-only">Starter</span>
}
