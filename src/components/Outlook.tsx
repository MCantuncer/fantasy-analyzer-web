import { ChartLineUp } from '@phosphor-icons/react'
import type { CSSProperties } from 'react'
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

/**
 * Season outlook as the lead's foot band (Quiet Lead): a flat ladder of the projected standings
 * (your seat gold and taller, the playoff line after the last spot), one sentence on where that
 * leaves you, and the two records as plain figures. The playoff odds are not repeated here: the
 * lead's chart already says "56% today".
 */
export function SeasonBand({
  report,
  scout,
}: {
  report: AnalysisReport
  /** The team being scouted in the sample league: its seat is labelled "Scouting", never "you". */
  scout?: string
}) {
  const rank = report.season.findIndex((r) => r.team_id === report.team_id)
  const me = report.season[rank]
  if (!me) return null
  const teams = report.season.length
  const spots = report.league.playoff_teams
  const inside = rank < spots
  // Inside: compare with the first team out. Outside: compare with the last team in.
  const rival = report.season[inside ? spots : spots - 1]
  const line = report.season[spots - 1]
  const gap = rival ? gapLine(me.projected_wins, rival.projected_wins, inside) : null

  return (
    <div className="mvl-season" role="group" aria-labelledby="outlook-title">
      <h3 className="mvl-season-k" id="outlook-title">
        <ChartLineUp size={16} aria-hidden="true" />
        Season outlook
      </h3>
      <div className={scout ? 'mvl-ladder has-scout' : 'mvl-ladder'}>
        <ol
          className="mvl-rungs"
          aria-label={`Projected finish ${ordinal(rank + 1)} of ${teams}. Top ${spots} make the playoffs.`}
        >
          {report.season.map((r, i) => (
            <li
              key={r.team_id}
              className={`mvl-rung${i < spots ? ' in' : ''}${i === rank ? (scout ? ' me scout' : ' me') : ''}${i === spots - 1 && spots < teams ? ' last-in' : ''}`}
              title={`${ordinal(i + 1)}: ${r.team_name}, ${pct(r.playoff_pct)} playoff odds`}
            >
              {i === rank && scout ? (
                <span className={`mvl-scout-k${i < 2 ? ' at-start' : i > teams - 3 ? ' at-end' : ''}`}>
                  Scouting<span className="sr-only">: {scout}</span>
                </span>
              ) : (
                <span className="sr-only">
                  {ordinal(i + 1)}: {i === rank ? 'You' : r.team_name}
                </span>
              )}
            </li>
          ))}
        </ol>
        {spots < teams && (
          <div className="mvl-ladder-k" aria-hidden="true" style={{ '--in': spots / teams } as CSSProperties}>
            <span>top {spots} make it</span>
          </div>
        )}
      </div>
      <p className="mvl-season-say">
        Projected <b className="num">{ordinal(rank + 1)}</b> of {teams}
        {gap && (
          <>
            {' · '}
            <b className="num">{gap.strong}</b>
            {gap.rest}
          </>
        )}
      </p>
      <div className="mvl-recs">
        <span className="mvl-rec">
          <span className="mvl-rec-k">Projected record</span>
          <span className="mvl-rec-v num">{record(me.projected_wins, me.projected_losses)}</span>
        </span>
        {line && (
          <span className="mvl-rec">
            <span className="mvl-rec-k">Playoff line · {ordinal(spots)}</span>
            <span className="mvl-rec-v num">{record(line.projected_wins, line.projected_losses)}</span>
          </span>
        )}
      </div>
    </div>
  )
}
