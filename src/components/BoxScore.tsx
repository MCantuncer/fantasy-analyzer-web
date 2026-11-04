import type { CSSProperties } from 'react'
import type { MatchupSide } from '../api/client'
import { boxOrder, formatStat, isClose, record } from '../lib/league'
import { TeamCrest } from './TeamCrest'
import './BoxScore.css'

export interface BoxTeam {
  side: MatchupSide
  name: string
  colour: string | undefined
  sub?: string // e.g. "Season 4-5-0"
  /** Your team: its leads get a green edge and the other side's a red one. */
  mine?: boolean
}

const MINE_ICON = (
  <svg className="box-mine-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <title>Your team</title>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0z" />
  </svg>
)

/** The team's name; yours is marked by a person icon (before the name, or beside the crest on phones). */
function TeamName({ team, icon = true }: { team: BoxTeam; icon?: boolean }) {
  return (
    <span className={team.mine ? 'box-team-name mine' : 'box-team-name'}>
      {team.mine && icon && MINE_ICON}
      {team.mine && <span className="sr-only">Your team: </span>}
      {team.name}
    </span>
  )
}

function Games({ team }: { team: BoxTeam }) {
  const g = team.side.games
  if (!g) return <span className="muted">–</span>
  const played = g.total ? ((g.total - g.left) / g.total) * 100 : 0
  return (
    <div className="box-games">
      <span className={`games-today${g.today ? '' : ' none'}`}>
        <span className="num">{g.today}</span>
        <span>today</span>
      </span>
      <span className="games-week">
        <span className="small">
          <b className="num">{g.left}</b> left of {g.total}
        </span>
        <span className="games-bar" aria-hidden="true">
          <span style={{ width: `${played}%` }} />
        </span>
      </span>
    </div>
  )
}

/**
 * An ESPN-style box score: both teams on two rows, every category with both numbers, close categories
 * named in amber, and each side's W-L-T at the end. Cells are neutral; the leader's is heavier with an
 * edge: green where you lead and red where they lead in your matchup, the team colour in anyone else's.
 */
export function BoxScore({ home, away, caption }: { home: BoxTeam; away: BoxTeam; caption: string }) {
  const cats = boxOrder(home.side.categories ?? [])
  const theirs = new Map((away.side.categories ?? []).map((c) => [c.stat, c]))
  const close = new Set(
    cats.filter((c) => theirs.has(c.stat) && isClose(c.stat, c.value, theirs.get(c.stat)!.value)).map((c) => c.stat),
  )
  const teams = [home, away]

  const byTeam = teams.map((t) => new Map((t.side.categories ?? []).map((c) => [c.stat, c])))
  const hasMe = teams.some((t) => t.mine)
  const side = (t: BoxTeam) => (t.mine ? 'mine' : hasMe ? 'theirs' : '')
  const cellClass = (r: string | undefined, stat: string, t: BoxTeam) =>
    ['box-cell', r === 'W' ? `lead ${side(t)}` : r === 'T' ? 'tie' : '', close.has(stat) ? 'close' : '']
      .filter(Boolean)
      .join(' ')

  return (
    <>
      {/* Phones: categories run down the page, one row each, your number on the left. */}
      <div className="box-compact" role="group" aria-label={caption}>
        <div className="box-compact-head">
          {teams.map((t) => (
            <div key={t.side.team_id} className="box-compact-team" style={{ '--team': t.colour } as CSSProperties}>
              <span className="box-crest-wrap">
                <TeamCrest name={t.name} colour={t.colour} size={36} />
                {t.mine && MINE_ICON}
              </span>
              <span className="box-name">
                <TeamName team={t} icon={false} />
                <span className="num box-record">{record(t.side)}</span>
              </span>
              <Games team={t} />
            </div>
          ))}
        </div>
        <ul className="box-compact-rows">
          {cats.map((c) => (
            <li key={c.stat}>
              {teams.map((t, i) => {
                const cell = byTeam[i].get(c.stat)
                return (
                  <span
                    key={t.side.team_id}
                    className={`${cellClass(cell?.result, c.stat, t)} num`}
                    style={
                      {
                        '--team': t.colour,
                        order: i === 0 ? 0 : 2,
                      } as CSSProperties
                    }
                  >
                    {cell ? formatStat(c.stat, cell.value) : '–'}
                  </span>
                )
              })}
              <span className={`box-compact-stat${close.has(c.stat) ? ' close' : ''}`}>{c.stat}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="table-wrap box-wide">
        <table className="matchup-box">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="left">
                Team
              </th>
              <th scope="col" className="left">
                Games
              </th>
              {cats.map((c) => (
                <th key={c.stat} scope="col" className={close.has(c.stat) ? 'close' : undefined}>
                  {c.stat}
                </th>
              ))}
              <th scope="col">W-L-T</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => {
              const mine = i === 0 ? home.side : away.side
              const byStat = new Map((mine.categories ?? []).map((c) => [c.stat, c]))
              return (
                <tr key={t.side.team_id} style={{ '--team': t.colour } as CSSProperties}>
                  <th scope="row" className="left">
                    <span className="crest-name">
                      <TeamCrest name={t.name} colour={t.colour} size={32} />
                      <span className="box-name">
                        <TeamName team={t} />
                        {t.sub && <span className="small muted">{t.sub}</span>}
                      </span>
                    </span>
                  </th>
                  <td className="left">
                    <Games team={t} />
                  </td>
                  {cats.map((c) => {
                    const cell = byStat.get(c.stat)
                    const cls = cellClass(cell?.result, c.stat, t)
                    const what = cell?.result === 'W' ? ', leading' : cell?.result === 'T' ? ', tied' : ''
                    return (
                      <td key={c.stat}>
                        <span
                          className={`${cls} num`}
                          aria-label={cell ? `${formatStat(c.stat, cell.value)}${what}` : '–'}
                        >
                          {cell ? formatStat(c.stat, cell.value) : '–'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="num box-record">{record(t.side)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
