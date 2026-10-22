import type { SeasonRow } from '../api/client'
import { pct } from '../lib/format'

export function Season({ rows, myTeamId, playoffTeams }: { rows: SeasonRow[]; myTeamId: number; playoffTeams: number }) {
  return (
    <section className="card">
      <h2>Season projection</h2>
      <p className="muted">
        The rest of the schedule simulated thousands of times with current rosters. The top {playoffTeams} make the
        playoffs.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Now</th>
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
                <td>{r.current_record}</td>
                <td>
                  {r.projected_wins.toFixed(0)}-{r.projected_losses.toFixed(0)}
                  {r.projected_ties >= 0.5 ? `-${r.projected_ties.toFixed(0)}` : ''}
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
