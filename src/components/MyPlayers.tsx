import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowSquareOut,
  ArrowElbowDownRight,
  ArrowsClockwise,
  ArrowUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CheckCircle,
  Clock,
  ClockCountdown,
  Info,
  Minus,
  UserSwitch,
  UsersThree,
} from '@phosphor-icons/react'
import { fetchLineup, fetchScores } from '../api/client'
import type { Game, GameLine, LineupDay, LineupSpot, PlayChance, SeasonAverage } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { nbaAbbrev } from '../lib/filmRoom'
import { injuryShort } from '../lib/injury'
import { gradeWords, minutesDelta, nightGrade, signed } from '../lib/nightGrade'
import type { Category, NightGrade } from '../lib/nightGrade'
import {
  benchLeftOut,
  buildRows,
  countdown,
  counts,
  espnTeamUrl,
  gamesLeft,
  basisShort,
  gameTimeCall,
  inWordWindow,
  isBench,
  isIR,
  lastName,
  newsAge,
  nextLabel,
  PLAY_TAG,
  pct,
  playTone,
  rowCall,
  starterTotals,
  swapToMake,
  weekday,
  wordLate,
} from '../lib/myPlayers'
import type { Counts, Fill, GameCall, PlayerRow, RowCall, RowState, Swap, Totals } from '../lib/myPlayers'
import { leader, longDayLabel, tipOff } from '../lib/scores'
import { STAT_COLUMNS } from '../lib/statOrder'
import { PlayerLink } from './PlayerCard'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { ShotSplit } from './ShotSplit'
import { Bone } from './Skeleton'
import './MyPlayers.css'

interface Props {
  leagueId: number
  season: number
  teamId: number
  creds: Credentials | null
}

const MINUTE = 60_000

/**
 * My Players: your lineup on one day, in ESPN's order (PG SG SF PF C G F UTIL…, then the bench,
 * then IR), each player with his game and his line as it happens. The lineup is read from ESPN
 * every minute, so a move made in the ESPN app shows here; the lines come from the Scores feed.
 */
export function MyPlayers({ leagueId, season, teamId, creds }: Props) {
  const now = useNow()
  const [day, setDay] = useState<number | null>(null)
  // The day the page opens on: tonight's games, or last night's while they're still on.
  const [today, setToday] = useState<number | null>(null)
  // The game-time call's tray on phones: null follows the night (open when Can must decide now).
  const [callOpen, setCallOpen] = useState<boolean | null>(null)
  const swid = creds?.swid ?? null
  const scores = useQuery({
    // The Scores page's own query, so the two pages share one fetch.
    queryKey: ['scores', leagueId, season, day, teamId, swid] as const,
    queryFn: () => fetchScores(leagueId, season, day, teamId, creds),
    retry: 1,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.live ? MINUTE : false),
  })
  const data = scores.data && (day === null || scores.data.day === day) ? scores.data : null

  // The server's default is the last day a game started. Once that whole night is over, the
  // question is who plays next, so step forward to the next game day.
  useEffect(() => {
    if (day !== null || !data) return
    const over = data.games.length > 0 && data.games.every((g) => g.status === 'final')
    const i = data.days.findIndex((d) => d.day === data.day)
    const next = data.days[i + 1]
    const start = over && next ? next.day : data.day
    setToday(start)
    if (start !== data.day) setDay(start)
  }, [day, data])

  const shownDay = day ?? data?.day ?? null
  const past = !!data && data.games.length > 0 && data.games.every((g) => g.status === 'final') && shownDay !== today
  const lineup = useQuery({
    queryKey: ['lineup', leagueId, season, teamId, shownDay, swid] as const,
    queryFn: () => fetchLineup(leagueId, season, teamId, shownDay, creds),
    enabled: shownDay !== null,
    retry: 1,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    // A finished day's lineup never changes; today's follows the ESPN app.
    refetchInterval: past ? false : MINUTE,
  })

  if (!data || !lineup.data) {
    const error = scores.error ?? lineup.error
    if (error && !scores.isFetching && !lineup.isFetching)
      return (
        <section className="card mp mp-error" aria-labelledby="mp-title">
          <h2 id="mp-title">My Players</h2>
          <p className="muted">Couldn't load your lineup from ESPN. {error.message}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              scores.refetch()
              lineup.refetch()
            }}
          >
            Try again
          </button>
        </section>
      )
    return <MyPlayersLoading />
  }

  const switching = lineup.data.day !== data.day
  const rows = buildRows(lineup.data.spots, switching ? [] : data.games)
  const open = lineup.data.open_slots
  const c = counts(rows, open.length)
  const swap = past ? null : swapToMake(rows, open)
  const totals = starterTotals(rows)
  const starters = rows.filter((r) => r.spot.starting)
  const bench = rows.filter((r) => isBench(r.spot))
  const ir = rows.filter((r) => isIR(r.spot))
  const leftOut = past ? benchLeftOut(rows) : null
  const when = past ? 'that day' : 'tonight'
  const i = data.days.findIndex((d) => d.day === data.day)
  const prev = data.days[i - 1]
  const next = data.days[i + 1]
  const espn = espnTeamUrl(leagueId, teamId, season)
  const swapIds = swap ? new Set([swap.bench.spot.player_id, swap.idle?.spot.player_id]) : new Set<number | undefined>()
  const call = past || switching ? null : gameTimeCall(rows)
  const ctx: RowCtx = { past, now, day: lineup.data.day, week: lineup.data.week ?? [], call, marks: callMarks(call) }
  const trayOpen = call ? (callOpen ?? (call.verdict === 'now' || inWordWindow(call, now))) : false
  const tray: Tray = { id: 'mp-call', open: trayOpen, toggle: () => setCallOpen(!trayOpen) }

  return (
    <section className={`card mp${switching ? ' mp-switching' : ''}`} aria-labelledby="mp-title" aria-busy={switching}>
      <header className="mp-head">
        <h2 className="mp-title" id="mp-title">
          <UsersThree size={22} aria-hidden="true" />
          My Players
        </h2>
        <nav className="mp-day" aria-label="Lineup day">
          <button
            type="button"
            className="secondary icon-btn"
            disabled={!prev}
            onClick={() => prev && setDay(prev.day)}
            aria-label="Earlier day"
          >
            <CaretLeft size={16} aria-hidden="true" />
          </button>
          <span className="mp-day-label">
            {data.day === today ? <b>Today</b> : null}
            {data.day === today ? ' · ' : ''}
            {longDayLabel(data.date)}
          </span>
          <button
            type="button"
            className="secondary icon-btn"
            disabled={!next}
            onClick={() => next && setDay(next.day)}
            aria-label="Later day"
          >
            <CaretRight size={16} aria-hidden="true" />
          </button>
        </nav>
        <div className="mp-sync">
          <span className="mp-fetched small muted">
            <ArrowsClockwise size={14} aria-hidden="true" className={lineup.isFetching ? 'mp-spin' : undefined} />
            {past ? 'As set in ESPN' : <>Lineup from ESPN · <Ago iso={lineup.data.fetched_at} /></>}
          </span>
          <a className="button secondary mp-espn" href={espn} target="_blank" rel="noopener noreferrer">
            ESPN <ArrowSquareOut size={14} aria-hidden="true" />
            <span className="sr-only"> (your team on ESPN, opens in a new tab)</span>
          </a>
        </div>
      </header>

      <NightLine rows={rows} counts={c} past={past} now={now} />

      {swap && <SwapNote swap={swap} espn={espn} />}

      <div className="mp-table">
        <div className="mp-cols" aria-hidden="true">
          <span className="mp-col-slot">Slot</span>
          <span>Player</span>
          <span>Game</span>
          {STAT_COLUMNS.map((s) => (
            <span key={s} className="mp-col-stat">
              {s === 'TO' ? 'TO↓' : s}
            </span>
          ))}
        </div>

        <h3 className="mp-group">
          Starting <span className="muted">· counts</span>
        </h3>
        <ul className="mp-rows">
          {starters.map((r) => (
            <Fragment key={r.spot.player_id}>
              <Row row={r} ctx={ctx} swap={swapIds.has(r.spot.player_id)} tray={call?.doubt === r ? tray : undefined} />
              {call?.doubt === r && <CallCard call={call} now={now} tray={tray} />}
            </Fragment>
          ))}
          {open.map((slot, k) => (
            <li key={`open-${slot}-${k}`} className="mp-row mp-idle mp-empty">
              <span className="mp-spine">
                <Mark state="idle" />
                <span className="mp-slot">{slot}</span>
              </span>
              <span className="mp-who muted">Empty</span>
              <span className="mp-game muted">Nobody in this slot</span>
              <span className="mp-note">
                <b>Slot empty</b> · counts for nothing {when}
              </span>
            </li>
          ))}
        </ul>
        {totals.played > 0 && <TotalsRow totals={totals} past={past || totals.on === 0} />}

        <h3 className="mp-group">
          Bench <span className="muted">· {past ? "didn't count" : "doesn't count"}</span>
          <span className="mp-group-note muted">
            {c.benchPlaying === 0
              ? past
                ? 'None of them played.'
                : `None of them play ${when}.`
              : swap
                ? ''
                : `${c.benchPlaying} of them ${past ? 'played' : `play ${when}`}.`}
          </span>
        </h3>
        <ul className="mp-rows">
          {bench.map((r) => (
            <Row key={r.spot.player_id} row={r} ctx={ctx} swap={swapIds.has(r.spot.player_id)} />
          ))}
        </ul>
        {leftOut && leftOut.line && (
          <p className="mp-left-out small">
            {lastName(leftOut.spot.name)}'s <b className="num">{leftOut.line.pts}</b> pts sat on your bench while{' '}
            {c.idle === 1 ? 'a starting slot was' : `${c.idle} starting slots were`} idle.
          </p>
        )}

        {ir.length > 0 && (
          <>
            <h3 className="mp-group">IR</h3>
            <ul className="mp-rows">
              {ir.map((r) => (
                <Row key={r.spot.player_id} row={r} ctx={ctx} swap={false} />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

/** "1 min ago", kept current while the page is open. */
function Ago({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(t)
  }, [])
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / MINUTE))
  return <>{mins < 1 ? 'just now' : `${mins} min ago`}</>
}

function SwapNote({ swap, espn }: { swap: Swap; espn: string }) {
  const tip = swap.bench.game ? tipOff(swap.bench.game.start) : ''
  return (
    <div className="mp-swap-note" role="note">
      <p>
        <b>Swap before {tip}:</b> {lastName(swap.bench.spot.name)} plays from your bench,{' '}
        {swap.idle ? (
          <>
            {lastName(swap.idle.spot.name)} has no game in {swap.slot}.
          </>
        ) : (
          <>your {swap.slot} slot is empty.</>
        )}
      </p>
      <a className="button mp-swap-go" href={espn} target="_blank" rel="noopener noreferrer">
        Open team in ESPN <ArrowSquareOut size={16} aria-hidden="true" />
      </a>
    </div>
  )
}

const STATE_WORD: Record<RowState, string> = {
  live: 'Live',
  final: 'Final',
  dnp: "Didn't play",
  later: 'Later',
  idle: 'No game',
}

/** The gutter signal. A live player sitting on his NBA bench keeps a hollow dot: in the game, not lit. */
function Mark({ state, sitting = false }: { state: RowState; sitting?: boolean }) {
  return (
    <span className={`mp-mark ${state}${sitting ? ' sitting' : ''}`} title={sitting ? 'On the bench right now' : undefined}>
      {state === 'live' ? (
        <i className="mp-dot" aria-hidden="true" />
      ) : state === 'final' || state === 'dnp' ? (
        <CheckCircle size={18} weight="fill" aria-hidden="true" />
      ) : state === 'later' ? (
        <Clock size={18} aria-hidden="true" />
      ) : (
        <Minus size={18} aria-hidden="true" />
      )}
      <span className="sr-only">{sitting ? 'Live, on the bench' : STATE_WORD[state]}</span>
    </span>
  )
}

interface RowCtx {
  past: boolean
  now: number
  /** The ESPN day on screen. */
  day: number
  week: LineupDay[]
  /** The night's one game-time call: the bench player is claimed once, by this call. */
  call: GameCall | null
  /** The bench player the call claims: his row says whom he covers. */
  marks: Map<number, RowMark>
}

type RowMark = { kind: 'covers'; who: string }

function callMarks(call: GameCall | null): Map<number, RowMark> {
  const m = new Map<number, RowMark>()
  if (call?.fill) m.set(call.fill.sub.spot.player_id, { kind: 'covers', who: lastName(call.doubt.spot.name) })
  return m
}

/** The call's tray under the doubtful starter: his row and the strip both open and close it. */
interface Tray {
  id: string
  open: boolean
  toggle: () => void
}

function Row({ row, ctx, swap, tray }: { row: PlayerRow; ctx: RowCtx; swap: boolean; tray?: Tray }) {
  const [whyOpen, setWhyOpen] = useState(false)
  const { past } = ctx
  const { spot, game, line, state } = row
  const quiet = state === 'idle' || isIR(spot)
  // In a game but on his NBA bench right now: the row stays calm, the game clock keeps its gold.
  const sitting = state === 'live' && line?.on_court === false
  const avg = state === 'later' && !past ? spot.season_avg : null
  const abbrev = nbaAbbrev(spot.pro_team_id)
  const counted = spot.starting
  const injured = spot.injury_status !== 'ACTIVE' && spot.injury_status !== 'NORMAL'
  const play = past ? null : (spot.play ?? null)
  const rated = !!play && play.tag !== 'Available'
  const mark = ctx.marks.get(spot.player_id) ?? null
  const rc = rated ? rowCall(row, ctx.call) : null
  const words = playWords(spot, play, mark, rc)
  // The injury-report tag. Probable stays quiet: no tag, the number alone.
  const tag = rated && play.tag !== 'Probable' ? <PlayTag play={play} /> : null
  // Ruled out tonight in a slot that counts: the one state that dims his face.
  const ruled = rated && play.chance === 0 && counted && state === 'later'
  // The basis sits behind a tap on every rated row (a tooltip alone never reaches a phone).
  const whyId = `mp-why-${spot.player_id}`
  const canWhy = rated && !tray
  const expanded = tray ? tray.open : whyOpen
  const short = phoneName(spot.name, injured && !tag)
  const player = { id: spot.player_id, name: spot.name }
  // The night grade: only at the final whistle. A live line is partial, so it gets no letter.
  const grade = state === 'final' && !isIR(spot) ? nightGrade(line) : null
  const cls = [
    'mp-row',
    `mp-${state}`,
    line ? 'mp-card' : '',
    grade ? `mp-graded mp-g-${grade.tier}` : '',
    counted ? 'mp-starter' : 'mp-sub',
    isIR(spot) ? 'mp-ir' : '',
    quiet ? 'mp-quiet' : '',
    avg ? 'mp-pre' : '',
    sitting ? 'mp-sitting' : '',
    swap ? 'mp-swap' : '',
    tray ? `mp-docked${tray.open ? ' mp-docked-open' : ''}` : '',
    words ? 'mp-has-play' : '',
    rc ? 'mp-acts' : '',
    tray || canWhy ? 'mp-tappable' : '',
    ruled ? 'mp-ruled' : '',
  ]
    .filter(Boolean)
    .join(' ')
  // Phones: the tag leaves the name for line 2, so the name keeps its room.
  const lead = words ? (
    <>
      {tag && <span className="mp-tag-line">{tag}</span>}
      {words}
    </>
  ) : null
  return (
    <>
      <li className={cls}>
        {(tray || canWhy) && (
          <button
            type="button"
            className="mp-why-hit"
            aria-expanded={expanded}
            aria-controls={tray ? tray.id : whyId}
            onClick={tray ? tray.toggle : () => setWhyOpen((o) => !o)}
          >
            <span className="sr-only">
              {tray ? `Game-time call on ${lastName(spot.name)}` : `What ${pct(play!.chance)} means for ${lastName(spot.name)}`}
            </span>
          </button>
        )}
        <span className="mp-spine">
          {grade ? <GradeMark grade={grade} /> : <Mark state={isIR(spot) ? 'idle' : state} sitting={sitting} />}
          <span className={`mp-slot${counted ? '' : ' sub'}`}>{spot.slot}</span>
        </span>
        <span className="mp-who">
          <PlayerLink player={player} decorative>
            <PlayerHead player={player} size={32} team={abbrev} />
          </PlayerLink>
          <span className={`mp-name${short ? ' mp-has-short' : ''}`}>
            <PlayerLink
              player={player}
              after={
                tag ? (
                  <span className="mp-tag-name">{tag}</span>
                ) : injured && !play ? (
                  <span className={`mp-inj${spot.injury_status === 'OUT' ? ' out' : ''}`}>{injuryShort(spot.injury_status)}</span>
                ) : undefined
              }
            >
              {short ? (
                <>
                  <span className="mp-full-name">{spot.name}</span>
                  <span className="mp-short-name">{short}</span>
                </>
              ) : undefined}
            </PlayerLink>
            {line && !counted && <span className="mp-nocount">{past ? "Didn't count" : "Doesn't count"}</span>}
            {words && <span className="mp-play mp-play-under">{words}</span>}
          </span>
        </span>
        {words && (quiet || !avg) && <span className="mp-play mp-playline">{lead}</span>}
        {quiet ? (
          <QuietCell row={row} ctx={ctx} />
        ) : (
          <>
            <GameCell game={game} pro={spot.pro_team_id} now={ctx.now} />
            {line ? (
              <Stats line={line} grade={grade} avgMin={state === 'final' ? spot.season_avg?.min : null} />
            ) : avg ? (
              <AverageNote
                avg={avg}
                lead={lead}
                basis={rated && rc && !tray ? <BasisLine play={play} now={ctx.now} /> : null}
              />
            ) : (
              <span className="mp-note">{quietNote(row)}</span>
            )}
          </>
        )}
      </li>
      {canWhy && (
        <li id={whyId} className="mp-whybox" hidden={!whyOpen}>
          <WhyBox play={play} now={ctx.now} />
        </li>
      )}
    </>
  )
}

function quietNote(row: PlayerRow): ReactNode {
  const { spot, state } = row
  // No average to show: he hasn't played this season (null), or the server predates averages.
  if (state === 'later') return spot.season_avg === null ? <span className="mp-long">No games played yet this season</span> : ''
  if (state === 'live') return 'Not in yet'
  if (state === 'dnp') return "Didn't play"
  return ''
}

/**
 * A row with nothing on that day: an idle starting slot, a bench player without a game, or IR.
 * Says when he plays next and how many games he has left this week.
 */
function QuietCell({ row, ctx }: { row: PlayerRow; ctx: RowCtx }) {
  const { spot, game } = row
  const nx = spot.next_game
  if (isIR(spot)) {
    const abbrev = nbaAbbrev(spot.pro_team_id)
    return (
      <span className="mp-quiet-cell">
        <span className="mp-what">
          <strong>On IR</strong>
          {game && (
            <span className="mp-long-ir">
              <em> · </em>
              <TeamLogo abbrev={abbrev} size={16} /> {abbrev} plays <span className="num">{tipOff(game.start)}</span>
            </span>
          )}
          <em> · </em>never counts
        </span>
      </span>
    )
  }
  const tonight = ctx.past ? 'that day' : 'tonight'
  return (
    <span className="mp-quiet-cell">
      <span className="mp-what">
        <strong>No game {tonight}</strong>
        {nx && (
          <>
            <em> · </em>next {weekday(nx.date)} {nx.home ? 'vs' : '@'} <TeamLogo abbrev={nx.opponent.abbrev} size={16} />{' '}
            {nx.opponent.abbrev} <span className="num">{tipOff(nx.start)}</span>
          </>
        )}
      </span>
      {nx && (
        <span className="mp-next">
          <span className="mp-next-word">Next </span>
          {nextLabel(nx)}
        </span>
      )}
      {ctx.week.length > 1 && (
        <span className="mp-left muted">
          <span className="num">{gamesLeft(spot, ctx.day)}</span> left this week
        </span>
      )}
    </span>
  )
}

function GameCell({ game, pro, now }: { game: Game | null; pro: number; now: number }) {
  if (!game) return <span className="mp-game muted">No game</span>
  const scheduled = game.status === 'scheduled'
  if (scheduled) return <TipCell game={game} pro={pro} now={now} />
  const lead = leader(game)
  const side = (s: Game['away'], who: 'away' | 'home') => (
    <span className={`mp-side${lead === who ? ' lead' : ''}`}>
      {who === 'home' && !scheduled && <span className="num mp-score">{s.score ?? 0}</span>}
      <TeamLogo abbrev={s.abbrev} size={18} />
      <span className="mp-abbrev">{s.abbrev}</span>
      {who === 'away' && !scheduled && <span className="num mp-score">{s.score ?? 0}</span>}
    </span>
  )
  return (
    <span className="mp-game">
      <span className="mp-score-line">
        {side(game.away, 'away')}
        <span className="mp-vs" aria-hidden="true">
          {scheduled ? '@' : '–'}
        </span>
        {side(game.home, 'home')}
      </span>
      <span className="mp-status small">
        {game.status === 'live' ? (
          <span className="mp-clock">
            <i className="mp-dot" aria-hidden="true" />
            {game.clock ?? 'Live'}
          </span>
        ) : scheduled ? (
          <span className="num">{tipOff(game.start)}</span>
        ) : (
          <span className="mp-final-tag">Final</span>
        )}
      </span>
    </span>
  )
}

/**
 * A game still to come, shaped like a live one: the matchup on top, and where the clock would be,
 * the tip-off and the time left ("4:00 AM · in 11m", gold inside the last hour).
 */
function TipCell({ game, pro, now }: { game: Game; pro: number; now: number }) {
  const cd = countdown(game.start, now)
  const home = game.home.pro_team_id === pro
  const side = (sd: Game['away'], own: boolean) => (
    <span className={`mp-side${own ? ' own' : ' opp'}`}>
      <TeamLogo abbrev={sd.abbrev} size={18} />
      <span className="mp-abbrev">{sd.abbrev}</span>
    </span>
  )
  return (
    <span className="mp-game mp-tipcell">
      <span className="mp-score-line">
        <span className="mp-where" aria-hidden="true">
          {home ? 'vs' : '@'}
        </span>
        {side(game.away, !home)}
        <span className="mp-vs" aria-hidden="true">
          @
        </span>
        {side(game.home, home)}
      </span>
      <span className="mp-status small">
        <span className="num mp-tip-time">{tipOff(game.start)}</span>
        <span className="mp-sep" aria-hidden="true">
          ·
        </span>
        <span className={`mp-cd num${cd.soon ? ' soon' : ''}`}>{cd.text}</span>
      </span>
    </span>
  )
}

/**
 * The night grade, set like a letter on a report card in the row's spine, under the slot: the letter
 * large, its plus or minus small and raised. The A range is green, D and F coral, B and C neutral.
 * Final lines only; the spoken form says the letter and what moved it.
 */
function GradeMark({ grade }: { grade: NightGrade }) {
  const words = gradeWords(grade)
  return (
    <span className={`mp-grade ${grade.tier}`} title={words}>
      <span className="mp-grade-l" aria-hidden="true">
        {grade.letter}
        {grade.mod && <span className="mp-grade-m">{grade.mod}</span>}
      </span>
      <span className="sr-only">Final, {words}</span>
    </span>
  )
}

type Drive = 'up' | 'down'

function Stats({ line, grade, avgMin }: { line: GameLine; grade: NightGrade | null; avgMin?: number | null }) {
  const drive = new Map<string, Drive>((grade?.drivers ?? []).map((d) => [d.cat, d.z > 0 ? 'up' : 'down']))
  const delta = minutesDelta(line.minutes, avgMin)
  const cells: [string, ReactNode][] = [
    [
      'MIN',
      delta === null ? (
        line.minutes
      ) : (
        <span className="mp-min">
          {line.minutes}
          <span className="mp-min-d" title="Minutes against his season average">
            <span className="sr-only">, </span>
            {signed(delta)}
            <span className="sr-only"> against his average</span>
          </span>
        </span>
      ),
    ],
    ['FG', <ShotSplit made={line.fgm} attempts={line.fga} label="FG" />],
    ['FT', <ShotSplit made={line.ftm} attempts={line.fta} label="FT" />],
    ['3PM', line.tpm],
    ['REB', line.reb],
    ['AST', line.ast],
    ['STL', line.stl],
    ['BLK', line.blk],
    ['TO', line.to],
    ['PTS', line.pts],
  ]
  return <StatCells cells={cells} drive={drive} />
}

const CATEGORY_OF: Record<string, Category | undefined> = {
  FG: 'FG',
  FT: 'FT',
  '3PM': '3PM',
  REB: 'REB',
  AST: 'AST',
  STL: 'STL',
  BLK: 'BLK',
  TO: 'TO',
  PTS: 'PTS',
}

function StatCells({ cells, drive }: { cells: [string, ReactNode][]; drive?: Map<string, Drive> }) {
  return (
    <dl className="mp-stats">
      {cells.map(([k, v]) => {
        const cat = CATEGORY_OF[k]
        const d = cat ? drive?.get(cat) : undefined
        const cls = ['mp-stat', k === 'PTS' && 'pts', k === 'MIN' && 'min', d && `drv ${d}`, v === 0 && 'zero']
          .filter(Boolean)
          .join(' ')
        return (
          <div key={k} className={cls}>
            <dt>
              {k === 'TO' ? 'TO↓' : k}
              {d && <span className="sr-only">{d === 'up' ? ', helped most' : ', hurt most'}</span>}
            </dt>
            <dd className="num">
              {d ? (
                <span className="mp-drv">
                  {v}
                  <span className="mp-drv-c" aria-hidden="true">
                    {d === 'up' ? <CaretUp weight="fill" /> : <CaretDown weight="fill" />}
                  </span>
                </span>
              ) : (
                v
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Before tip-off, one quiet line: what he usually brings ("Season avg 26.9 pts · 3.7 reb · 5.5 ast"). */
function AverageNote({ avg, lead, basis }: { avg: SeasonAverage; lead?: ReactNode; basis?: ReactNode }) {
  const one = (v: number) => v.toFixed(1)
  return (
    <span className={`mp-note mp-avg-note${lead ? ' mp-led' : ''}`} title={`Season average over ${avg.gp} games`}>
      {lead && (
        <span className="mp-play mp-play-lead">
          {lead}
          <em className="mp-season-sep"> · </em>
        </span>
      )}
      <span className="mp-season">
        <span className="mp-long">Season avg </span>
        <b className="num">{one(avg.pts)}</b> pts
        <span className="mp-avg-reb">
          {' '}
          · <b className="num">{one(avg.reb)}</b> reb
        </span>
        <span className="mp-avg-ast">
          {' '}
          · <b className="num">{one(avg.ast)}</b> ast
        </span>
      </span>
      {basis}
    </span>
  )
}

/** The night in one calm line: the next tip-off (or what's on now), and how many starting slots play. */
function NightLine({ rows, counts: c, past, now }: { rows: PlayerRow[]; counts: Counts; past: boolean; now: number }) {
  const next = rows
    .filter((r) => r.spot.starting && r.state === 'later' && r.game)
    .sort((a, b) => a.game!.start.localeCompare(b.game!.start))[0]
  const idle = rows.filter((r) => r.spot.starting && r.state === 'idle').map((r) => lastName(r.spot.name))
  const cd = next?.game ? countdown(next.game.start, now) : null
  return (
    <p className="mp-night">
      {!past && next?.game ? (
        <span className="mp-night-tip">
          <span className="muted">{c.live + c.final > 0 ? 'Next tip' : 'First tip'}</span>{' '}
          <b className="num">{tipOff(next.game.start)}</b>{' '}
          <span className={`mp-cd num${cd?.soon ? ' soon' : ''}`}>{cd?.text}</span>
        </span>
      ) : c.live > 0 ? (
        <span className="mp-night-tip">
          <i className="mp-dot" aria-hidden="true" /> <b className="num">{c.live}</b> live now
        </span>
      ) : null}
      <span>
        <b className="num">{c.playing}</b> of <span className="num">{c.starters}</span> starting slots{' '}
        {past ? 'played' : 'play tonight'}
        {idle.length > 0 && <span className="muted"> · {past ? 'sat' : 'idle'}: {idle.join(', ')}</span>}
      </span>
    </p>
  )
}

/** The clock, ticking every half minute, for countdowns. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

function TotalsRow({ totals: t, past }: { totals: Totals; past: boolean }) {
  return (
    <div className="mp-totals">
      <span className="mp-spine" aria-hidden="true" />
      <span className="mp-totals-label">
        <b>{past ? "Starters' total" : 'Starters so far'}</b>
        <span className="small muted">
          {' '}
          {t.played} played{t.on > 0 ? ` · ${t.on} still on` : ''}
        </span>
      </span>
      <StatCells
        cells={[
          ['MIN', t.min],
          ['FG', <ShotSplit made={t.fgm} attempts={t.fga} label="FG" />],
          ['FT', <ShotSplit made={t.ftm} attempts={t.fta} label="FT" />],
          ['3PM', t.tpm],
          ['REB', t.reb],
          ['AST', t.ast],
          ['STL', t.stl],
          ['BLK', t.blk],
          ['TO', t.to],
          ['PTS', t.pts],
        ]}
      />
    </div>
  )
}

/**
 * The name phones show when the full one won't fit beside the face and the score: the last name
 * ("Antetokounmpo"). Null when the full name fits (about 18 characters, 15 with an injury pill).
 */
function phoneName(name: string, pill: boolean): string | null {
  if (!name.includes(' ') || name.length <= (pill ? 15 : 18)) return null
  return lastName(name)
}

function MyPlayersLoading() {
  return (
    <section className="card mp" aria-busy="true" aria-label="My Players loading">
      <header className="mp-head">
        <h2 className="mp-title">
          <UsersThree size={22} aria-hidden="true" />
          My Players
        </h2>
        <span className="small muted">Reading your lineup from ESPN…</span>
      </header>
      <div className="stack" style={{ gap: 8 }}>
        {Array.from({ length: 5 }, (_, k) => (
          <Bone key={k} h={56} className="mp-bone" />
        ))}
      </div>
    </section>
  )
}

/* ---------- Final Word: the chance to play and the night's one call ---------- */

/** The pill beside the name: the injury-report letter (Q, D, DTD, OUT), never wider than "DTD". */
function PlayTag({ play }: { play: PlayChance }) {
  // Upgraded: ESPN still says OUT, so the tag does too. The good news is line 2's job.
  const tone = play.upgraded ? 'low' : playTone(play)
  const word = play.upgraded ? 'OUT' : PLAY_TAG[play.tag]
  return (
    <span className={`mp-inj mp-tag ${tone}`} title={play.upgraded ? 'ESPN still lists him out' : play.tag}>
      {word}
      <span className="sr-only"> ({play.upgraded ? 'out on ESPN' : play.tag})</span>
    </span>
  )
}

/**
 * Line 2 of a rated row, verb first: "Leave in · 55% to play · Gafford covers", "Swap now · 5% to
 * play", "↑ Could be back Thu · 58% to play", "Missed 11 · 10% next game". The number is always in
 * ink and always labelled: a chance is not an outcome, so the tag carries the colour.
 */
function playWords(spot: LineupSpot, play: PlayChance | null, mark: RowMark | null, rc: RowCall | null): ReactNode {
  if (mark?.kind === 'covers')
    return (
      <span className="mp-pw covers">
        <UserSwitch size={13} weight="bold" aria-hidden="true" />
        <b className="mp-verb">Covers {mark.who}</b>
      </span>
    )
  if (!play || play.tag === 'Available') return null
  const n = <b className="num mp-pw-n">{pct(play.chance)}</b>
  const tail = (t: string | null, wide?: string) =>
    t ? (
      <span className="mp-pw-b">
        <em> · </em>
        {wide ? (
          <>
            <span className="mp-narrow">{t}</span>
            <span className="mp-wide">{wide}</span>
          </>
        ) : (
          t
        )}
      </span>
    ) : null
  if (play.upgraded)
    return (
      <span className="mp-pw">
        <span className="mp-pw-up">
          <ArrowUp size={12} weight="bold" aria-hidden="true" />
          Could be back {spot.next_game ? weekday(spot.next_game.date) : 'soon'}
        </span>
        <em> · </em>
        {n} to play
      </span>
    )
  if (play.chance === 0)
    return rc?.verb ? (
      <span className="mp-pw">
        <b className="mp-verb">{rc.verb}</b>
        <em> · </em>ruled out tonight
      </span>
    ) : (
      <span className="mp-pw">
        <b className="mp-verb">Ruled out tonight</b>
        {tail(spot.starting ? 'no sub plays' : null)}
      </span>
    )
  if (play.tag === 'Out')
    return (
      <span className="mp-pw">
        {play.missed_in_a_row != null && (
          <>
            Missed <span className="num">{play.missed_in_a_row}</span>
            <em> · </em>
          </>
        )}
        {n} next game
        {tail(play.news ? null : 'no word yet')}
      </span>
    )
  return (
    <span className="mp-pw">
      {rc?.verb && (
        <>
          <b className="mp-verb">{rc.verb}</b>
          <em> · </em>
        </>
      )}
      {n} to play
      {tail(rc?.why ?? (!play.news && play.chance < 0.8 ? 'no word yet' : null), rc?.whyWide)}
    </span>
  )
}

/** Desktop, under the season line: what the number is and how fresh the word is. */
function BasisLine({ play, now }: { play: PlayChance; now: number }) {
  const b = basisShort(play)
  if (!b) return null
  return (
    <span className="mp-basis">
      {b}
      <em> · </em>
      {newsAge(play, now)}
    </span>
  )
}

/** Behind the row's tap: the whole basis, then ESPN's word on him (or that there's none yet). */
function WhyBox({ play, now }: { play: PlayChance; now: number }) {
  return (
    <>
      <p className="mp-why-basis">
        <Info size={14} weight="bold" aria-hidden="true" />
        <span>
          {play.basis} <span className="muted">The number gets sharper closer to tip-off; it is not a promise.</span>
        </span>
      </p>
      <p className="mp-why-news">
        {play.news ? (
          <>
            “{play.news}” <span className="muted">ESPN · {newsAge(play, now).replace('news ', '')}</span>
          </>
        ) : (
          <span className="muted">No word from the team yet.</span>
        )}
      </p>
    </>
  )
}

/** "Gafford in at UTIL, Braun to SG": how the bench player gets into ``into`` (the doubt's slot). */
function fillWords(f: Fill, into: string): ReactNode {
  const sub = lastName(f.sub.spot.name)
  return f.slide ? (
    <>
      <b>{sub}</b> in at {f.slot}, {lastName(f.slide.spot.name)} to {into}
    </>
  ) : (
    <>
      <b>{sub}</b> in at {f.slot}
    </>
  )
}

const at = (iso: string) => new Date(iso).getTime()
const clockShort = (t: number) => tipOff(new Date(t).toISOString()).replace(/\s?[AP]M$/i, '')

/**
 * The game-time call, docked under the doubtful starter like a tray pulled from his row. On desktop
 * it is open: the decision, the night as two lanes (him and the bench player who can step in) to
 * their tip-offs, a gold column where the final word usually lands, and the two ifs. On phones it is
 * one 44px strip (the verdict, its deadline and a thumbnail of the lanes) that opens on a tap, and
 * opens itself when Can must decide now or the word is due.
 */
function CallCard({ call, now, tray }: { call: GameCall; now: number; tray: Tray }) {
  const { doubt, play, fill } = call
  const name = lastName(doubt.spot.name)
  const sub = fill ? lastName(fill.sub.spot.name) : ''
  const subTip = fill?.sub.game ? at(fill.sub.game.start) : null
  const end = Math.max(call.tip, subTip ?? 0)
  const span = Math.max(end - now, HOUR_MS)
  const x = (t: number) => Math.min(100, Math.max(0, ((t - now) / span) * 100))
  const time = (t: number) => tipOff(new Date(t).toISOString())
  const wordShort = `${clockShort(call.wordFrom)}–${time(call.wordTo)}`
  const gap = subTip ? Math.round(((subTip - call.tip) / HOUR_MS) * 2) / 2 : 0
  const gapWords = gap === 1 ? 'an hour' : `${Math.abs(gap)} hours`
  const late = call.verdict === 'wait' && wordLate(call, now)
  const lock = subTip ? clockShort(subTip) : ''
  // The strip: why and by when, short enough for 360px. The row above already has the verb.
  const strip: [string, string] =
    call.verdict === 'wait'
      ? late
        ? ['Still no word', `decide by ${lock}`]
        : ['Wait for the word', `free till ${lock}`]
      : play.chance === 0
        ? [`${sub} in at ${fill!.slot}`, `locks ${lock}`]
        : [`${sub} locks ${lock}`, 'before the word']
  const headline =
    call.verdict === 'wait' ? (
      late ? (
        <>
          Still no word on {name}. <span className="mp-call-soft">Decide by {time(subTip!)}.</span>
        </>
      ) : (
        <>
          Leave {name} in. <span className="mp-call-soft">Wait for the word.</span>
        </>
      )
    ) : (
      <>
        {play.chance < 0.3 ? `Swap ${name} out now.` : 'Decide now.'}{' '}
        <span className="mp-call-soft">{play.chance === 0 ? "He's ruled out." : `${sub} locks first.`}</span>
      </>
    )
  const lanes: { key: string; who: PlayerRow; t: number; role: string }[] = [
    { key: 'doubt', who: doubt, t: call.tip, role: 'doubt' },
    ...(fill && subTip ? [{ key: 'sub', who: fill.sub, t: subTip, role: 'sub' }] : []),
  ]
  const cols = { ['--c0' as string]: `${x(call.wordFrom)}%`, ['--c1' as string]: `${x(call.wordTo)}%` }
  const basis = basisShort(play)
  // Ruled out: the word has landed, so there is no column to wait for, only the sub's lock.
  const ruledOut = play.chance === 0
  // Inside the window the column starts at "now": one label says both.
  const due = !ruledOut && !late && now >= call.wordFrom
  return (
    <li className={`mp-call ${call.verdict}${tray.open ? ' open' : ''}`} aria-label={`Game-time call: ${name}`}>
      <button type="button" className="mp-call-strip" aria-expanded={tray.open} aria-controls={tray.id} onClick={tray.toggle}>
        <span className="mp-thumb" style={cols} aria-hidden="true">
          {lanes.map((l) => (
            <i key={l.key} className={l.role} style={{ ['--x' as string]: `${x(l.t)}%` }} />
          ))}
        </span>
        <span className="mp-strip-text">
          <b>{strip[0]}</b>
          <em> · </em>
          {strip[1]}
        </span>
        <CaretDown size={16} weight="bold" className="mp-strip-caret" aria-hidden="true" />
      </button>

      <div className="mp-call-body" id={tray.id}>
        <div className="mp-call-lead">
          <p className="mp-call-kicker">
            <ClockCountdown size={14} weight="bold" aria-hidden="true" />
            Game-time call
          </p>
          <p className="mp-call-head">{headline}</p>
          {basis && (
            <p className="mp-call-odds" title={play.basis}>
              <span className="num mp-call-n">{pct(play.chance)}</span>
              <span className="mp-call-n-label">{basis.replace(/^\d+% /, '')}</span>
            </p>
          )}
        </div>

        <div className="mp-call-time" role="img" aria-label={laneWords(call, name, sub, time)}>
          <div className="mp-lanes" style={cols}>
            <span className="mp-now" aria-hidden="true">
              {due ? 'Now · word due' : 'Now'}
            </span>
            {!ruledOut && !late && (
              <>
                <span className={`mp-word${x(call.wordFrom) > 55 ? ' end' : ''}${due ? ' due' : ''}`} aria-hidden="true">
                  <span className="mp-wide">Final word usually </span>
                  <span className="mp-narrow">Word </span>~<span className="num">{wordShort}</span>
                </span>
                <span className="mp-col" aria-hidden="true" />
              </>
            )}
            {lanes.map((l) => (
              <span
                key={l.key}
                className={`mp-lane ${l.role}${x(l.t) < 45 ? ' short' : ''}${x(l.t) < 25 ? ' tiny' : ''}`}
                style={{ ['--x' as string]: `${x(l.t)}%` }}
              >
                <span className="mp-lane-who">
                  {lastName(l.who.spot.name)}
                  <span className="mp-lane-who-t">
                    {' '}
                    · <span className="num">{time(l.t)}</span>
                  </span>
                </span>
                <span className="mp-lane-tip">
                  <span className="num">{time(l.t)}</span>
                  <span className="mp-wide"> tip</span>
                </span>
                <span className="mp-lane-bar" />
              </span>
            ))}
          </div>
          {fill && subTip && (
            <p className="mp-call-why">
              {ruledOut ? (
                <>
                  Nothing to wait for: <b>swap {sub} in by {time(subTip)}</b>, when his game locks.
                </>
              ) : late ? (
                <>
                  No word on {name} yet. <b>Decide by {time(subTip)}</b>, when {sub} locks.
                </>
              ) : call.free ? (
                <>
                  {sub} tips {gapWords} after {name}: <b>waiting is free until {time(subTip)}.</b>
                </>
              ) : (
                <>
                  {sub} tips at <span className="num">{time(subTip)}</span>, before {name}'s word lands.
                </>
              )}
            </p>
          )}
        </div>

        <ul className="mp-call-ifs">
          {fill && (
            <>
              <li>
                <ArrowElbowDownRight size={14} weight="bold" aria-hidden="true" />
                <span className="mp-if">
                  {call.verdict === 'now' ? (
                    'Swap now'
                  ) : (
                    <>
                      <span className="mp-wide">Ruled out</span>
                      <span className="mp-narrow">Sits</span>
                    </>
                  )}
                </span>
                <span>{fillWords(fill, doubt.spot.slot)}</span>
              </li>
              {play.chance > 0 && (
                <li>
                  <ArrowElbowDownRight size={14} weight="bold" aria-hidden="true" />
                  <span className="mp-if">
                    {call.verdict === 'now' ? (
                      'Keep him'
                    ) : (
                      <>
                        <span className="mp-wide">He plays</span>
                        <span className="mp-narrow">Plays</span>
                      </>
                    )}
                  </span>
                  <span>
                    {call.planB ? (
                      <>
                        <b>{sub}</b> takes {lastName(call.planB.row.spot.name)}'s spot
                        <span className="mp-wide">
                          {' '}
                          (<span className="num">{pct(call.planB.row.spot.play!.chance)}</span> to play) by{' '}
                          <span className="num">{time(subTip ?? call.tip)}</span>
                        </span>
                      </>
                    ) : call.verdict === 'now' ? (
                      <>
                        <span className="num">{pct(play.chance)}</span> he plays, {sub} sits
                      </>
                    ) : (
                      <>{sub} stays on the bench</>
                    )}
                  </span>
                </li>
              )}
            </>
          )}
        </ul>

        <p className="mp-call-news">
          {play.news ? (
            <>
              <span className="mp-call-news-t">“{play.news}”</span>
              <span className="mp-call-news-at"> ESPN · {newsAge(play, now).replace('news ', '')}</span>
            </>
          ) : (
            <span className="mp-call-news-at">No word from the team yet.</span>
          )}
        </p>
        {basis && (
          <p className="mp-call-basis">
            {basisShort(play, true)}
            <em> · </em>
            {newsAge(play, now)}
          </p>
        )}
      </div>
    </li>
  )
}

const HOUR_MS = 3_600_000

function laneWords(call: GameCall, name: string, sub: string, time: (t: number) => string): string {
  const parts = [
    call.play.chance === 0
      ? `${name} is ruled out`
      : `Final word on ${name} usually lands ${time(call.wordFrom)} to ${time(call.wordTo)}`,
    `${name} tips ${time(call.tip)}`,
  ]
  if (call.fill?.sub.game) parts.push(`${sub} tips ${time(at(call.fill.sub.game.start))}`)
  return parts.join('; ')
}
