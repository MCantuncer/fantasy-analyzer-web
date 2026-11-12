import { Binoculars, ChartLineUp, User } from '@phosphor-icons/react'
import type { AnalysisReport } from '../api/client'
import { ordinal, pct } from '../lib/format'
import './Outlook.css'

function record(w: number, l: number) {
  return `${w.toFixed(0)}–${l.toFixed(0)}`
}

/** How far you are from the playoff line, in category wins. */
function gapLine(mine: number, line: number, inside: boolean) {
  const gap = Math.round(Math.abs(line - mine))
  const wins = `${gap} ${gap === 1 ? 'win' : 'wins'}`
  if (gap === 0) return { strong: 'On the line', rest: '' }
  return inside ? { strong: wins, rest: ' clear of the line' } : { strong: wins, rest: ' short of the line' }
}

/** Season outlook: big playoff odds, the projected standings as a ladder with the playoff line, two records. */
export function Outlook({
  report,
  scout,
}: {
  report: AnalysisReport
  /** The team being scouted in the sample league: its rung carries binoculars and its name, not "You". */
  scout?: string
}) {
  const rank = report.season.findIndex((r) => r.team_id === report.team_id)
  const me = report.season[rank]
  if (!me) return null
  const spots = report.league.playoff_teams
  const inside = rank < spots
  // Inside: compare with the first team out. Outside: compare with the last team in.
  const rival = report.season[inside ? spots : spots - 1]
  const line = report.season[spots - 1]
  const gap = rival ? gapLine(me.projected_wins, rival.projected_wins, inside) : null

  return (
    <section className="card outlook" aria-labelledby="outlook-title">
      <h2 className="ol-title" id="outlook-title">
        <ChartLineUp size={20} aria-hidden="true" />
        Season outlook
      </h2>
      <div className="ol-top">
        <div>
          <div className="ol-big num">
            {Math.round(me.playoff_pct * 100)}
            <span className="ol-pc">%</span>
          </div>
          <div className="ol-sub">playoff odds</div>
        </div>
        {gap && (
          <div className="ol-gap">
            <b>{gap.strong}</b>
            {gap.rest}
          </div>
        )}
      </div>
      <div>
        <ol className="ol-ladder" aria-label={`Projected finish ${ordinal(rank + 1)} of ${report.season.length}`}>
          {report.season.map((r, i) => (
            <li
              key={r.team_id}
              className={`ol-rung num${i < spots ? ' in' : ''}${i === rank ? (scout ? ' scout' : ' me') : ''}`}
              title={`${ordinal(i + 1)}: ${r.team_name}, ${pct(r.playoff_pct)} playoff odds`}
            >
              {i !== rank ? (
                i + 1
              ) : scout ? (
                <Binoculars size={14} weight="bold" aria-label={scout} />
              ) : (
                <User size={14} weight="bold" aria-label="You" />
              )}
            </li>
          ))}
        </ol>
        <div className="ol-key">
          <span>Playoffs · top {spots}</span>
          <span>
            {scout ? (
              <Binoculars size={12} weight="bold" aria-hidden="true" />
            ) : (
              <User size={12} weight="bold" aria-hidden="true" />
            )}
            {scout ?? 'You'}, projected {ordinal(rank + 1)}
          </span>
        </div>
      </div>
      <div className="ol-stats">
        <div className="ol-stat">
          <span className="ol-stat-label">Projected record</span>
          <span className="num">{record(me.projected_wins, me.projected_losses)}</span>
        </div>
        {line && (
          <div className="ol-stat">
            <span className="ol-stat-label">Playoff line · {ordinal(spots)}</span>
            <span className="num">{record(line.projected_wins, line.projected_losses)}</span>
          </div>
        )}
      </div>
    </section>
  )
}
