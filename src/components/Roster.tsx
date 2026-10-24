import type { PlayerRef } from '../api/client'
import { PlayerBadges } from './PlayerBadges'

const TIERS: Record<PlayerRef['tier'], { label: string; title: string }> = {
  core: { label: 'Core', title: 'You keep him: never offered or dropped' },
  tradeable: { label: 'Tradeable', title: "Has a market. If he doesn't fit, trade him rather than drop him" },
  droppable: { label: 'Droppable', title: 'Lightly owned and replaceable from free agency' },
  injured: { label: 'Injured', title: "Out right now. Hold him unless it's long term" },
}

interface Props {
  roster: PlayerRef[]
  keep: number[]
  onToggleKeep: (id: number) => void
}

export function Roster({ roster, keep, onToggleKeep }: Props) {
  return (
    <section className="card flush" aria-labelledby="roster-title">
      <div className="card-head">
        <h2 id="roster-title">Your roster</h2>
        <span className="small muted">
          Keep a player to leave him out of trades and drops. Only droppable players are ever suggested as drops.
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="keep-cell">Keep</th>
              <th className="left">Player</th>
              <th className="left">Pos</th>
              <th className="left">Status</th>
              <th title="Trade value in auction dollars: draft-day rankings and prices fading into % owned, rest-of-season value in your categories and this season's production">Trade value</th>
              <th title="Category value: z-scores summed over the league's categories">Cat value</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.id}>
                <td className="keep-cell">
                  <label>
                    <input type="checkbox" checked={keep.includes(p.id)} onChange={() => onToggleKeep(p.id)} />
                    <span className="sr-only">Keep {p.name}</span>
                  </label>
                </td>
                <th scope="row">
                  {p.name}{' '}
                  {p.injury_status !== 'ACTIVE' && <span className="badge badge-bad">{p.injury_status.replace(/_/g, ' ')}</span>}
                  <PlayerBadges badges={p.badges} />
                </th>
                <td className="left muted">{p.positions.join('/')}</td>
                <td className="left">
                  <span className={`badge tier-${p.tier}`} title={TIERS[p.tier].title}>
                    {TIERS[p.tier].label}
                  </span>
                </td>
                <td>${Math.round(p.perceived_value)}</td>
                <td className={p.value > 0 ? 'good' : p.value < 0 ? 'bad' : ''}>
                  {p.value > 0 ? '+' : p.value < 0 ? '−' : ''}
                  {Math.abs(p.value).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
