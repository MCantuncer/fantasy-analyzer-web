import { useState, type CSSProperties } from 'react'
import type { OverviewTeam, SeasonRow } from '../api/client'
import { pct } from '../lib/format'
import { TeamCrest } from './TeamCrest'

interface Props {
  teams: OverviewTeam[]
  colours: Map<number, string>
  myTeamId: number | null
  playoffTeams: number | null
  /** The season simulation's rows; null hides the Projected tab, undefined shows it as pending. */
  projected?: SeasonRow[] | null
}

type View = 'current' | 'projected'

function winPct(t: OverviewTeam) {
  const games = t.wins + t.losses + t.ties
  if (!games) return '–'
  return ((t.wins + t.ties / 2) / games).toFixed(3).replace(/^0(?=\.)/, '')
}

/** Current standings in ESPN's order, with the season simulation one tab away. */
export function Standings({ teams, colours, myTeamId, playoffTeams, projected }: Props) {
  const [view, setView] = useState<View>('current')
  const cut = playoffTeams ?? 0
  const current = [...teams].sort(
    (a, b) => (a.seed ?? 99) - (b.seed ?? 99) || b.wins - a.wins || a.losses - b.losses || a.id - b.id,
  )
  const nameOf = new Map(teams.map((t) => [t.id, t.name]))
  const rowClass = (id: number, i: number) =>
    [id === myTeamId ? 'mine' : '', cut && i === cut - 1 ? 'cutline playoff' : ''].join(' ').trim() || undefined

  return (
    <section className="card flush standings" aria-labelledby="standings-title">
      <div className="card-head">
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="standings-title">Standings</h2>
          <span className="small muted">
            {view === 'current'
              ? `Category record so far.${cut ? ` The top ${cut} make the playoffs.` : ''}`
              : `Thousands of simulated seasons.${cut ? ` The top ${cut} make the playoffs.` : ''}`}
          </span>
        </div>
        {projected !== null && (
          <div className="segmented standings-switch" role="group" aria-label="Standings view">
            <button type="button" aria-pressed={view === 'current'} onClick={() => setView('current')}>
              Current
            </button>
            <button type="button" aria-pressed={view === 'projected'} onClick={() => setView('projected')}>
              Projected
            </button>
          </div>
        )}
      </div>

      {view === 'current' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className="left">
                  Team
                </th>
                <th scope="col">W-L-T</th>
                <th scope="col" className="hide-phone">
                  Win %
                </th>
                <th scope="col">Back</th>
              </tr>
            </thead>
            <tbody>
              {current.map((t, i) => (
                <tr key={t.id} className={rowClass(t.id, i)}>
                  <td className="num rank">{i + 1}</td>
                  <th scope="row" className="left">
                    <span className="box-team">
                      <TeamCrest name={t.name} colour={colours.get(t.id)} size={28} />
                      {t.name}
                    </span>
                  </th>
                  <td className="num strong">
                    {t.wins}-{t.losses}-{t.ties}
                  </td>
                  <td className="num hide-phone">{winPct(t)}</td>
                  <td className="num">{t.games_back ? t.games_back.toFixed(1).replace(/\.0$/, '') : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'projected' &&
        (projected ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" className="left">
                    Team
                  </th>
                  <th scope="col">Projected</th>
                  <th scope="col" className="left odds-col">
                    Playoff odds
                  </th>
                  <th scope="col">1st seed</th>
                </tr>
              </thead>
              <tbody>
                {projected.map((r, i) => (
                  <tr
                    key={r.team_id}
                    className={rowClass(r.team_id, i)}
                    style={{ '--team': colours.get(r.team_id) } as CSSProperties}
                  >
                    <td className="num rank">{i + 1}</td>
                    <th scope="row" className="left">
                      <span className="box-team">
                        <TeamCrest
                          name={nameOf.get(r.team_id) ?? r.team_name}
                          colour={colours.get(r.team_id)}
                          size={28}
                        />
                        {r.team_name}
                      </span>
                    </th>
                    <td className="num strong">
                      {r.projected_wins.toFixed(0)}–{r.projected_losses.toFixed(0)}
                      {r.projected_ties >= 0.5 ? `–${r.projected_ties.toFixed(0)}` : ''}
                    </td>
                    <td className="left">
                      <span className="odds">
                        <span className="odds-bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${Math.round(r.playoff_pct * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="num strong">{pct(r.playoff_pct)}</span>
                      </span>
                    </td>
                    <td className="num">{pct(r.first_seed_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted standings-pending">Projected standings appear here once your analysis finishes.</p>
        ))}
    </section>
  )
}
