import type { TeamBuild } from '../api/client'

export function Builds({ builds, categories, myTeamId }: { builds: TeamBuild[]; categories: string[]; myTeamId: number }) {
  const n = builds.length
  const sorted = [...builds].sort((a, b) => b.expected_cats_won - a.expected_cats_won)
  return (
    <section className="card flush" aria-labelledby="builds-title">
      <div className="card-head">
        <h2 id="builds-title">League builds</h2>
        <span className="small muted">
          Weekly rank per category, 1 is best. Teams far behind in a category are likely punting it, so players who
          help there are worth less to them.
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              {categories.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th title="Expected categories won per week against an average opponent">Cats/wk</th>
              <th className="left">Likely punts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.team_id} className={b.team_id === myTeamId ? 'mine' : undefined}>
                <th scope="row">{b.team_name}</th>
                {categories.map((c) => {
                  const r = b.ranks[c]
                  const cls = r <= Math.ceil(n * 0.2) ? 'rank-top' : r > n - Math.ceil(n * 0.2) ? 'rank-bottom' : ''
                  return (
                    <td key={c} className={cls}>
                      {r}
                    </td>
                  )
                })}
                <td>{b.expected_cats_won.toFixed(2)}</td>
                <td className="left muted">{b.weak.join(', ') || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
