import type { TeamBuild } from '../api/client'

export function Builds({ builds, categories, myTeamId }: { builds: TeamBuild[]; categories: string[]; myTeamId: number }) {
  const n = builds.length
  const sorted = [...builds].sort((a, b) => b.expected_cats_won - a.expected_cats_won)
  return (
    <section className="card">
      <h2>League builds</h2>
      <p className="muted">
        Each team's weekly rank per category (1 is best). Teams far behind in a category are likely punting it, so
        players who help there are worth less to them and more to you in a trade.
      </p>
      <div className="table-wrap">
        <table className="ranks">
          <thead>
            <tr>
              <th>Team</th>
              {categories.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th title="Expected categories won per week against an average opponent">Cats/wk</th>
              <th>Likely punts</th>
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
                <td className="muted">{b.weak.join(', ') || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
