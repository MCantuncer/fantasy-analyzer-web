import { STAT_NAME, nightLabel } from '../lib/iddaaCompare'
import type { BookCompare, Line } from '../lib/iddaaCompare'
import { BOOK_LIFT, LEVEL_GAP, scoreRows } from '../lib/valueRungs'
import type { ScoreRow } from '../lib/valueRungs'
import './RungScorecard.css'

/** The Scorecard: who read the rungs better, stat by stat. Every rung, both chances, one result: a
 *  Brier score per side from the server's tally, the lower circled, Level when the gap is noise. */
export function RungScorecard({ data, lines, settled }: { data: BookCompare; lines: Line[]; settled: boolean }) {
  const served = data.games.some((g) => g.players.some((p) => p.rungs !== undefined))
  const waiting = lines.reduce((s, l) => s + (l.kind === 'player' ? l.rungs.length : 0), 0)
  if (!served || waiting === 0) return null
  const rows = scoreRows(data.tally, lines)
  const all = rows[rows.length - 1]
  const playerRows = lines.filter((l) => l.kind === 'player' && l.rungs.length > 0 && l.rungCloser != null).length
  return (
    <section className="ic-sec vr-sc" aria-labelledby="vr-sc-h">
      <h2 id="vr-sc-h" className="vr-sc-title">
        <CardIcon />
        Scorecard: Who Read It Better
      </h2>
      <p className="vr-sc-gloss">
        Every rung, both chances, one result. A rung's score is how far its chance sat from what happened, squared:{' '}
        <b>0 is perfect, 0.25 is a coin-flip guess</b>. Lower is better.
      </p>
      {all.rungs === 0 ? (
        <div className="vr-empty" role="status">
          <b>No results yet.</b>
          <p>
            Scores fill in stat by stat as games go final. <span className="num">{waiting.toLocaleString('en')}</span> rungs
            are waiting.
          </p>
        </div>
      ) : (
        <div className="vr-sc-grid">
          <div className="vr-sc-card">
            <h3>
              {nightLabel(data.date)} by stat
              <small>
                <span className="num">{all.rungs.toLocaleString('en')}</span> rungs ·{' '}
                <span className="num">{playerRows}</span> player rows{settled ? '' : ' so far'}
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
                  <th scope="col" className="sp">
                    Player rows
                    <br />
                    <span className="vr-hide-s">ours · level · book</span>
                    <span className="vr-ph-in">ours·lvl·book</span>
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
              Gaps under {LEVEL_GAP} show as Level: at a night's rung counts that is noise. In the split, open is ours,
              solid is the book.
            </p>
          </div>
          <Why />
        </div>
      )}
    </section>
  )
}

function Row({ row: r }: { row: ScoreRow }) {
  const name = r.stat === 'ALL' ? 'All' : STAT_NAME[r.stat]
  const short = r.stat === 'ALL' ? 'All' : r.stat
  const cell = (v: number | null, lower: boolean, who: string) =>
    v == null ? (
      '–'
    ) : lower ? (
      <span className="vr-circ" aria-label={`${who} ${v.toFixed(3)}, lower`}>
        {v.toFixed(3)}
      </span>
    ) : (
      v.toFixed(3)
    )
  const tot = r.split.ours + r.split.level + r.split.book
  return (
    <tr className={r.stat === 'ALL' ? 'all' : undefined}>
      <th scope="row">
        <span className="vr-hide-s">{name}</span>
        <span className="vr-ph-in">{short}</span>
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
      <td className="sp">
        {tot > 0 && (
          <>
            <span className="vr-split" aria-hidden="true">
              {r.split.ours > 0 && <i className="o" style={{ flex: r.split.ours }} />}
              {r.split.level > 0 && <i className="l" style={{ flex: r.split.level }} />}
              {r.split.book > 0 && <i className="b" style={{ flex: r.split.book }} />}
            </span>
            <small className="num" aria-label={`ours ${r.split.ours}, level ${r.split.level}, book ${r.split.book}`}>
              {r.split.ours} · {r.split.level} · {r.split.book}
            </small>
          </>
        )}
      </td>
    </tr>
  )
}

function Why() {
  return (
    <div className="vr-sc-card vr-why">
      <h3>Why rungs, not the line</h3>
      <p>The book sells overs only, so it sets every rung high. On 21 Nov its rungs sat above our lines by about:</p>
      <div className="vr-lift">
        {BOOK_LIFT.map((x) => (
          <span key={x.stat}>
            {STAT_NAME[x.stat]} <b className="num">{x.lift}</b>
          </span>
        ))}
      </div>
      <p>
        So the book's single line, where its ladder crosses 50%, carries that lift, and "whose line was closer" leaned
        toward whoever guessed low. Scoring the chance on every rung asks one fair question of both sides.
      </p>
      <p>
        Player rows now say <b>Ours read it better</b> or <b>Book read it better</b> by rung score, in place of the
        line-distance Closer.
      </p>
    </div>
  )
}

function CardIcon() {
  return (
    <svg className="ic-i vr-hi" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" />
    </svg>
  )
}
