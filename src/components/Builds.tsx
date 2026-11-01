import type { TeamBuild } from '../api/client'
import { teamColours } from '../lib/league'
import { TeamCrest } from './TeamCrest'

export function Builds({
  builds,
  categories,
  myTeamId,
}: {
  builds: TeamBuild[]
  categories: string[]
  myTeamId: number
}) {
  const n = builds.length
  const colours = teamColours(
    builds.map((b) => b.team_id),
    myTeamId,
  )
  const sorted = [...builds].sort((a, b) => b.expected_cats_won - a.expected_cats_won)
  return (
    <section className="card flush" aria-labelledby="builds-title">
      <div className="card-head">
        <h2 id="builds-title">League builds</h2>
        <span className="small muted">
          Weekly rank per category, 1 is best. Deep red usually means a punt, so players who help there are worth less
          to that team.
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
                <th scope="row">
                  <span className="crest-name">
                    <TeamCrest name={b.team_name} colour={colours.get(b.team_id)} size={26} />
                    {b.team_name}
                  </span>
                </th>
                {categories.map((c) => {
                  const r = b.ranks[c]
                  // Heat by rank: the top and bottom three shade green and red, deepest at 1 and last.
                  const heat = r <= 3 ? `heat good-${r}` : r > n - 3 ? `heat bad-${n - r + 1}` : 'heat'
                  return (
                    <td key={c} className="heat-cell">
                      <span className={`${heat} num`}>{r}</span>
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
