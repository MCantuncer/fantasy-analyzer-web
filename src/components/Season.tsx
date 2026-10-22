import type { SeasonRow } from '../api/client'
import { pct } from '../lib/format'

export function Season({ rows, myTeamId, playoffTeams }: { rows: SeasonRow[]; myTeamId: number; playoffTeams: number }) {
  const started = rows.some((r) => r.current_record !== '0-0-0')
  return (
    <section className="card flush" aria-labelledby="season-title">
      <div className="card-head">
        <h2 id="season-title">Projected standings</h2>
        <span className="small muted">Thousands of simulated seasons. The top {playoffTeams} make the playoffs.</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Team</th>
              {started && <th>Now</th>}
              <th>Projected</th>
              <th>Playoffs</th>
              <th>1st seed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.team_id}
                className={[r.team_id === myTeamId ? 'mine' : '', i === playoffTeams - 1 ? 'cutline' : '']
                  .join(' ')
                  .trim()}
              >
                <td>{i + 1}</td>
                <th scope="row">{r.team_name}</th>
                {started && <td>{r.current_record}</td>}
                <td>
                  {r.projected_wins.toFixed(0)}–{r.projected_losses.toFixed(0)}
                  {r.projected_ties >= 0.5 ? `–${r.projected_ties.toFixed(0)}` : ''}
                </td>
                <td>{pct(r.playoff_pct)}</td>
                <td>{pct(r.first_seed_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
