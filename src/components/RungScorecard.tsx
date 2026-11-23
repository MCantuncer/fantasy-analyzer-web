import { STAT_NAME, nightLabel } from '../lib/iddaaCompare'
import type { BookCompare, Line } from '../lib/iddaaCompare'
import { scoredRungs } from '../lib/ourRecord'
import { LEVEL_GAP, scoreRows } from '../lib/valueRungs'
import type { ScoreRow } from '../lib/valueRungs'
import './RungScorecard.css'

/** The night's rungs by stat: who read them better. Every rung, both chances, one result: a Brier
 *  score per side from the server's tally, the lower in bold with "Ours" or "Book" written beside it,
 *  Level when the gap is noise. It sits inside Our record's "Running record" row once a game is final;
 *  null before any result. */
export function RungScorecard({ data, lines, settled }: { data: BookCompare; lines: Line[]; settled: boolean }) {
  if (!scoredRungs(data.tally, lines)) return null
  const rows = scoreRows(data.tally, lines)
  const all = rows[rows.length - 1]
  return (
    <div className="vr-sc">
      <h3>
        {nightLabel(data.date)} by stat
        <small>
          <span className="num">{all.rungs.toLocaleString('en')}</span> rungs{settled ? '' : ' so far'} · score, lower
          is better
        </small>
      </h3>
      <table className="vr-sc-table">
        <caption className="sr-only">Rung scores by stat, lower is better</caption>
        <thead>
          <tr>
            <th scope="col">Stat</th>
            <th scope="col" className="n">
              Ours
            </th>
            <th scope="col" className="n">
              Book
            </th>
            <th scope="col" className="rb">
              Read better
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.stat} row={r} />
          ))}
        </tbody>
      </table>
      <p className="vr-sc-foot">
        A score is how far a rung's chance sat from what happened, squared: 0 is perfect, 0.25 a coin flip. Gaps under{' '}
        {LEVEL_GAP} show as Level.
      </p>
    </div>
  )
}

function Row({ row: r }: { row: ScoreRow }) {
  const name = r.stat === 'ALL' ? 'All' : STAT_NAME[r.stat]
  const cell = (v: number | null, lower: boolean, who: string) =>
    v == null ? (
      '–'
    ) : lower ? (
      <b aria-label={`${who} ${v.toFixed(3)}, lower`}>{v.toFixed(3)}</b>
    ) : (
      v.toFixed(3)
    )
  return (
    <tr className={r.stat === 'ALL' ? 'all' : undefined}>
      <th scope="row">
        {name}
        <small>
          <span className="num">{r.rungs.toLocaleString('en')}</span> rungs
        </small>
      </th>
      {r.rungs === 0 ? (
        <td colSpan={3} className="none">
          No results yet
        </td>
      ) : (
        <>
          <td className="n">{cell(r.ours, r.read === 'ours', 'ours')}</td>
          <td className="n">{cell(r.book, r.read === 'book', 'book')}</td>
          <td className={`rb ${r.read ?? ''}`}>{r.read === 'tie' ? 'Level' : r.read === 'ours' ? 'Ours' : r.read === 'book' ? 'Book' : '–'}</td>
        </>
      )}
    </tr>
  )
}
