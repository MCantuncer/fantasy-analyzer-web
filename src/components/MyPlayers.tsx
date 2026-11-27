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
  ClockCountdown,
  UsersThree,
} from '@phosphor-icons/react'
import { fetchLineup, fetchScores } from '../api/client'
import type { LineupDay, LineupSpot, PlayChance, SeasonAverage } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { nbaAbbrev } from '../lib/filmRoom'
import { injuryShort } from '../lib/injury'
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
  PLAY_TAG,
  pct,
  playTone,
  rowCall,
  starterTotals,
  statusCounts,
  swapToMake,
  weekday,
  wordLate,
} from '../lib/myPlayers'
import type { Fill, GameCall, PlayerRow, RowCall, StatusCounts, Swap } from '../lib/myPlayers'
import { shortNames } from '../lib/todayMatchup'
import { longDayLabel, tipOff } from '../lib/scores'
import { PlayerLink } from './PlayerCard'
import { ColumnHead, EmptyRow, Field, Row, Slide, Totals, TotalsBeforeTip } from './QuietField'
import type { RowExtras } from './QuietField'
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
  // The rated rows whose why is open under them.
  const [whyOpen, setWhyOpen] = useState<Set<number>>(() => new Set())
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
        <section className="mp mp-error" aria-labelledby="mp-title">
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
  const status = statusCounts(rows, open.length)
  const swap = past ? null : swapToMake(rows, open)
  const totals = starterTotals(rows)
  const starters = rows.filter((r) => r.spot.starting)
  const bench = rows.filter((r) => isBench(r.spot))
  const benchPlays = bench.filter((r) => r.state !== 'idle')
  const benchIdle = bench.filter((r) => r.state === 'idle')
  const ir = rows.filter((r) => isIR(r.spot))
  const leftOut = past ? benchLeftOut(rows) : null
  const i = data.days.findIndex((d) => d.day === data.day)
  const prev = data.days[i - 1]
  const next = data.days[i + 1]
  const espn = espnTeamUrl(leagueId, teamId, season)
  const call = past || switching ? null : gameTimeCall(rows)
  const ctx: RowCtx = { past, now, day: lineup.data.day, week: lineup.data.week ?? [], call, marks: callMarks(call) }
  const trayOpen = call ? (callOpen ?? (call.verdict === 'now' || inWordWindow(call, now))) : false
  const tray: Tray = { id: 'mp-call', open: trayOpen, toggle: () => setCallOpen(!trayOpen) }
  // Phones: last names, told apart only within your own roster ("George", not "K. George").
  const names = shortNames(rows.map((r) => r.spot.name))
  // Before any starter has played a minute there are no figures: no column head, no pager, no zeros.
  const pretip = !starters.some((r) => r.line && r.line.minutes > 0)
  const whyOf = (r: PlayerRow) => ({
    open: whyOpen.has(r.spot.player_id),
    toggle: () =>
      setWhyOpen((s) => {
        const n = new Set(s)
        if (!n.delete(r.spot.player_id)) n.add(r.spot.player_id)
        return n
      }),
  })
  const row = (r: PlayerRow, opts: { bench?: boolean; quiet?: boolean } = {}) => (
    <Row key={r.spot.player_id} row={r} names={names} {...opts} {...extrasFor(r, ctx, whyOf(r), !!opts.bench)} />
  )

  return (
    <section className={`mp${switching ? ' mp-switching' : ''}`} aria-labelledby="mp-title" aria-busy={switching}>
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

      {swap && <SwapNote swap={swap} espn={espn} />}
      {call && (
        <ul className="mp-notes">
          <CallCard call={call} now={now} tray={tray} />
        </ul>
      )}

      {/* Quiet Field, as on Today: the starters and their total on one soft field, the bench and IR on
          the bare page. Slot, face and name stay pinned on phones while the figures slide. */}
      <div className="tm mp-lineup">
        <Slide starters={starters} pager={!pretip} head={<StatusLine c={status} past={past} now={now} />}>
          <>
            {!pretip && <ColumnHead />}
            <Field>
              <ol className="tm-list" aria-label="Starters">
                {starters.map((r) => row(r))}
                {open.map((slot, k) => (
                  <EmptyRow key={`open-${slot}-${k}`} slot={slot} />
                ))}
              </ol>
              {totals.played > 0 ? (
                <Totals totals={totals} label={past ? "Starters' total" : 'Starters so far'} />
              ) : (
                <TotalsBeforeTip firstTip={past ? null : status.nextTip} label={past ? "Starters' total" : 'Starters so far'} />
              )}
            </Field>
            {bench.length > 0 && (
              <>
                <h3 className="tm-sub">Bench</h3>
                {benchPlays.length > 0 && (
                  <ol className="tm-list tm-bench" aria-label="Bench">
                    {benchPlays.map((r) => row(r, { bench: true }))}
                  </ol>
                )}
                {benchIdle.length > 0 && (
                  <>
                    <p className="tm-sublab">No game</p>
                    <ol className="tm-list tm-bench" aria-label="Bench, no game">
                      {benchIdle.map((r) => row(r, { bench: true, quiet: true }))}
                    </ol>
                  </>
                )}
              </>
            )}
            {ir.length > 0 && (
              <>
                <h4 className="tm-sublab">IR</h4>
                <ol className="tm-list tm-bench" aria-label="IR">
                  {ir.map((r) => row(r, { bench: true, quiet: true }))}
                </ol>
              </>
            )}
          </>
        </Slide>
        {leftOut && leftOut.line && (
          <p className="mp-left-out small">
            <Last spot={leftOut.spot} tail="'s" /> <b className="num">{leftOut.line.pts}</b> pts sat on your bench while{' '}
            {c.idle === 1 ? 'a starting slot was' : `${c.idle} starting slots were`} idle.
          </p>
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
        <b>Swap before {tip}:</b> <Last spot={swap.bench.spot} /> plays from your bench,{' '}
        {swap.idle ? (
          <>
            <Last spot={swap.idle.spot} /> has no game in {swap.slot}.
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

/**
 * Every starting slot, once: "● 4 live · 3 to come · 2 out · 1 idle · next tip 1:00 AM, in 31m". A past
 * day: "9 played · 1 idle". The gold dot is the only gold, and only while someone is live.
 */
function StatusLine({ c, past, now }: { c: StatusCounts; past: boolean; now: number }) {
  const parts: ReactNode[] = []
  const add = (n: number, words: string, key: string) => {
    if (n > 0) parts.push(<span key={key}>{words.replace('#', String(n))}</span>)
  }
  if (past) {
    add(c.final + c.live, '# played', 'played')
    add(c.dnp, "# didn't play", 'dnp')
  } else {
    if (c.live > 0)
      parts.push(
        <span key="live">
          <i className="mp-dot" aria-hidden="true" /> <b>{c.live} live</b>
        </span>,
      )
    add(c.final + c.dnp, '# final', 'final')
    add(c.later, '# to come', 'later')
  }
  add(c.out, '# out', 'out')
  add(c.idle, '# idle', 'idle')
  add(c.empty, c.empty === 1 ? '# empty slot' : '# empty slots', 'empty')
  const tip =
    !past && c.nextTip ? (
      <span className="mp-next-tip">
        {c.live + c.final + c.dnp > 0 ? 'next tip' : 'first tip'} {tipOff(c.nextTip)}, {countdown(c.nextTip, now).text}
      </span>
    ) : null
  return (
    <span className="mp-status-line num">
      {parts.map((p, k) => (
        <Fragment key={k}>
          {k > 0 && <em> · </em>}
          {p}
        </Fragment>
      ))}
      {tip && (
        <>
          <em className="mp-next-sep"> · </em>
          {tip}
        </>
      )}
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

type RowMark = { kind: 'covers'; who: Pick<LineupSpot, 'player_id' | 'name'> }

function callMarks(call: GameCall | null): Map<number, RowMark> {
  const m = new Map<number, RowMark>()
  if (call?.fill) m.set(call.fill.sub.spot.player_id, { kind: 'covers', who: call.doubt.spot })
  return m
}

/** The call's tray: its strip opens and closes it on phones. */
interface Tray {
  id: string
  open: boolean
  toggle: () => void
}

const OUT_STATUS = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION'])

/**
 * What My Players adds to a Quiet Field row: the injury tag after the name, the play words and his
 * next game (line 3 on phones, the MIN edge from 760), the grade's carets and minutes on a final
 * line, and the why behind a play chance.
 */
function extrasFor(
  row: PlayerRow,
  ctx: RowCtx,
  why: { open: boolean; toggle: () => void },
  bench: boolean,
): RowExtras {
  const { spot, state, line, game } = row
  const ir = isIR(spot)
  const play = ctx.past ? null : (spot.play ?? null)
  const rated = !!play && play.tag !== 'Available'
  const mark = ctx.marks.get(spot.player_id) ?? null
  const rc = rated ? rowCall(row, ctx.call) : null
  const played = !!line && line.minutes > 0
  const words = played ? null : playWords(spot, play, mark, rc, callPeople(ctx.call))
  const injured = spot.injury_status !== 'ACTIVE' && spot.injury_status !== 'NORMAL'
  // The injury-report tag. Probable stays quiet: no tag, the number alone. Once he has played, the
  // question is answered: the tag goes.
  const tag = played ? null : rated ? (
    play.tag !== 'Probable' ? (
      <PlayTag play={play} />
    ) : null
  ) : injured ? (
    <span
      className={`tm-tag${OUT_STATUS.has(spot.injury_status) ? ' tm-out' : ''}`}
      title={spot.injury_status.replace(/_/g, ' ').toLowerCase()}
    >
      {injuryShort(spot.injury_status)}
    </span>
  ) : null
  const usual = spot.season_avg && state === 'later' && !bench ? <Usual avg={spot.season_avg} /> : null
  const left = ctx.week.length > 1 ? gamesLeft(spot, ctx.day) : null
  const nx = spot.next_game
  const ex: RowExtras = { tag, detail: true }
  if (rated && !played && ctx.call?.doubt !== row) {
    ex.why = {
      id: `mp-why-${spot.player_id}`,
      label: `What ${pct(play.chance)} means for ${lastName(spot.name)}`,
      body: <WhyBox play={play} now={ctx.now} />,
      ...why,
    }
  }
  if (ir) {
    // Under the IR label "On IR" would say it twice: line 2 is his team's game, from 760.
    ex.status = game ? (
      <span className="tm-wmid">
        {nbaAbbrev(spot.pro_team_id)} plays {tipOff(game.start)}
      </span>
    ) : undefined
    if (words) ex.note = words
    return ex
  }
  if (state === 'idle') {
    const where = nx ? (
      <>
        next {weekday(nx.date)} {nx.home ? 'vs' : '@'} {nx.opponent.abbrev}
        <span className="tm-wmid"> {tipOff(nx.start)}</span>
      </>
    ) : null
    const leftWords = left !== null ? `${left} left this week` : null
    if (bench) {
      // Phones: one line ("next Mon vs LAC · 0 left"); from 760 the games left move to the MIN edge.
      ex.status = where ? (
        <>
          {where}
          {left !== null && <span className="tm-nmid"> · {left} left</span>}
        </>
      ) : undefined
      if (leftWords) {
        ex.note = leftWords
        ex.noteWide = true
      }
      return ex
    }
    ex.note =
      where || leftWords ? (
        <>
          {where}
          {where && leftWords && ' · '}
          {leftWords}
        </>
      ) : undefined
    return ex
  }
  // Ruled out tonight in a slot that counts: the one state that dims his face.
  ex.dim = rated && play.chance === 0 && spot.starting && state === 'later'
  if (words)
    ex.note = (
      <>
        {words}
        {usual && <span className="tm-wmid"> · {usual}</span>}
      </>
    )
  if (bench) ex.usual = false
  return ex
}

/** "usually 8 PTS · 3 REB · 2 AST": his season average, rounded. */
function Usual({ avg }: { avg: SeasonAverage }) {
  return (
    <>
      usually {Math.round(avg.pts)} PTS · {Math.round(avg.reb)} REB · {Math.round(avg.ast)} AST
    </>
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

function MyPlayersLoading() {
  return (
    <section className="mp" aria-busy="true" aria-label="My Players loading">
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
    <span className={`tm-tag${tone === 'calm' ? '' : ` tm-${tone}`}`} title={play.upgraded ? 'ESPN still lists him out' : play.tag}>
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
function playWords(
  spot: LineupSpot,
  play: PlayChance | null,
  mark: RowMark | null,
  rc: RowCall | null,
  people: Person[] = [],
): ReactNode {
  if (mark?.kind === 'covers')
    return (
      <span className="mp-pw covers">
        <b className="mp-verb">
          Covers <Last spot={mark.who} />
        </b>
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
            <span className="mp-narrow">{named(t, people)}</span>
            <span className="mp-wide">{named(wide, people)}</span>
          </>
        ) : (
          named(t, people)
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
        <b className="mp-verb">{named(rc.verb, people)}</b>
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
          <b className="mp-verb">{named(rc.verb, people)}</b>
          <em> · </em>
        </>
      )}
      {n} to play
      {tail(rc?.why ?? (!play.news && play.chance < 0.8 ? 'no word yet' : null), rc?.whyWide)}
    </span>
  )
}

/** Behind the row's tap: the whole basis, then ESPN's word on him (or that there's none yet). */
function WhyBox({ play, now }: { play: PlayChance; now: number }) {
  return (
    <>
      <p>
        {play.basis} The number gets sharper closer to tip-off; it is not a promise.
      </p>
      <p>
        {play.news ? (
          <>
            “{play.news}” ESPN · {newsAge(play, now).replace('news ', '')}
          </>
        ) : (
          'No word from the team yet.'
        )}
      </p>
    </>
  )
}

/** "Gafford in at UTIL, Braun to SG": how the bench player gets into ``into`` (the doubt's slot). */
function fillWords(f: Fill, into: string): ReactNode {
  const sub = <Last spot={f.sub.spot} />
  return f.slide ? (
    <>
      <b>{sub}</b> in at {f.slot}, <Last spot={f.slide.spot} /> to {into}
    </>
  ) : (
    <>
      <b>{sub}</b> in at {f.slot}
    </>
  )
}

type Person = Pick<LineupSpot, 'player_id' | 'name'>

/** The players tonight's call can name in a row's words: the doubt and the bench player who covers him. */
function callPeople(call: GameCall | null): Person[] {
  if (!call) return []
  return call.fill ? [call.fill.sub.spot, call.doubt.spot] : [call.doubt.spot]
}

const isLetter = (c: string | undefined) => !!c && /\p{L}/u.test(c)

/** A row's words ("Burries covers", "Swap if Mara plays") with each named player's last name opening his card. */
function named(text: string, people: Person[]): ReactNode {
  let first: { at: number; who: Person; word: string } | null = null
  for (const who of people) {
    const word = lastName(who.name)
    let at = text.indexOf(word)
    while (at >= 0 && (isLetter(text[at - 1]) || isLetter(text[at + word.length]))) at = text.indexOf(word, at + 1)
    if (at >= 0 && (!first || at < first.at)) first = { at, who, word }
  }
  if (!first) return text
  const rest = text.slice(first.at + first.word.length)
  const tail = /^\S*/.exec(rest)![0]
  return (
    <>
      {text.slice(0, first.at)}
      <Last spot={first.who} tail={tail || undefined} />
      {named(rest.slice(tail.length), people)}
    </>
  )
}

/**
 * His last name, opening his player card ("Gafford"). ``tail`` is punctuation that belongs to the
 * name ("'s", ","): kept on its line, since a line can break right after the link.
 */
function Last({ spot, tail }: { spot: Person; tail?: string }) {
  const link = <PlayerLink player={{ id: spot.player_id, name: spot.name }}>{lastName(spot.name)}</PlayerLink>
  if (!tail) return link
  return (
    <span className="mp-keep">
      {link}
      {tail}
    </span>
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
  // In the open tray the names open the player card; the strip (a button) and the lanes' label keep the words.
  const nameL = <Last spot={doubt.spot} />
  const subL = fill ? <Last spot={fill.sub.spot} /> : null
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
          Still no word on <Last spot={doubt.spot} tail="." /> <span className="mp-call-soft">Decide by {time(subTip!)}.</span>
        </>
      ) : (
        <>
          Leave {nameL} in. <span className="mp-call-soft">Wait for the word.</span>
        </>
      )
    ) : (
      <>
        {play.chance < 0.3 ? <>Swap {nameL} out now.</> : 'Decide now.'}{' '}
        <span className="mp-call-soft">{play.chance === 0 ? "He's ruled out." : <>{subL} locks first.</>}</span>
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
                  Nothing to wait for: <b>swap {subL} in by {time(subTip)}</b>, when his game locks.
                </>
              ) : late ? (
                <>
                  No word on {nameL} yet. <b>Decide by {time(subTip)}</b>, when {subL} locks.
                </>
              ) : call.free ? (
                <>
                  {subL} tips {gapWords} after <Last spot={doubt.spot} tail=":" /> <b>waiting is free until {time(subTip)}.</b>
                </>
              ) : (
                <>
                  {subL} tips at <span className="num">{time(subTip)}</span>, before <Last spot={doubt.spot} tail="'s" /> word lands.
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
                        <b>{subL}</b> takes <Last spot={call.planB.row.spot} tail="'s" /> spot
                        <span className="mp-wide">
                          {' '}
                          (<span className="num">{pct(call.planB.row.spot.play!.chance)}</span> to play) by{' '}
                          <span className="num">{time(subTip ?? call.tip)}</span>
                        </span>
                      </>
                    ) : call.verdict === 'now' ? (
                      <>
                        <span className="num">{pct(play.chance)}</span> he plays, {subL} sits
                      </>
                    ) : (
                      <>{subL} stays on the bench</>
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
