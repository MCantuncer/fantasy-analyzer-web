import { Handshake, ListNumbers, User } from '@phosphor-icons/react'
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import type { ManagerStyles, OverviewTeam, SeasonRow } from '../api/client'
import { pct } from '../lib/format'
import { StyleRows } from './StyleRows'
import { TeamCrest } from './TeamCrest'
import './Standings.css'

interface Props {
  teams: OverviewTeam[]
  colours: Map<number, string>
  myTeamId: number | null
  playoffTeams: number | null
  /** The season simulation's rows; null hides the Projected tab, undefined shows it as pending. */
  projected?: SeasonRow[] | null
  /** Opens Check a Trade with that team across from you; left out, rows have no trade button. */
  onCheckTrade?: (teamId: number) => void
  /** Every manager's play style; when present, a Styles tab shows each manager's labels. */
  styles?: ManagerStyles | null
  /** This week's opponent, tinted on the Styles tab. */
  opponentId?: number | null
}

type View = 'current' | 'projected' | 'styles'

function winPct(t: OverviewTeam) {
  const games = t.wins + t.losses + t.ties
  if (!games) return '–'
  return ((t.wins + t.ties / 2) / games).toFixed(3).replace(/^0(?=\.)/, '')
}

const back = (t: OverviewTeam) => (t.games_back ? t.games_back.toFixed(1).replace(/\.0$/, '') : '–')

/** Rank, crest and name (two lines at most, never cut short); your crest carries a small person badge on its top-right corner. */
function TeamCell({ rank, name, colour, mine }: { rank: number; name: string; colour?: string; mine: boolean }) {
  return (
    <>
      <span className="st-rk num">{rank}</span>
      <span className="st-tm">
        <span className="st-cr">
          <TeamCrest name={name} colour={colour} size={22} />
          {mine && (
            <span className="st-me" role="img" aria-label="your team">
              <User weight="fill" aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="st-nm">{name}</span>
      </span>
    </>
  )
}

/** "Playoff line · top 6" after the last playoff seat: a labelled seam that fades out. */
function cutAfter(i: number, cut: number, total: number): ReactNode {
  if (!cut || i !== cut - 1 || cut >= total) return null
  return (
    <li className="st-cut" role="separator" aria-label={`Playoff line, top ${cut}`}>
      Playoff line · top {cut}
    </li>
  )
}

/**
 * Standings as bare rows: rank, crest and name, the category record, Win % (from 760px), games
 * back and a muted trade check with that team. Your row takes the house light and a person icon.
 * Projected swaps in the season simulation (playoff odds as a bar, yours gold, and the 1st seed);
 * Styles shows how each manager plays.
 */
export function Standings({
  teams,
  colours,
  myTeamId,
  playoffTeams,
  projected,
  onCheckTrade,
  styles,
  opponentId = null,
}: Props) {
  const [view, setView] = useState<View>('current')
  const cut = playoffTeams ?? 0
  const current = [...teams].sort(
    (a, b) => (a.seed ?? 99) - (b.seed ?? 99) || b.wins - a.wins || a.losses - b.losses || a.id - b.id,
  )
  const nameOf = new Map(teams.map((t) => [t.id, t.name]))
  const hasStyles = !!styles && styles.weeks > 0 && styles.teams.length > 0
  const trade = !!onCheckTrade
  const grid = trade ? 'st-cur' : 'st-cur st-nt'
  const rowClass = (cols: string, id: number) => `st-g ${cols} st-r${id === myTeamId ? ' mine' : ''}`

  return (
    <section className="st" aria-labelledby="standings-title">
      <div className="st-top">
        <h2 className="st-h" id="standings-title">
          <ListNumbers className="st-h-ic" aria-hidden="true" />
          Standings
        </h2>
        {(projected !== null || hasStyles) && (
          <div
            className={`segmented standings-switch st-switch${projected !== null && hasStyles ? ' three' : ''}`}
            role="group"
            aria-label="Standings view"
          >
            <button type="button" aria-pressed={view === 'current'} onClick={() => setView('current')}>
              Current
            </button>
            {projected !== null && (
              <button type="button" aria-pressed={view === 'projected'} onClick={() => setView('projected')}>
                Projected
              </button>
            )}
            {hasStyles && (
              <button type="button" aria-pressed={view === 'styles'} onClick={() => setView('styles')}>
                Styles
              </button>
            )}
          </div>
        )}
      </div>

      {view === 'current' && (
        <ol className="st-list" aria-label="Current standings">
          <li className={`st-g ${grid} st-hd`} aria-hidden="true">
            <span>#</span>
            <span>Team</span>
            <span>W–L–T</span>
            <span className="st-pc">Win %</span>
            <span>Back</span>
            {trade && <span />}
          </li>
          {current.map((t, i) => {
            const mine = t.id === myTeamId
            return (
              <Fragment key={t.id}>
                <li className={rowClass(grid, t.id)}>
                  <TeamCell rank={i + 1} name={t.name} colour={colours.get(t.id)} mine={mine} />
                  <span className="st-n st-rec num">
                    <span className="sr-only">record </span>
                    {t.wins}–{t.losses}–{t.ties}
                  </span>
                  <span className="st-n st-pc num">
                    <span className="sr-only">win rate </span>
                    {winPct(t)}
                  </span>
                  <span className="st-n num">
                    <span className="sr-only">games back </span>
                    {back(t)}
                  </span>
                  {onCheckTrade &&
                    (mine ? (
                      <span />
                    ) : (
                      <button
                        type="button"
                        className="st-tr"
                        aria-label={`Check a trade with ${t.name}`}
                        title="Check a Trade With Them"
                        onClick={() => onCheckTrade(t.id)}
                      >
                        <Handshake size={20} aria-hidden="true" />
                      </button>
                    ))}
                </li>
                {cutAfter(i, cut, current.length)}
              </Fragment>
            )
          })}
        </ol>
      )}

      {view === 'styles' && hasStyles && (
        <StyleRows
          data={styles}
          order={current.map((t) => t.id)}
          colours={colours}
          myTeamId={myTeamId}
          opponentId={opponentId}
        />
      )}

      {view === 'projected' &&
        (projected ? (
          <ol className="st-list" aria-label="Projected standings">
            <li className="st-g st-pj st-hd" aria-hidden="true">
              <span>#</span>
              <span>Team</span>
              <span>Projected</span>
              <span>
                <span className="st-lg">Playoff odds</span>
                <span className="st-sm">Odds</span>
              </span>
              <span>
                <span className="st-lg">1st seed</span>
                <span className="st-sm">1st</span>
              </span>
            </li>
            {projected.map((r, i) => (
              <Fragment key={r.team_id}>
                <li className={rowClass('st-pj', r.team_id)}>
                  <TeamCell
                    rank={i + 1}
                    name={nameOf.get(r.team_id) ?? r.team_name}
                    colour={colours.get(r.team_id)}
                    mine={r.team_id === myTeamId}
                  />
                  <span className="st-n st-rec num">
                    <span className="sr-only">projected record </span>
                    {r.projected_wins.toFixed(0)}–{r.projected_losses.toFixed(0)}
                    {r.projected_ties >= 0.5 ? `–${r.projected_ties.toFixed(0)}` : ''}
                  </span>
                  <span className="st-od">
                    <i aria-hidden="true" style={{ '--p': `${Math.round(r.playoff_pct * 100)}%` } as CSSProperties} />
                    <b className="num">
                      <span className="sr-only">playoff odds </span>
                      {pct(r.playoff_pct)}
                    </b>
                  </span>
                  <span className="st-n num">
                    <span className="sr-only">first seed </span>
                    {pct(r.first_seed_pct)}
                  </span>
                </li>
                {cutAfter(i, cut, projected.length)}
              </Fragment>
            ))}
          </ol>
        ) : (
          <p className="st-pending">Projected standings appear here once your analysis finishes.</p>
        ))}
    </section>
  )
}
