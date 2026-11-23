// "Next game" on the player card: his line for his next game, the same one FA Targets shows
// (NextGameSwap), on its own. The column heads in the site's order, then one row of numbers, one
// per stat, never a range. Nothing to compare against, so nothing is bold. It uses NextGameSwap's
// table styles (ng-) so the two read as one thing.
import { lineCells, LINE_LABELS, type NextGameLine as Line } from '../lib/nextGame'
import { usePro } from '../lib/pro'
import { ProMark } from './Pro'
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

/**
 * The same well for a Free account: the column heads, his numbers blurred past reading (stand-ins,
 * not his line: the API sends none), and one button over them that opens the Pro sheet.
 */
export function NextGameLocked() {
  const { open } = usePro()
  return (
    <button
      type="button"
      className="ng-well ng-single ng-locked"
      aria-haspopup="dialog"
      aria-label="His line for tonight is a Pro feature. See Pro plans"
      onClick={open}
    >
      <table className="ng-table" aria-hidden="true">
        <colgroup>
          {LINE_LABELS.map((l) => (
            <col key={l.key} className={l.key.endsWith('%') ? 'ng-col-pct' : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {LINE_LABELS.map((l) => (
              <th key={l.key}>{l.key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="ng-nums">
            {LINE_LABELS.map((l, i) => (
              <td key={l.key} className="num">
                {l.key.endsWith('%') ? '.488' : String((i * 7 + 3) % 28)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <span className="ng-unlock" aria-hidden="true">
        <ProMark label={false} />
        See his line for tonight
      </span>
    </button>
  )
}
