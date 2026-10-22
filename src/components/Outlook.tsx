import type { AnalysisReport } from '../api/client'
import { ordinal, pct } from '../lib/format'

function record(w: number, l: number) {
  return `${w.toFixed(0)}–${l.toFixed(0)}`
}

export function Outlook({ report }: { report: AnalysisReport }) {
  const rank = report.season.findIndex((r) => r.team_id === report.team_id)
  const me = report.season[rank]
  if (!me) return null
  const line = report.season[report.league.playoff_teams - 1]
  const tone = me.playoff_pct >= 0.6 ? 'good' : me.playoff_pct >= 0.3 ? 'warn' : 'bad'
  const group = (tag: string) =>
    report.categories
      .filter((c) => c.tag === tag)
      .sort((a, b) => b.win_pct - a.win_pct)
      .map((c) => c.category)
      .join(', ') || '–'

  return (
    <section className="card outlook" aria-labelledby="outlook-title">
      <span className="eyebrow" id="outlook-title">
        Season outlook
      </span>
      <div className="kpis">
        <div>
          <div className="kpi-label">Playoff odds</div>
          <div className={`kpi-value ${tone}`}>{pct(me.playoff_pct)}</div>
        </div>
        <div>
          <div className="kpi-label">Projected finish</div>
          <div className="kpi-value">
            {ordinal(rank + 1)}
            <span className="of"> of {report.season.length}</span>
          </div>
        </div>
        <div>
          <div className="kpi-label">Projected record</div>
          <div className="kpi-value sm">{record(me.projected_wins, me.projected_losses)}</div>
        </div>
        {line && (
          <div>
            <div className="kpi-label">Playoff line</div>
            <div className="kpi-value sm">
              {ordinal(report.league.playoff_teams)} · {record(line.projected_wins, line.projected_losses)}
            </div>
          </div>
        )}
      </div>
      <div className="cat-groups">
        <div>
          <strong className="good">Winning</strong>
          {group('locked')}
        </div>
        <div>
          <strong className="warn">Swing</strong>
          {group('swing')}
        </div>
        <div>
          <strong className="bad">Losing</strong>
          {group('lost')}
        </div>
      </div>
    </section>
  )
}
