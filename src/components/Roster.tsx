import type { PlayerRef } from '../api/client'

interface Props {
  roster: PlayerRef[]
  keep: number[]
  onToggleKeep: (id: number) => void
}

export function Roster({ roster, keep, onToggleKeep }: Props) {
  return (
    <section className="card">
      <h2>Your roster</h2>
      <p className="muted">Mark players you won't move. They are left out of trades and drops.</p>
      <ul className="roster">
        {roster.map((p) => (
          <li key={p.id}>
            <label className="row">
              <input type="checkbox" checked={keep.includes(p.id)} onChange={() => onToggleKeep(p.id)} />
              <span className="grow">
                {p.name}
                {p.injury_status !== 'ACTIVE' && <span className="badge badge-lost">{p.injury_status.replace('_', ' ')}</span>}
              </span>
              <span className="muted">{p.positions.join('/')}</span>
              <span className="muted num" title="Generic value: z-score summed over the league's categories">
                {p.value.toFixed(1)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
