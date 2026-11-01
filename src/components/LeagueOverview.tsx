import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { LeagueOverview as Overview, MatchupSide, OverviewMatchup, SeasonRow } from '../api/client'
import { flipHint, teamColours } from '../lib/league'
import { BoxScore, type BoxTeam } from './BoxScore'
import { Standings } from './Standings'
import { TeamCrest } from './TeamCrest'

interface Props {
  overview: Overview
  onVerify: () => void
  /** Season simulation rows for the Projected standings tab; undefined while the analysis runs. */
  projected?: SeasonRow[] | null
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function key(m: OverviewMatchup) {
  return `${m.home.team_id}-${m.away.team_id}`
}

const ICONS: Record<string, ReactNode> = {
  money: <path d="M12 3v18M16.5 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7" />,
  claims: <path d="M5 12h14M12 5v14" />,
  trades: <path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5" />,
  close: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
}

function Tile({ icon, value, label, tone }: { icon: string; value: ReactNode; label: string; tone: number }) {
  return (
    <div className="pulse-tile" style={{ '--team': `var(--team-${tone})` } as CSSProperties}>
      <span className="pulse-icon" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONS[icon]}
        </svg>
      </span>
      <span className="stack" style={{ gap: 0, minWidth: 0 }}>
        <span className="num pulse-value">{value}</span>
        <span className="small muted">{label}</span>
      </span>
    </div>
  )
}

/** The League page: your matchup as a box score, the league's pulse, every matchup and the standings. */
export function LeagueOverview({ overview: o, onVerify, projected }: Props) {
  const verified = o.my_team_id != null
  const colours = useMemo(
    () =>
      teamColours(
        o.teams.map((t) => t.id),
        o.my_team_id,
      ),
    [o.teams, o.my_team_id],
  )
  const team = (id: number) => o.teams.find((t) => t.id === id)
  const nameOf = (id: number | null | undefined) => (id != null ? team(id)?.name : undefined) ?? 'Unknown team'
  const [open, setOpen] = useState<string | null>(null)

  const mine = o.matchups.find((m) => m.home.team_id === o.my_team_id || m.away.team_id === o.my_team_id)
  const mvpKey = o.mvp ? o.matchups.find((m) => [m.home.team_id, m.away.team_id].includes(o.mvp!.team_id)) : undefined
  const featured = mine ?? mvpKey
  const hasBox = (m: OverviewMatchup | undefined) => !!m && (m.home.categories?.length ?? 0) > 0

  // In your matchup you always sit on the first row.
  const sides = (m: OverviewMatchup): [MatchupSide, MatchupSide] =>
    m.away.team_id === o.my_team_id || (m === mvpKey && !mine && m.away.team_id === o.mvp?.team_id)
      ? [m.away, m.home]
      : [m.home, m.away]
  const boxTeam = (s: MatchupSide): BoxTeam => {
    const t = team(s.team_id)
    return {
      side: s,
      name: nameOf(s.team_id),
      colour: colours.get(s.team_id),
      label: s.team_id === o.my_team_id ? `You · ${nameOf(s.team_id)}` : undefined,
      sub: t && !/^0-0(-0)?$/.test(t.record) ? `Season ${t.wins}-${t.losses}-${t.ties}` : undefined,
    }
  }

  const pulse = o.pulse
  const week = [shortDate(o.week_start), shortDate(o.week_end)].filter(Boolean).join(' – ')
  const openMatchup = o.matchups.find((m) => key(m) === open)

  return (
    <div className="overview stack">
      {!verified && (
        <div className="verify-banner">
          <span>Manage a team here? Verify it to see your moves, trades and the league chat.</span>
          <button type="button" onClick={onVerify}>
            Verify my team
          </button>
        </div>
      )}

      <div className="league-head">
        <span className="eyebrow">
          Week {o.matchup_period}
          {week ? ` · ${week}` : ''}
        </span>
      </div>

      {featured && hasBox(featured) && (
        <section className={`card featured${mine ? ' mine' : ''}`} aria-labelledby="featured-title">
          <div className="featured-head">
            <h2 id="featured-title" className="eyebrow">
              {mine ? 'Your matchup' : 'Matchup of the week'}
            </h2>
            {mine &&
              (() => {
                const [me, them] = sides(mine)
                const hint = flipHint(me, them)
                return hint ? <span className="hint">{hint}</span> : null
              })()}
          </div>
          {(() => {
            const [a, b] = sides(featured)
            return (
              <BoxScore
                home={boxTeam(a)}
                away={boxTeam(b)}
                caption={`${nameOf(a.team_id)} against ${nameOf(b.team_id)}, week ${o.matchup_period}`}
              />
            )
          })()}
          <p className="small muted box-legend">
            Shaded cell: leading that category. Outlined: close enough to flip. Grey outline on both rows: tied.
          </p>
        </section>
      )}

      <div className="pulse-tiles">
        <Tile
          icon="money"
          tone={1}
          value={pulse.faab_leader_id != null ? `$${pulse.faab_leader_spent}` : '$0'}
          label={
            pulse.faab_leader_id != null ? `Top FAAB spend · ${nameOf(pulse.faab_leader_id)}` : 'No FAAB spent yet'
          }
        />
        <Tile icon="claims" tone={4} value={pulse.claims_last_7_days} label="Waiver claims, last 7 days" />
        <Tile icon="trades" tone={6} value={pulse.trades_this_season} label="Trades this season" />
        <Tile
          icon="close"
          tone={0}
          value={pulse.close_matchups}
          label={`${pulse.close_matchups === 1 ? 'Matchup' : 'Matchups'} within one category`}
        />
      </div>

      <section className="stack" style={{ gap: 12 }} aria-labelledby="mu-title">
        <div className="section-head">
          <h2 id="mu-title">Week {o.matchup_period} matchups</h2>
          {o.matchups.some(hasBox) && <span className="small muted">Open a matchup for its box score</span>}
        </div>
        {o.matchups.length ? (
          <ul className="mu-grid">
            {o.matchups.map((m) => {
              const [a, b] = sides(m)
              const isMine = m === mine
              const tag = isMine
                ? 'Your matchup'
                : m === mvpKey
                  ? 'Matchup of the week'
                  : Math.abs(a.wins - b.wins) <= 1
                    ? 'Coin flip'
                    : null
              const expandable = hasBox(m)
              const body = (
                <>
                  <span className={`mu-tag${isMine ? ' mine' : tag === 'Coin flip' ? ' close' : tag ? ' star' : ''}`}>
                    {tag ?? '\u00a0'}
                  </span>
                  {[a, b].map((s, i) => {
                    const other = i === 0 ? b : a
                    const ahead = s.wins > other.wins
                    return (
                      <span key={s.team_id} className={`mu-row${ahead ? ' ahead' : ''}`}>
                        <TeamCrest name={nameOf(s.team_id)} colour={colours.get(s.team_id)} size={28} />
                        <span className="mu-name">{nameOf(s.team_id)}</span>
                        <span className="num mu-score">{s.wins}</span>
                      </span>
                    )
                  })}
                  {(a.ties > 0 || b.ties > 0) && <span className="small muted">{a.ties} tied</span>}
                </>
              )
              return (
                <li key={key(m)}>
                  {expandable ? (
                    <button
                      type="button"
                      className={`mu-card${isMine ? ' mine' : ''}`}
                      aria-expanded={open === key(m)}
                      aria-controls="mu-box"
                      onClick={() => setOpen(open === key(m) ? null : key(m))}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={`mu-card${isMine ? ' mine' : ''}`}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <span className="muted">No matchups this week.</span>
        )}
        {openMatchup && (
          <div className="card mu-box" id="mu-box">
            <div className="featured-head">
              <span className="eyebrow">
                {nameOf(sides(openMatchup)[0].team_id)} vs {nameOf(sides(openMatchup)[1].team_id)}
              </span>
              <button type="button" className="icon-button" aria-label="Close box score" onClick={() => setOpen(null)}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <BoxScore
              home={boxTeam(sides(openMatchup)[0])}
              away={boxTeam(sides(openMatchup)[1])}
              caption={`${nameOf(openMatchup.home.team_id)} against ${nameOf(openMatchup.away.team_id)}`}
            />
          </div>
        )}
      </section>

      <Standings
        teams={o.teams}
        colours={colours}
        myTeamId={o.my_team_id ?? null}
        playoffTeams={o.playoff_teams ?? null}
        projected={verified ? projected : null}
      />

      {!verified && (
        <section className="card stack" aria-labelledby="locked-title">
          <span className="eyebrow" id="locked-title">
            For verified managers
          </span>
          <ul className="locked">
            {[
              'Your best trades and pickups',
              'Your playoff odds and category outlook',
              'League chat, reactions and votes',
            ].map((t) => (
              <li key={t}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="3" y="7" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
                  <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="secondary" onClick={onVerify}>
              Verify my team
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
