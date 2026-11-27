import { useMemo, useState } from 'react'
import { CalendarDots, Television } from '@phosphor-icons/react'
import type { LeagueRef, LeagueOverview as Overview, MatchupSide, OverviewMatchup, SeasonRow } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { isFresh, seenWeek } from '../lib/filmRoom'
import { flipHint, teamColours } from '../lib/league'
import MatchupProjection from './MatchupProjection'
import { MatchupScout } from './MatchupScout'
import { useManagerStyles } from '../lib/useManagerStyles'
import { FilmRoom, FilmRoomEntry, FilmRoomPicker } from './FilmRoom'
import './LeagueOverview.css'
import { Standings } from './Standings'
import { VerifyBanner } from './VerifyBanner'
import { todayMatters, useTodayMatchup } from '../lib/todayData'
import { FlipLine, MatchupSheet, type SheetSide } from './MatchupSheet'
import { MatchupRows } from './MatchupRows'
import { LeagueWire } from './LeagueWire'
import { SeatExample } from './SeatExample'

interface Props {
  overview: Overview
  onVerify: () => void
  /** Season simulation rows for the Projected standings tab; undefined while the analysis runs. */
  projected?: SeasonRow[] | null
  /** For your matchup's Projected final; left out, the card shows today's box score only. */
  leagueRef?: LeagueRef
  creds?: Credentials | null
  /** The Film Room week on show (null = the last finished week); undefined = the overview. Kept by the app, so
   * finishing the analysis (which swaps this page for the report's) never closes it. */
  film?: number | null
  onFilm?: (period: number | null | undefined) => void
  /** Opens Check a Trade with a team across from you (only where your analysis is loaded). */
  onCheckTrade?: (teamId: number) => void
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** The League page: your matchup as a line-score sheet, the week's matchups and the wire, then the standings. */
export function LeagueOverview({
  overview: o,
  onVerify,
  projected,
  leagueRef,
  creds,
  film,
  onFilm,
  onCheckTrade,
}: Props) {
  const verified = o.my_team_id != null
  const styles = useManagerStyles(leagueRef, creds ?? null, verified)
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
  const openFilm = (period: number | null) => {
    onFilm?.(period)
    window.scrollTo?.({ top: 0 })
  }

  const mine = o.matchups.find((m) => m.home.team_id === o.my_team_id || m.away.team_id === o.my_team_id)
  const mvpKey = o.mvp ? o.matchups.find((m) => [m.home.team_id, m.away.team_id].includes(o.mvp!.team_id)) : undefined
  const featured = mine ?? mvpKey
  const hasBox = (m: OverviewMatchup | undefined) => !!m && (m.home.categories?.length ?? 0) > 0

  // In your matchup you always sit on the first row.
  const sides = (m: OverviewMatchup): [MatchupSide, MatchupSide] =>
    m.away.team_id === o.my_team_id || (m === mvpKey && !mine && m.away.team_id === o.mvp?.team_id)
      ? [m.away, m.home]
      : [m.home, m.away]
  // Your matchup, today: both lineups live, next to the week's box score.
  const rival = mine ? sides(mine)[1] : undefined
  const today = useTodayMatchup(
    leagueRef?.leagueId,
    leagueRef?.season,
    creds ?? null,
    o.my_team_id,
    mine && rival ? [o.my_team_id!, rival.team_id] : null,
    o.week_start,
    o.week_end,
  )
  // The Today/Week pick lasts the session, per league and day, so a refresh never flips it back.
  const viewKey = leagueRef && today.data ? `court:matchup-view:${leagueRef.leagueId}:${today.data.scores.date}` : null
  const [picked, setPicked] = useState<{ key: string | null; view: 'today' | 'week' } | null>(null)
  const stored = (() => {
    if (!viewKey) return null
    if (picked?.key === viewKey) return picked.view
    try {
      const v = sessionStorage.getItem(viewKey)
      return v === 'today' || v === 'week' ? v : null
    } catch {
      return null
    }
  })()
  const canToday = !!mine && !!leagueRef && today.inWeek !== false && !today.failed && (!!today.data || today.loading)
  // Today while a game is on or still to come for someone in either lineup; the week otherwise.
  const autoView = today.data && !todayMatters(today.data) ? 'week' : 'today'
  const matchupView = canToday ? (stored ?? autoView) : 'week'
  const pickView = (v: 'today' | 'week') => {
    setPicked({ key: viewKey, view: v })
    try {
      if (viewKey) sessionStorage.setItem(viewKey, v)
    } catch {
      // Private mode: the pick lasts until the page reloads.
    }
  }

  const week = [shortDate(o.week_start), shortDate(o.week_end)].filter(Boolean).join(' – ')
  // Phones: "Nov 23 – 29" when the week sits in one month.
  const weekShort =
    o.week_start && o.week_end && o.week_start.slice(0, 7) === o.week_end.slice(0, 7)
      ? `${shortDate(o.week_start)} – ${Number(o.week_end.slice(8, 10))}`
      : week
  const finished = Array.from({ length: Math.max(0, o.matchup_period - 1) }, (_, i) => i + 1)
  // The week before this one ended the day before this one started.
  const lastEnd = o.week_start
    ? new Date(Date.parse(`${o.week_start}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    : null
  const fresh = finished.length > 0 && isFresh(lastEnd, new Date())
  const unseen =
    !!leagueRef && finished.length > 0 && seenWeek(leagueRef.leagueId, leagueRef.season) < finished[finished.length - 1]
  if (film !== undefined && leagueRef && onFilm)
    return (
      <FilmRoom
        leagueRef={leagueRef}
        creds={creds ?? null}
        teams={o.teams}
        colours={colours}
        myTeamId={o.my_team_id ?? null}
        period={film}
        onPeriod={openFilm}
        onBack={() => onFilm(undefined)}
      />
    )

  return (
    <div className="overview stack">
      {!verified && (
        <VerifyBanner
          detail="Pick it to see your best moves, trades and playoff odds."
          action="Pick my team"
          onClick={onVerify}
        />
      )}

      <div className="league-head">
        <span className="lo-week">
          <CalendarDots size={16} aria-hidden="true" />
          <span>
            Week {o.matchup_period}
            {week && (
              <>
                {' · '}
                <span className="lo-wk-long">{week}</span>
                <span className="lo-wk-short">{weekShort}</span>
              </>
            )}
          </span>
        </span>
        {leagueRef && onFilm && <FilmRoomPicker weeks={finished} unseen={unseen} onPick={openFilm} />}
      </div>

      {leagueRef && onFilm && fresh && (
        <FilmRoomEntry
          leagueRef={leagueRef}
          creds={creds ?? null}
          period={o.matchup_period - 1}
          myTeamId={o.my_team_id ?? null}
          unseen={unseen}
          onOpen={() => openFilm(null)}
        />
      )}

      {featured &&
        hasBox(featured) &&
        (() => {
          const [a, b] = sides(featured)
          const sheetSide = (s: MatchupSide): SheetSide => ({
            id: s.team_id,
            name: nameOf(s.team_id),
            colour: colours.get(s.team_id),
            week: s.categories ?? [],
            left: s.games?.left ?? null,
          })
          const hint = mine ? flipHint(a, b) : null
          const check = mine && onCheckTrade
          return (
            <MatchupSheet
              title={mine ? 'Your matchup' : 'Matchup of the week'}
              a={sheetSide(a)}
              b={sheetSide(b)}
              mine={!!mine}
              week={{ wins: a.wins, losses: a.losses, ties: a.ties }}
              view={mine ? matchupView : 'week'}
              canToday={canToday}
              onView={pickView}
              today={mine ? today.data : null}
              myId={o.my_team_id ?? null}
              weekExtras={
                mine && (
                  <>
                    <FlipLine hint={hint} onCheckTrade={check ? () => onCheckTrade(b.team_id) : undefined} />
                    {leagueRef && (
                      <MatchupProjection
                        leagueRef={leagueRef}
                        creds={creds ?? null}
                        teamId={o.my_team_id ?? null}
                        me={{ name: nameOf(a.team_id), colour: colours.get(a.team_id) }}
                        them={{ name: nameOf(b.team_id), colour: colours.get(b.team_id) }}
                      />
                    )}
                  </>
                )
              }
            />
          )
        })()}

      {mine && leagueRef && (
        <MatchupScout
          leagueRef={leagueRef}
          creds={creds ?? null}
          opponentId={sides(mine)[1].team_id}
          colour={colours.get(sides(mine)[1].team_id)}
        />
      )}

      <div className="lo-cols">
        <div className="lo-colmain">
          <section className="lo-mu" aria-labelledby="mu-title">
            <h2 id="mu-title" className="lo-mu-h">
              <Television className="lo-mu-ic" aria-hidden="true" />
              Week {o.matchup_period} matchups
            </h2>
            {o.matchups.length ? (
              <MatchupRows
                matchups={o.matchups}
                sides={sides}
                nameOf={nameOf}
                colours={colours}
                myTeamId={o.my_team_id ?? null}
                mine={mine}
                star={mvpKey}
                week={{ start: o.week_start, end: o.week_end }}
                leagueRef={leagueRef}
                creds={creds ?? null}
              />
            ) : (
              <p className="lo-none">No matchups this week.</p>
            )}
          </section>
          <LeagueWire pulse={o.pulse} nameOf={nameOf} colours={colours} myTeamId={o.my_team_id ?? null} />
        </div>

        <Standings
          teams={o.teams}
          colours={colours}
          myTeamId={o.my_team_id ?? null}
          playoffTeams={o.playoff_teams ?? null}
          projected={verified ? projected : null}
          onCheckTrade={onCheckTrade}
          styles={styles.data}
          opponentId={mine ? sides(mine)[1].team_id : null}
        />
      </div>

      {!verified && <SeatExample />}
    </div>
  )
}
