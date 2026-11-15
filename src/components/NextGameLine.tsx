// "Next game" on the player card: his line for his next game, the same one FA Targets shows
// (NextGameSwap), on its own. The column heads in the site's order, then one row of numbers, one
// per stat, never a range. Nothing to compare against, so nothing is bold. It uses NextGameSwap's
// table styles (ng-) so the two read as one thing.
import { lineCells, LINE_LABELS, type NextGameLine as Line } from '../lib/nextGame'
import './NextGameSwap.css'

export function NextGameLine({ line }: { line: Line }) {
  return (
    <div className="ng-well ng-single">
      <table className="ng-table">
        <colgroup>
          {LINE_LABELS.map((l) => (
            <col key={l.key} className={l.key.endsWith('%') ? 'ng-col-pct' : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {LINE_LABELS.map((l) => (
              <th key={l.key} scope="col" data-key={l.key}>
                <span aria-hidden="true">{l.key}</span>
                <span className="sr-only">{l.word}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="ng-nums">
            {lineCells(line).map((c) => (
              <td key={c.key} data-key={c.key} className="num">
                {c.text}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="ng-foot">A usual night, not a promise</p>
    </div>
  )
}
