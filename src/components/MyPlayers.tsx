import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  Minus,
  UsersThree,
} from '@phosphor-icons/react'
import { fetchLineup, fetchScores } from '../api/client'
import type { Game, GameLine } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { nbaAbbrev } from '../lib/filmRoom'
import { injuryShort } from '../lib/injury'
import {
  benchLeftOut,
  buildRows,
  counts,
  espnTeamUrl,
  isBench,
  isIR,
  lastName,
  starterTotals,
  swapToMake,
} from '../lib/myPlayers'
import type { PlayerRow, RowState, Swap, Totals } from '../lib/myPlayers'
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
  const [day, setDay] = useState<number | null>(null)
  // The day the page opens on: tonight's games, or last night's while they're still on.
  const [today, setToday] = useState<number | null>(null)
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

      <p className="mp-summary small">
        <span>
          <b className="num">{c.playing}</b> of <span className="num">{c.starters}</span> starting slots{' '}
          {past ? 'played' : `play ${when}`}
        </span>
        {c.live > 0 && (
          <span className="mp-count live">
            <i className="mp-dot" aria-hidden="true" />
            <b className="num">{c.live}</b> live
          </span>
        )}
        {c.final > 0 && !past && (
          <span className="mp-count">
            <CheckCircle size={14} weight="fill" aria-hidden="true" />
            <span className="num">{c.final}</span> final
          </span>
        )}
        {c.later > 0 && (
          <span className="mp-count">
            <Clock size={14} aria-hidden="true" />
            <span className="num">{c.later}</span> later
          </span>
        )}
        {c.idle > 0 && (
          <span className="mp-count">
            <Minus size={14} aria-hidden="true" />
            <span className="num">{c.idle}</span> idle
          </span>
        )}
      </p>

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
            <Row key={r.spot.player_id} row={r} past={past} swap={swapIds.has(r.spot.player_id)} />
          ))}
          {open.map((slot, k) => (
            <li key={`open-${slot}-${k}`} className="mp-row mp-idle mp-empty">
              <Mark state="idle" />
              <span className="mp-slot">{slot}</span>
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
            <Row key={r.spot.player_id} row={r} past={past} swap={swapIds.has(r.spot.player_id)} />
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
                <Row key={r.spot.player_id} row={r} past={past} swap={false} />
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

function Mark({ state }: { state: RowState }) {
  return (
    <span className={`mp-mark ${state}`}>
      {state === 'live' ? (
        <i className="mp-dot" aria-hidden="true" />
      ) : state === 'final' || state === 'dnp' ? (
        <CheckCircle size={18} weight="fill" aria-hidden="true" />
      ) : state === 'later' ? (
        <Clock size={18} aria-hidden="true" />
      ) : (
        <Minus size={18} aria-hidden="true" />
      )}
      <span className="sr-only">{STATE_WORD[state]}</span>
    </span>
  )
}

function Row({ row, past, swap }: { row: PlayerRow; past: boolean; swap: boolean }) {
  const [open, setOpen] = useState(false)
  const { spot, game, line, state } = row
  const abbrev = nbaAbbrev(spot.pro_team_id)
  const counted = spot.starting
  const injured = spot.injury_status !== 'ACTIVE' && spot.injury_status !== 'NORMAL'
  const player = { id: spot.player_id, name: spot.name }
  const cls = [
    'mp-row',
    `mp-${state}`,
    counted ? 'mp-starter' : 'mp-sub',
    isIR(spot) ? 'mp-ir' : '',
    swap ? 'mp-swap' : '',
    open ? 'open' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <li className={cls}>
      <Mark state={isIR(spot) ? 'idle' : state} />
      <span className={`mp-slot${counted ? '' : ' sub'}`}>{spot.slot}</span>
      <span className="mp-who">
        <PlayerLink player={player} decorative>
          <PlayerHead player={player} size={32} team={abbrev} />
        </PlayerLink>
        <span className="mp-name">
          <PlayerLink
            player={player}
            after={injured ? <span className={`mp-inj${spot.injury_status === 'OUT' ? ' out' : ''}`}>{injuryShort(spot.injury_status)}</span> : undefined}
          />
          {line && !counted && <span className="mp-nocount">{past ? "Didn't count" : "Doesn't count"}</span>}
        </span>
      </span>
      <GameCell game={game} />
      {line ? (
        <>
          <Stats line={line} />
          <span className="mp-brief small">{brief(line)}</span>
          {state === 'final' && (
            <button
              type="button"
              className="mp-fold"
              aria-expanded={open}
              aria-label={open ? `Hide ${spot.name}'s line` : `Show ${spot.name}'s line`}
              onClick={() => setOpen(!open)}
            >
              <CaretDown size={16} aria-hidden="true" />
            </button>
          )}
        </>
      ) : (
        <span className="mp-note">{quietNote(row, past)}</span>
      )}
    </li>
  )
}

function quietNote(row: PlayerRow, past: boolean): ReactNode {
  const { spot, state, game } = row
  if (isIR(spot))
    return (
      <>
        Injured reserve<span className="mp-long"> · never counts</span>
      </>
    )
  if (state === 'later')
    return (
      <>
        <span className="mp-long">Not started · tips </span>
        <span className="num">{game ? tipOff(game.start) : ''}</span>
      </>
    )
  if (state === 'live') return 'Not in yet'
  if (state === 'dnp') return "Didn't play"
  if (state === 'idle' && spot.starting)
    return (
      <>
        <b className="mp-long">Slot idle</b>
        <b className="mp-short">Idle</b>
        <span className="mp-long"> · counts for nothing {past ? 'that day' : 'tonight'}</span>
      </>
    )
  return ''
}

function GameCell({ game }: { game: Game | null }) {
  if (!game) return <span className="mp-game muted">No game</span>
  const scheduled = game.status === 'scheduled'
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
          <span className="muted">Final</span>
        )}
      </span>
    </span>
  )
}

function Stats({ line }: { line: GameLine }) {
  const cells: [string, ReactNode][] = [
    ['MIN', line.minutes],
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
  return <StatCells cells={cells} />
}

function StatCells({ cells }: { cells: [string, ReactNode][] }) {
  return (
    <dl className="mp-stats">
      {cells.map(([k, v]) => (
        <div key={k} className={`mp-stat${k === 'PTS' ? ' pts' : ''}${k === 'MIN' ? ' min' : ''}`}>
          <dt>{k === 'TO' ? 'TO↓' : k}</dt>
          <dd className="num">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function TotalsRow({ totals: t, past }: { totals: Totals; past: boolean }) {
  return (
    <div className="mp-totals">
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

/** The folded phone line: "16 PTS · 3 REB · 7 AST · 6/13 FG". */
function brief(l: GameLine): string {
  const parts = [`${l.pts} PTS`]
  if (l.reb) parts.push(`${l.reb} REB`)
  if (l.ast) parts.push(`${l.ast} AST`)
  if (l.tpm) parts.push(`${l.tpm} 3PM`)
  if (l.fga) parts.push(`${l.fgm}/${l.fga} FG`)
  return parts.join(' · ')
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
