import type { LeagueOverview as Overview, OverviewMatchup } from '../api/client'

interface Props {
  overview: Overview
  onVerify: () => void
}

function teamName(o: Overview, id: number | null | undefined) {
  return o.teams.find((t) => t.id === id)?.name ?? 'Unknown team'
}

function score(m: OverviewMatchup) {
  const ties = m.home.ties ? `–${m.home.ties}` : ''
  return `${m.home.wins}–${m.away.wins}${ties}`
}

/** What any signed-in account sees of a league before verifying a team in it: league-wide only. */
export function LeagueOverview({ overview: o, onVerify }: Props) {
  const mvp = o.mvp
  const pulse = o.pulse
  const close = pulse.close_matchups
  const verified = o.my_team_id != null

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

      <div className="overview-grid">
        <section className="card stack mvp" aria-labelledby="mvp-title">
          <span className="eyebrow" id="mvp-title">
            MVP candidate · week {o.matchup_period}
          </span>
          {mvp ? (
            <>
              <div className="mvp-head">
                <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <span className="mvp-name">{teamName(o, mvp.team_id)}</span>
                  <span className="small muted">vs {teamName(o, mvp.opponent_id)}</span>
                </div>
                <div className="mvp-score">
                  <span className="num">
                    {mvp.wins}–{mvp.losses}
                    {mvp.ties ? `–${mvp.ties}` : ''}
                  </span>
                  <span className="small muted">categories</span>
                </div>
              </div>
              <div className="row mvp-facts">
                <span className="tag">
                  Up {mvp.wins - mvp.losses} {mvp.wins - mvp.losses === 1 ? 'category' : 'categories'}
                </span>
                {/^0-0(-0)?$/.test(mvp.season_record) ? null : <span className="tag">Season {mvp.season_record}</span>}
              </div>
              <span className="small muted">The biggest category lead in the league this week, so far.</span>
            </>
          ) : (
            <span className="muted">No one is ahead yet this week. Check back once games are played.</span>
          )}
        </section>

        <section className="card stack" aria-labelledby="pulse-title">
          <span className="eyebrow" id="pulse-title">
            League pulse
          </span>
          <dl className="pulse">
            <div>
              <dt className="num">{pulse.faab_leader_id != null ? `$${pulse.faab_leader_spent}` : '$0'}</dt>
              <dd className="small muted">
                {pulse.faab_leader_id != null
                  ? `Most FAAB spent: ${teamName(o, pulse.faab_leader_id)}`
                  : 'No FAAB spent yet'}
              </dd>
            </div>
            <div>
              <dt className="num">{pulse.claims_last_7_days}</dt>
              <dd className="small muted">Waiver claims, last 7 days</dd>
            </div>
            <div>
              <dt className="num">{pulse.trades_this_season}</dt>
              <dd className="small muted">Trades this season</dd>
            </div>
            <div>
              <dt className="num">{close}</dt>
              <dd className="small muted">{close === 1 ? 'Matchup' : 'Matchups'} within one category</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card stack" aria-labelledby="mu-title">
        <span className="eyebrow" id="mu-title">
          Week {o.matchup_period} matchups
        </span>
        {o.matchups.length ? (
          <ul className="matchups">
            {o.matchups.map((m) => {
              const lead = m.home.wins === m.away.wins ? 0 : m.home.wins > m.away.wins ? 1 : -1
              const mine = (id: number) => (id === o.my_team_id ? ' me' : '')
              return (
                <li key={`${m.home.team_id}-${m.away.team_id}`} className="matchup">
                  <span className={`matchup-team${lead < 0 ? ' trailing' : ''}${mine(m.home.team_id)}`}>
                    {teamName(o, m.home.team_id)}
                  </span>
                  <span className="num matchup-score">{score(m)}</span>
                  <span className={`matchup-team away${lead > 0 ? ' trailing' : ''}${mine(m.away.team_id)}`}>
                    {teamName(o, m.away.team_id)}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <span className="muted">No matchups this week.</span>
        )}
        {close > 0 && o.matchups.length > 1 && (
          <span className="small muted">
            {close} of {o.matchups.length} are one category apart or level.
          </span>
        )}
      </section>

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
