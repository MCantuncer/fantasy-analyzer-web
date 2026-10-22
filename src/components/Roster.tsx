import type { PlayerRef } from '../api/client'

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
        <span className="small muted">Keep a player to leave him out of trades and drops.</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="keep-cell">Keep</th>
              <th className="left">Player</th>
              <th className="left">Pos</th>
              <th title="What owners think he's worth, in auction dollars">Owner value</th>
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
                </th>
                <td className="left muted">{p.positions.join('/')}</td>
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
