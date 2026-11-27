import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CalendarDots, Target } from '@phosphor-icons/react'
import type { LeagueRef, LeagueOverview as Overview, MatchupSide, OverviewMatchup, SeasonRow } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { isFresh, seenWeek } from '../lib/filmRoom'
import { flipHint, teamColours } from '../lib/league'
import MatchupProjection from './MatchupProjection'
import { MatchupScout } from './MatchupScout'
import { useManagerStyles } from '../lib/useManagerStyles'
import { BoxScore, type BoxTeam } from './BoxScore'
import { MaybeHandshake } from './MaybeHandshake'
import { FilmRoom, FilmRoomEntry, FilmRoomPicker } from './FilmRoom'
import './LeagueOverview.css'
import { Standings } from './Standings'
import { TeamCrest } from './TeamCrest'
import { VerifyBanner } from './VerifyBanner'
import { todayMatters, useTodayMatchup } from '../lib/todayData'
import { TodayLoading, TodayMatchup, type TodaySide } from './TodayMatchup'
import { MatchupSheet, TodayWeekSwitch, type SheetSide } from './MatchupSheet'
import { BoxGhost, BoxSlot, type FrontRowIntent } from './ScoresFrontRow'
import { reducedMotion, rowEndOf, tabOrigin, tabStyle } from '../lib/frontRow'
import { useGridColumns } from '../lib/useGridColumns'
import { useEscapeLayer } from '../lib/escapeStack'

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

function key(m: OverviewMatchup) {
  return `${m.home.team_id}-${m.away.team_id}`
}

/** A matchup card in the week's grid, by its place in the list. */
const cardOf = (i: number) => document.getElementById(`mu-card-${i}`)
const topbarHeight = () => document.querySelector<HTMLElement>('.topbar')?.offsetHeight ?? 0

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
  const [open, setOpen] = useState<string | null>(null)
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
  const boxTeam = (s: MatchupSide): BoxTeam => {
    const t = team(s.team_id)
    return {
      side: s,
      name: nameOf(s.team_id),
      colour: colours.get(s.team_id),
      mine: s.team_id === o.my_team_id,
      sub: t && !/^0-0(-0)?$/.test(t.record) ? `Season ${t.wins}-${t.losses}-${t.ties}` : undefined,
    }
  }

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

  const pulse = o.pulse
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
  const side = (s: MatchupSide): TodaySide => ({
    id: s.team_id,
    name: nameOf(s.team_id),
    colour: colours.get(s.team_id),
    week: s.categories ?? [],
  })

  // The week's grid, Front Row (as on Scores): the matchup you open comes forward, the rest blur, and
  // its box opens in place right under its row. The cards go by their place in the list.
  const grid = useRef<HTMLUListElement>(null)
  const cols = useGridColumns(grid)
  const [closing, setClosing] = useState(false)
  const [ghost, setGhost] = useState<{ after: number; height: number; n: number } | null>(null)
  const intent = useRef<FrontRowIntent | null>(null)
  const clearGhost = useCallback(() => setGhost(null), [])
  const ids = o.matchups.map((_, i) => i)
  const openAt = o.matchups.findIndex((m) => key(m) === open && hasBox(m))
  const openMatchup = openAt >= 0 ? o.matchups[openAt] : undefined
  const rowEnd = openMatchup ? rowEndOf(ids, openAt, cols) : null
  useEffect(() => {
    if (open != null && !openMatchup) {
      setOpen(null)
      setClosing(false)
    }
  }, [open, openMatchup])

  const close = useCallback(
    (focusCard = true) => {
      if (openAt < 0 || closing) return
      const card = cardOf(openAt)
      if (!card) {
        setOpen(null)
        return
      }
      const r = card.getBoundingClientRect()
      const top = topbarHeight()
      // Closed with the card scrolled away: bring it back just under the top bar.
      intent.current = {
        kind: 'close',
        anchor: () => cardOf(openAt),
        y0: r.top,
        y1: r.bottom < top + 24 ? top + 16 : undefined,
      }
      setClosing(true)
      if (focusCard) card.focus({ preventScroll: true })
    },
    [openAt, closing],
  )
  const onClosed = useCallback(() => {
    setOpen(null)
    setClosing(false)
  }, [])

  // Esc closes from anywhere on the page, once whatever opened on top of it (a player card) is closed.
  useEscapeLayer(openAt >= 0, () => close(true))

  /** Opens a matchup, or moves the box to it (sliding along its row, or folding here and opening there). */
  const go = (i: number, keyboard: boolean) => {
    if (closing) return
    if (openAt === i) return close(true)
    const card = cardOf(i)
    if (!card) return
    const anchor = () => cardOf(i)
    const y0 = card.getBoundingClientRect().top
    const focus = keyboard ? ('title' as const) : null
    const k = key(o.matchups[i])
    if (openAt < 0) {
      intent.current = { kind: 'open', anchor, y0, focus }
      setOpen(k)
      return
    }
    const h0 = document.querySelector<HTMLElement>('#box .sc-panel')?.offsetHeight ?? 0
    if (rowEndOf(ids, i, cols) === rowEndOf(ids, openAt, cols)) {
      intent.current = { kind: 'hop', anchor, y0, h0, focus }
    } else {
      intent.current = { kind: 'open', anchor, y0, focus }
      const after = rowEndOf(ids, openAt, cols)
      if (!reducedMotion() && after != null) setGhost({ after, height: h0, n: Date.now() })
    }
    setOpen(k)
  }

  // The open matchup, today: its two lineups live (yours shares the card's fetch).
  const boxSides = openMatchup ? sides(openMatchup) : null
  const boxToday = useTodayMatchup(
    leagueRef?.leagueId,
    leagueRef?.season,
    creds ?? null,
    o.my_team_id,
    boxSides ? [boxSides[0].team_id, boxSides[1].team_id] : null,
    o.week_start,
    o.week_end,
  )
  const [boxPick, setBoxPick] = useState<{ key: string; view: 'today' | 'week' } | null>(null)
  const boxCanToday =
    !!boxSides && !!leagueRef && boxToday.inWeek !== false && !boxToday.failed && (!!boxToday.data || boxToday.loading)
  const boxView: 'today' | 'week' = !boxCanToday
    ? 'week'
    : boxPick && boxPick.key === open
      ? boxPick.view
      : boxToday.data && !todayMatters(boxToday.data)
        ? 'week'
        : 'today'

  const boxPanel = openMatchup && boxSides && (
    <div className="mu-box">
      <div className="featured-head">
        <h3 id="box-title" className="eyebrow mu-box-title" tabIndex={-1}>
          {nameOf(boxSides[0].team_id)} vs {nameOf(boxSides[1].team_id)}
        </h3>
        {boxCanToday && <TodayWeekSwitch view={boxView} onPick={(v) => setBoxPick({ key: open!, view: v })} />}
        <button type="button" className="icon-button" aria-label="Close matchup" onClick={() => close(true)}>
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
      {boxView === 'today' ? (
        boxToday.data ? (
          <TodayMatchup
            data={boxToday.data}
            me={side(boxSides[0])}
            them={side(boxSides[1])}
            myId={o.my_team_id ?? null}
          />
        ) : (
          <TodayLoading />
        )
      ) : (
        <BoxScore
          home={boxTeam(boxSides[0])}
          away={boxTeam(boxSides[1])}
          caption={`${nameOf(openMatchup.home.team_id)} against ${nameOf(openMatchup.away.team_id)}`}
        />
      )}
    </div>
  )

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
                    {(hint || check) && (
                      <div className="lms-flip">
                        {hint && (
                          <p className="lms-hint">
                            <Target size={18} aria-hidden="true" />
                            {hint}
                          </p>
                        )}
                        {check && (
                          <button type="button" className="lms-check" onClick={() => onCheckTrade(b.team_id)}>
                            <MaybeHandshake size={20} /> Check a Trade With Them
                          </button>
                        )}
                      </div>
                    )}
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
        </div>
        {o.matchups.length ? (
          <ul
            ref={grid}
            className={`mu-grid lo-fr${openMatchup && !closing ? ' has-open' : ''}`}
            // One column (phones): the open card stays its size, flush with its box.
            style={{ '--sc-tab-scale': cols > 1 ? 1.08 : 1 } as CSSProperties}
          >
            {o.matchups.map((m, i) => {
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
                    {isMine && (
                      <svg className="mu-mine-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21a8 8 0 0 1 16 0z" />
                      </svg>
                    )}
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
              const tab = i === openAt && !closing
              return (
                <Fragment key={key(m)}>
                  <li className="mu-cell">
                    {expandable ? (
                      <button
                        type="button"
                        id={`mu-card-${i}`}
                        className={`mu-card${tab ? ' is-tab' : ''}`}
                        style={
                          {
                            ...tabStyle(tabOrigin(ids, i, cols)),
                            '--ta': colours.get(a.team_id) ?? 'var(--accent)',
                            '--tb': colours.get(b.team_id) ?? 'var(--accent)',
                          } as CSSProperties
                        }
                        aria-expanded={tab}
                        aria-controls={tab ? 'box' : undefined}
                        onClick={(e) => go(i, e.detail === 0)}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="mu-card">{body}</div>
                    )}
                  </li>
                  {i === rowEnd && boxSides && (
                    <li className="mu-box-slot">
                      <BoxSlot
                        key={`slot-${i}`}
                        gameId={openAt}
                        card={() => cardOf(openAt)}
                        colours={[
                          colours.get(boxSides[0].team_id) ?? 'var(--accent)',
                          colours.get(boxSides[1].team_id) ?? 'var(--accent)',
                        ]}
                        strip={null}
                        closing={closing}
                        onClosed={onClosed}
                        intent={intent}
                      >
                        {boxPanel}
                      </BoxSlot>
                    </li>
                  )}
                  {i === ghost?.after && (
                    <li className="mu-box-slot" aria-hidden="true">
                      <BoxGhost key={`ghost-${ghost.n}`} height={ghost.height} onDone={clearGhost} />
                    </li>
                  )}
                </Fragment>
              )
            })}
          </ul>
        ) : (
          <span className="muted">No matchups this week.</span>
        )}
      </section>

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

      {!verified && (
        <section className="card stack" aria-labelledby="locked-title">
          <span className="eyebrow" id="locked-title">
            Once you pick your team
          </span>
          <ul className="locked">
            {[
              'Your best trades and FA targets',
              'Your playoff odds and category outlook',
              'League Chat and saved trade rules, after you verify it on ESPN',
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
              Pick my team
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
