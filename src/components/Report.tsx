import type { AnalysisReport } from '../api/client'
import { pct } from '../lib/format'
import { Builds } from './Builds'
import { CategoryOutlook } from './CategoryOutlook'
import { Pickups } from './Pickups'
import { Roster } from './Roster'
import { Season } from './Season'
import { Trades } from './Trades'

interface Props {
  report: AnalysisReport
  keep: number[]
  keepChanged: boolean
  onToggleKeep: (id: number) => void
  onRerun: () => void
  rerunning: boolean
}

function BestMove({ report }: { report: AnalysisReport }) {
  const trade = report.trades[0]
  const pickup = report.pickups[0]
  const tradeGain = trade ? trade.playoff_pct_after - trade.playoff_pct_before : -1
  const pickupGain = pickup ? pickup.playoff_pct_after - pickup.playoff_pct_before : -1
  if (tradeGain <= 0 && pickupGain <= 0) return <p>No single move clearly raises your playoff odds right now.</p>
  if (pickupGain >= tradeGain && pickup) {
    return (
      <p>
        Best move: add <strong>{pickup.add.name}</strong> and drop <strong>{pickup.drop.name}</strong>. Your playoff
        odds go from {pct(pickup.playoff_pct_before)} to {pct(pickup.playoff_pct_after)}, and no one has to agree.
      </p>
    )
  }
  return (
    <p>
      Best move: offer <strong>{trade.give.map((p) => p.name).join(' + ')}</strong> to {trade.partner_team_name} for{' '}
      <strong>{trade.get.map((p) => p.name).join(' + ')}</strong>. Your playoff odds go from{' '}
      {pct(trade.playoff_pct_before)} to {pct(trade.playoff_pct_after)}.
    </p>
  )
}

export function Report({ report, keep, keepChanged, onToggleKeep, onRerun, rerunning }: Props) {
  const me = report.season.find((r) => r.team_id === report.team_id)
  const rank = report.season.findIndex((r) => r.team_id === report.team_id) + 1
  const locked = report.categories.filter((c) => c.tag === 'locked').map((c) => c.category)
  const lost = report.categories.filter((c) => c.tag === 'lost').map((c) => c.category)

  return (
    <div className="stack">
      <section className="card hero">
        <div className="muted">{report.league.name}</div>
        <h1>{report.team_name}</h1>
        {me && (
          <div className="stats">
            <div>
              <span className="muted">Playoff odds</span>
              <strong>{pct(me.playoff_pct)}</strong>
            </div>
            <div>
              <span className="muted">Projected finish</span>
              <strong>
                {rank} of {report.season.length}
              </strong>
            </div>
            <div>
              <span className="muted">Projected record</span>
              <strong>
                {me.projected_wins.toFixed(0)}-{me.projected_losses.toFixed(0)}
              </strong>
            </div>
          </div>
        )}
        <BestMove report={report} />
        <p className="muted">
          You win {locked.join(', ') || 'no category'} most weeks
          {lost.length ? ` and lose ${lost.join(', ')} most weeks` : ''}. Upgrades in categories you already win are
          wasted, so the moves below target the swing categories.
        </p>
      </section>

      <CategoryOutlook categories={report.categories} />
      <Trades trades={report.trades} />
      <Pickups pickups={report.pickups} faab={report.faab_remaining} />
      <Builds builds={report.builds} categories={report.league.categories} myTeamId={report.team_id} />
      <Season rows={report.season} myTeamId={report.team_id} playoffTeams={report.league.playoff_teams} />
      <Roster roster={report.roster} keep={keep} onToggleKeep={onToggleKeep} />
      {keepChanged && (
        <div className="sticky-action">
          <button onClick={onRerun} disabled={rerunning}>
            {rerunning ? 'Updating…' : 'Update analysis with these keepers'}
          </button>
        </div>
      )}

      <section className="card muted small">
        <h3>Assumptions</h3>
        <ul>
          {report.assumptions.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>
            {report.assumptions.simulations.toLocaleString()} season simulations. Generated {report.generated_at} in{' '}
            {(report.elapsed_ms / 1000).toFixed(1)}s.
          </li>
        </ul>
      </section>
    </div>
  )
}
