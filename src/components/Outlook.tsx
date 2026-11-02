import type { AnalysisReport } from '../api/client'
import { ordinal, pct } from '../lib/format'
import './Outlook.css'

const TAGS = [
  { tag: 'locked', label: 'Winning' },
  { tag: 'swing', label: 'Swing' },
  { tag: 'lost', label: 'Losing' },
] as const

function record(w: number, l: number) {
  return `${w.toFixed(0)}–${l.toFixed(0)}`
}

export function Outlook({ report }: { report: AnalysisReport }) {
  const rank = report.season.findIndex((r) => r.team_id === report.team_id)
  const me = report.season[rank]
  if (!me) return null
  const line = report.season[report.league.playoff_teams - 1]
  const tone = me.playoff_pct >= 0.6 ? 'good' : me.playoff_pct >= 0.3 ? 'warn' : 'bad'
  const cats = [...report.categories].sort((a, b) => b.win_pct - a.win_pct)
  const label = (tag: string) => TAGS.find((t) => t.tag === tag)?.label ?? tag

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
      <div className="ol-cats">
        <div className="kpi-label">Categories, best to worst</div>
        <ol className="ol-pips">
          {cats.map((c) => (
            <li
              key={c.category}
              className={`ol-pip ol-${c.tag}`}
              title={`${c.category}: ${label(c.tag)}, ${pct(c.win_pct)} a week`}
            >
              <span className="num">{c.category}</span>
              <span className="sr-only">
                {' '}
                {label(c.tag)}, {pct(c.win_pct)}
              </span>
            </li>
          ))}
        </ol>
        <ul className="ol-legend" aria-hidden="true">
          {TAGS.map((t) => (
            <li key={t.tag} className={`ol-${t.tag}`}>
              {t.label} <span className="num">{cats.filter((c) => c.tag === t.tag).length}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
