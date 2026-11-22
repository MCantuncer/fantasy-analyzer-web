import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bone, ScoresSkeleton } from './Skeleton'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { ArrowDown, ArrowUp, CaretLeft, CaretRight, Television, X } from '@phosphor-icons/react'
import { fetchScoreGames, fetchScores, fetchScoreSits } from '../api/client'
import type { FixtureDay, Game, GameLine, ScoreDay } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { best, dayLabel, leader, longDayLabel, myLines, nickname, nightTotals, statLine, usToday } from '../lib/scores'
import { HeadStack, PlayerHead, TeamLogo } from './PlayerHead'
import { teamColours } from '../lib/league'
import { teamLight } from '../lib/nbaTeams'
import { useFitsWidth } from '../lib/useFitsWidth'
import './Scores.css'
import './ScoresBox.css'
import { BOX_CATS, nextSort, sortLines, splitStarters } from '../lib/boxSort'
import { BenchBreak, StarterNote } from './StartersSplit'
import type { BoxSort } from '../lib/boxSort'
import { ScoresWeek } from './ScoresWeek'
import { Burn, GameTime, emberAttrs, emberOf, useClockTick } from './GameTime'
import { timeLeftLine } from '../lib/gameClock'
import { PlayerLink } from './PlayerCard'
import { ScoresLens } from './ScoresLens'
import { ShotSplit } from './ShotSplit'
import type { Lens } from './ScoresLens'
import { BoxGhost, BoxSlot, type FrontRowIntent } from './ScoresFrontRow'
import { reducedMotion, rowEndOf, tabOrigin, tabStyle } from '../lib/frontRow'
import { useGridColumns } from '../lib/useGridColumns'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useEscapeLayer } from '../lib/escapeStack'
import { CallBand, CallCell, CallLabel, CallNight, CallPlate, CallSentence, CallTotal, CallVerdict } from './OurCall'
import { shortNick } from '../lib/ourCall'
import { PreGameBox } from './PreGameBox'
import { ProCall } from './Pro'
import { useFeature } from '../lib/pro'
type FixturePlayer = FixtureDay['games'][number]['my_players'][number]

interface Props {
  leagueId: number
  season: number
  teamId: number
  teams: { id: number; abbrev: string; name: string }[]
  creds: Credentials | null
  /** This week's opponent, to frame tonight. */
  matchup?: TonightMatchup | null
}

export interface TonightMatchup {
  opponentId: number
  opponentName: string
}

export function Scores({ leagueId, season, teamId, teams, creds, matchup }: Props) {
  const [day, setDay] = useState<number | null>(null)
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const pinned = usePinnedDays(root)
  const [lens, setLens] = useState<Lens>('all')
  // While a game's box score is open the summary line steps aside (Can, 2026-11-22).
  const [boxOpen, setBoxOpen] = useState(false)
  // Our call is Pro: a Free account's games come without it (and an admin's Free preview drops it here).
  const showCalls = useFeature('game_calls')
  const qc = useQueryClient()
  const key = [leagueId, season, day, teamId, creds?.swid ?? null] as const
  // The games come first, straight from the NBA calendar; scores, box scores and who sits fill in after.
  const gamesQ = useQuery({
    queryKey: ['score-games', ...key],
    queryFn: () => fetchScoreGames(leagueId, season, day, teamId, creds),
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
  const scores = useQuery({
    queryKey: ['scores', ...key],
    queryFn: () => fetchScores(leagueId, season, day, teamId, creds),
    retry: 1,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    // While a game is on, follow it; ESPN's numbers move about once a minute.
    refetchInterval: (q) => (q.state.data?.live ? 60_000 : false),
  })
  const sits = useQuery({
    queryKey: ['score-sits', leagueId, season, teamId, creds?.swid ?? null],
    queryFn: () => fetchScoreSits(leagueId, season, teamId, creds),
    retry: false,
    staleTime: 10 * 60_000,
    enabled: teamId > 0,
  })

  // The day the page is on: the one asked for, or the default the server picked.
  const shownDay = day ?? scores.data?.day ?? gamesQ.data?.day ?? null
  const full =
    scores.data && (day === null || scores.data.day === day) && !scores.isPlaceholderData ? scores.data : null
  const quick =
    gamesQ.data && (day === null || gamesQ.data.day === day) && !gamesQ.isPlaceholderData ? gamesQ.data : null
  const current = full ?? quick
  // Changing day keeps the last day on screen, dimmed, until the new one is in.
  const fallback = scores.data ?? gamesQ.data

  // The days either side are one tap away: fetch them quietly once this one is in.
  useEffect(() => {
    if (!full) return
    const i = full.days.findIndex((d) => d.day === full.day)
    for (const d of [full.days[i - 1], full.days[i + 1]]) {
      if (!d) continue
      const k = [leagueId, season, d.day, teamId, creds?.swid ?? null] as const
      qc.prefetchQuery({
        queryKey: ['scores', ...k],
        queryFn: () => fetchScores(leagueId, season, d.day, teamId, creds),
        staleTime: 30_000,
      })
    }
  }, [full, qc, leagueId, season, teamId, creds])

  if (!current && !fallback) {
    if (gamesQ.isLoading || scores.isLoading) return <ScoresSkeleton />
  }
  const base = current ?? fallback
  if (!base) {
    const error = scores.error ?? gamesQ.error
    return (
      <div className="card error stack">
        <h2>Couldn't load the scores</h2>
        <p>{error?.message ?? 'Try again in a minute.'}</p>
        <div className="row">
          <button
            className="secondary"
            onClick={() => {
              gamesQ.refetch()
              scores.refetch()
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const switching = !current
  const pending = !switching && !full && !base.complete
  const failed = pending && scores.isError
  const sitsByDay = new Map((sits.data?.days ?? []).map((d) => [d.day, d.sits]))
  const data: ScoreDay = {
    ...base,
    games: showCalls ? base.games : base.games.map((g) => (g.call ? { ...g, call: null } : g)),
    day: shownDay ?? base.day,
    week: base.week.map((d) => ({ ...d, sits: sitsByDay.get(d.day) ?? d.sits })),
  }
  // A new day starts with nothing open (the board is keyed by day).
  const pickDay = (d: number) => {
    setDay(d)
    // Picked from the pinned strip: the new day starts from its top, not where the last one was read.
    if (pinned && root) {
      const top = root.getBoundingClientRect().top + window.scrollY - topbarHeight() - 16
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
  }
  const abbrev = new Map(teams.map((t) => [t.id, t.abbrev]))
  const upcoming = new Map((data.week ?? []).flatMap((d) => d.games.map((f) => [f.id, f.my_players] as const)))
  const mineByGame = new Map(data.games.map((g) => [g.id, myPlayersIn(g, teamId, upcoming.get(g.id) ?? [])]))
  const mineGames = data.games.filter((g) => mineByGame.get(g.id)!.length > 0)
  const players = new Set([...mineByGame.values()].flatMap((ps) => ps.map((p) => p.player_id))).size
  // Until the scores are in, who played isn't known: show every game rather than an empty Mine list.
  const shown = lens === 'mine' && !pending ? mineGames : data.games
  // Games outside your matchup (started, none of yours or your rival's) move to the end.
  const rivalId = matchup?.opponentId
  // The rival's crest colour lights the Tonight card's far corner and their face rings.
  const rivalColour =
    rivalId != null
      ? teamColours(
          teams.map((t) => t.id),
          teamId,
        ).get(rivalId)
      : undefined
  const cold = (g: Game) =>
    !pending &&
    g.status !== 'scheduled' &&
    mineByGame.get(g.id)!.length === 0 &&
    !g.lines.some((l) => rivalId != null && l.owner_team_id === rivalId)
  const games = [...shown.filter((g) => !cold(g)), ...shown.filter(cold)]

  return (
    <div
      ref={setRoot}
      className={`stack scores${switching ? ' scores-switching' : ''}${pinned ? ' sc-pinned' : ''}`}
      aria-busy={switching || pending}
    >
      <div className="row scores-bar">
        <DayStrip data={data} onPick={pickDay} />
        <DayJump data={data} onPick={pickDay} />
        <span className="grow" />
        <div className="sl-row">
          <ScoresLens
            value={lens}
            onChange={setLens}
            all={data.games.length}
            mine={pending ? null : mineGames.length}
          />
          <p className={`sl-summary sl-short${boxOpen ? ' sl-away' : ''}`} aria-hidden={boxOpen || undefined}>
            {pending ? (
              'Counting your players'
            ) : players ? (
              <>
                <b className="num">{players}</b> {players === 1 ? 'player' : 'players'} in action
              </>
            ) : (
              'No players in action'
            )}
          </p>
        </div>
      </div>
      <p className={`sl-summary sl-long${boxOpen ? ' sl-away' : ''}`} aria-hidden={boxOpen || undefined}>
        {pending ? (
          'Counting your players'
        ) : (
          <GamesSummary lens={lens} all={data.games.length} mine={mineGames.length} players={players} />
        )}
      </p>

      {pending ? (
        <ScoresFilling failed={failed} onRetry={() => scores.refetch()} />
      ) : (
        <YourNight
          games={data.games}
          teamId={teamId}
          matchup={matchup ?? null}
          abbrev={abbrev}
          rival={rivalColour}
          day={dayLabel(data.date)}
        />
      )}

      {games.length === 0 ? (
        <div className="card sl-empty">
          {data.games.length ? (
            <>
              <h2>None of your players play on {longDayLabel(data.date)}</h2>
              <button type="button" className="ghost" onClick={() => setLens('all')}>
                Show all games
              </button>
            </>
          ) : (
            <h2>No games on {longDayLabel(data.date)}</h2>
          )}
        </div>
      ) : (
        <>
          {!pending && (
            <CallNight key={`night-${data.day}`} games={data.games} date={data.date} today={data.date === usToday()} />
          )}
          <GameBoard
            key={data.day}
            leagueId={leagueId}
            season={season}
            creds={creds}
            day={data.day ?? null}
            games={games}
            upcoming={upcoming}
            teamId={teamId}
            rivalId={rivalId ?? null}
            rivalColour={rivalColour}
            abbrev={abbrev}
            date={data.date}
            pending={pending}
            failed={failed}
            onRetry={() => scores.refetch()}
            onOpenChange={setBoxOpen}
          />
        </>
      )}

      {/* The rest of the week sits below tonight's games and box score, not between them. */}
      {data.week && data.week.length > 0 && <ScoresWeek week={data.week} onPick={pickDay} />}

      <p className="small muted">
        Scores are added up from ESPN's fantasy stats
        {data.live ? ' and refresh every minute' : ''}; the game clock comes from ESPN's scoreboard. In a box score,
        Owner is the fantasy team in this league.
      </p>
    </div>
  )
}

/** Your players in a game: box score lines once it starts, the week's fixtures before that. */
function myPlayersIn(game: Game, teamId: number, upcoming: FixturePlayer[]): { player_id: number; name: string }[] {
  const lines = game.lines.filter((l) => l.owner_team_id === teamId)
  if (game.status === 'scheduled' && !lines.length) return upcoming
  return lines.map((l) => ({ player_id: l.player_id, name: l.name }))
}

type Upcoming = Map<number, FixturePlayer[]>
/** A started game opens its box score; one that hasn't, its pre-game box once Our call is in. */
const canOpen = (g: Game) => g.status !== 'scheduled' || g.call != null
const cardOf = (id: number) => document.querySelector<HTMLElement>(`.game-grid [data-game='${id}']`)
const topbarHeight = () => document.querySelector<HTMLElement>('.topbar')?.offsetHeight ?? 0

/**
 * The days stay in reach (Can, 2026-11-17): the day picker pins under the site's top bar while you
 * scroll the games and box scores. On wide screens the whole bar pins (one row); on phones only the
 * date strip does. The page gets --sc-bar (top bar height) and --sc-pin (the pinned part's height),
 * so an open box score's title pins just below it. True while it is pinned.
 */
function usePinnedDays(el: HTMLDivElement | null): boolean {
  const [pinned, setPinned] = useState(false)
  useLayoutEffect(() => {
    const bar = document.querySelector<HTMLElement>('.topbar')
    if (!el) return
    const pin = () =>
      [el.querySelector<HTMLElement>('.scores-bar'), el.querySelector<HTMLElement>('.day-strip')].find(
        (x) => x && getComputedStyle(x).position === 'sticky',
      ) ?? null
    const measure = () => {
      const p = pin()
      el.style.setProperty('--sc-bar', `${bar?.offsetHeight ?? 0}px`)
      el.style.setProperty('--sc-pin', `${p?.offsetHeight ?? 0}px`)
      check()
    }
    const check = () => {
      const p = pin()
      const top = bar?.offsetHeight ?? 0
      // Pinned once the page has scrolled it up to the top bar (a pixel of slack for rounding).
      setPinned(!!p && window.scrollY > 0 && p.getBoundingClientRect().top <= top + 1)
    }
    measure()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (ro) for (const x of [bar, el.querySelector('.scores-bar'), el.querySelector('.day-strip')]) if (x) ro.observe(x)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [el])
  return pinned
}

/**
 * Tonight's games and, once you pick one, its box score in place (Front Row, Can 2026-11-15/16).
 * Nothing is open at first. The game you tap comes forward (bigger, the rest blur) and becomes the tab
 * of its box score, which opens right after the game's row and pushes the rows below down; the page
 * holds the card still, so you are never moved. Another game in the same row slides the tab along;
 * one in another row folds the old box as the new one opens. Close, Esc or the card itself closes it.
 * Phones keep the swipe strip as the row of games, with the box under it.
 */
function GameBoard({
  leagueId,
  season,
  creds,
  day,
  games,
  upcoming,
  teamId,
  rivalId,
  rivalColour,
  abbrev,
  date,
  pending,
  failed,
  onRetry,
  onOpenChange,
}: {
  leagueId: number
  season: number
  creds: Credentials | null
  day: number | null
  games: Game[]
  upcoming: Upcoming
  teamId: number
  rivalId: number | null
  rivalColour?: string
  abbrev: Map<number, string>
  date: string | null | undefined
  pending: boolean
  failed: boolean
  onRetry: () => void
  /** True while a box is open; false as soon as it starts to close, so the summary fades back in step. */
  onOpenChange?: (open: boolean) => void
}) {
  const grid = useRef<HTMLDivElement>(null)
  const cols = useGridColumns(grid)
  const strip = cols === 0
  const [picked, setPicked] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)
  const [ghost, setGhost] = useState<{ after: number; height: number; n: number } | null>(null)
  const intent = useRef<FrontRowIntent | null>(null)
  const clearGhost = useCallback(() => setGhost(null), [])

  const ids = games.map((g) => g.id)
  // The Mine lens can hide the open game: then it is simply closed.
  const open = picked != null ? games.find((g) => g.id === picked && canOpen(g)) : undefined
  useEffect(() => {
    if (picked != null && !open) {
      setPicked(null)
      setClosing(false)
    }
  }, [picked, open])
  const showing = open != null && !closing
  useEffect(() => onOpenChange?.(showing), [showing, onOpenChange])
  // A new day (or an empty Mine list) drops the board: nothing is open any more.
  useEffect(() => () => onOpenChange?.(false), [onOpenChange])

  const rowEnd = open && !strip ? rowEndOf(ids, open.id, cols) : null
  const openable = games.filter(canOpen).map((g) => g.id)
  const at = open ? openable.indexOf(open.id) : -1
  const prev = at > 0 ? games.find((g) => g.id === openable[at - 1]) : undefined
  const next = at >= 0 && at < openable.length - 1 ? games.find((g) => g.id === openable[at + 1]) : undefined

  const close = useCallback(
    (focusCard = true) => {
      if (picked == null || closing) return
      const card = cardOf(picked)
      if (!card) {
        setPicked(null)
        return
      }
      const r = card.getBoundingClientRect()
      const top = topbarHeight()
      // Closed from the pinned bar with the card scrolled away: bring the card back just under the top bar.
      intent.current = {
        kind: 'close',
        anchor: () => cardOf(picked),
        y0: r.top,
        y1: r.bottom < top + 24 ? top + 16 : undefined,
      }
      setClosing(true)
      if (focusCard) card.focus({ preventScroll: true })
    },
    [picked, closing],
  )
  const onClosed = useCallback(() => {
    setPicked(null)
    setClosing(false)
  }, [])

  // Esc closes from anywhere on the page, once whatever opened on top of it (a player card) is closed.
  useEscapeLayer(picked != null, () => close(true))

  /** Opens a game, or moves the box to it. `via` an arrow keeps the box's header still instead of the card. */
  const go = (id: number, opts: { keyboard?: boolean; arrow?: 'prev' | 'next' } = {}) => {
    if (closing) return
    if (picked === id && !opts.arrow) return close(true)
    const card = cardOf(id)
    if (!card) return
    const slot = document.getElementById('box')
    const arrow = opts.arrow && slot ? slot : null
    const anchor = arrow ? () => document.getElementById('box') : () => cardOf(id)
    const y0 = (arrow ?? card).getBoundingClientRect().top
    const focus = opts.arrow ?? (opts.keyboard ? 'title' : null)
    if (strip && opts.arrow) {
      const pad = parseFloat(getComputedStyle(grid.current!).paddingLeft) || 0
      grid.current?.scrollTo({ left: card.offsetLeft - pad, behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
    if (picked == null || !open) {
      intent.current = { kind: 'open', anchor, y0, focus }
      setPicked(id)
      return
    }
    const h0 = slot?.querySelector<HTMLElement>('.sc-panel')?.offsetHeight ?? 0
    if (strip || rowEndOf(ids, id, cols) === rowEndOf(ids, open.id, cols)) {
      intent.current = { kind: 'hop', anchor, y0, h0, focus }
    } else {
      intent.current = { kind: 'open', anchor, y0, focus }
      const after = rowEndOf(ids, open.id, cols)
      if (!reducedMotion() && after != null) setGhost({ after, height: h0, n: Date.now() })
    }
    setPicked(id)
  }

  const hop = (d: 'prev' | 'next') => {
    const t = d === 'prev' ? prev : next
    if (t) go(t.id, { arrow: d })
  }
  const box =
    open &&
    (open.status === 'scheduled' ? (
      <PreGameBox
        key={open.id}
        game={open}
        day={day}
        leagueId={leagueId}
        season={season}
        creds={creds}
        teamId={teamId}
        rivalId={rivalId}
        rivalColour={rivalColour}
        abbrev={abbrev}
        head={(teamSwitch, line) => (
          <BoxTitle
            game={open}
            date={date}
            teamSwitch={teamSwitch}
            pregame={line}
            onClose={() => close(true)}
            onHop={hop}
            hops={[prev, next]}
          />
        )}
      />
    ) : pending ? (
      <BoxScoreFetching
        game={open}
        date={date}
        failed={failed}
        onRetry={onRetry}
        onClose={() => close(true)}
        onHop={(d) => {
          const t = d === 'prev' ? prev : next
          if (t) go(t.id, { arrow: d })
        }}
        hops={[prev, next]}
      />
    ) : (
      <BoxScore
        game={open}
        date={date}
        teamId={teamId}
        rivalId={rivalId}
        rivalColour={rivalColour}
        abbrev={abbrev}
        onClose={() => close(true)}
        onHop={(d) => {
          const t = d === 'prev' ? prev : next
          if (t) go(t.id, { arrow: d })
        }}
        hops={[prev, next]}
      />
    ))
  const slot = (key: string) =>
    open && (
      <BoxSlot
        key={key}
        gameId={open.id}
        card={() => cardOf(open.id)}
        colours={[
          teamLight(open.away.abbrev) ?? 'var(--accent)',
          teamLight(open.home.abbrev) ?? 'var(--accent)',
        ]}
        strip={strip ? grid : null}
        closing={closing}
        onClosed={onClosed}
        intent={intent}
      >
        {box}
      </BoxSlot>
    )

  return (
    <>
      <div
        ref={grid}
        className={`game-grid${open && !closing ? ' has-open' : ''}`}
        style={rivalColour ? ({ '--rival': rivalColour } as CSSProperties) : undefined}
      >
        {games.map((g) => [
          <GameCard
            key={g.id}
            game={g}
            teamId={teamId}
            rivalId={rivalId}
            upcoming={upcoming.get(g.id) ?? []}
            open={g.id === open?.id && !closing}
            origin={tabOrigin(ids, g.id, strip ? 0 : cols)}
            date={date}
            pending={pending}
            onPick={(e) => go(g.id, { keyboard: e.detail === 0 })}
          />,
          g.id === rowEnd && slot(`slot-${g.id}`),
          g.id === ghost?.after && <BoxGhost key={`ghost-${ghost.n}`} height={ghost.height} onDone={clearGhost} />,
        ])}
      </div>
      {strip && slot('slot-strip')}
    </>
  )
}

/** "6 of 15 games · 9 of your players in action" under the bar. */
function GamesSummary({ lens, all, mine, players }: { lens: Lens; all: number; mine: number; players: number }) {
  const games = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`
  const who = players ? `${players} of your players in action` : 'none of your players in action'
  if (mine === all && all > 0) return <>All games include your players · {who}</>
  if (lens === 'mine')
    return (
      <>
        <b className="num">{mine}</b> of {games(all)} · {who}
      </>
    )
  return (
    <>
      All {games(all)} · {who}
    </>
  )
}

/** Any day of the season, for going further back than the strip shows. */
function DayJump({ data, onPick }: { data: ScoreDay; onPick: (day: number) => void }) {
  return (
    <label className="row day-jump">
      <span className="sr-only">Jump to a day</span>
      <select value={data.day} onChange={(e) => onPick(Number(e.target.value))}>
        {data.days.map((d) => (
          <option key={d.day} value={d.day}>
            {longDayLabel(d.date)} · {d.games} {d.games === 1 ? 'game' : 'games'}
          </option>
        ))}
      </select>
      <svg className="day-jump-chevron" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M3.5 5.5 7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      </svg>
    </label>
  )
}

function DayStrip({ data, onPick }: { data: ScoreDay; onPick: (day: number) => void }) {
  const i = data.days.findIndex((d) => d.day === data.day)
  const around = data.days.slice(Math.max(0, i - 2), i + 3)
  const prev = data.days[i - 1]
  const next = data.days[i + 1]
  const today = usToday()
  return (
    <nav className="row day-strip" aria-label="Game days">
      <button
        className="secondary icon-btn"
        disabled={!prev}
        onClick={() => prev && onPick(prev.day)}
        aria-label="Earlier day"
      >
        ‹
      </button>
      {around.map((d) => (
        <button
          key={d.day}
          className="secondary day-chip"
          aria-pressed={d.day === data.day}
          aria-label={`${dayLabel(d.date)}${d.date === today ? ', tonight' : ''}, ${d.games} games`}
          onClick={() => onPick(d.day)}
        >
          {d.date === today && <span className="day-tonight" aria-hidden="true" />}
          <span>{dayLabel(d.date)}</span>
          <span className="muted small tnum">{d.games}</span>
        </button>
      ))}
      <button
        className="secondary icon-btn"
        disabled={!next}
        onClick={() => next && onPick(next.day)}
        aria-label="Later day"
      >
        ›
      </button>
    </nav>
  )
}

type Cat = [label: string, mine: number, theirs: number | null, text: (v: number) => string]
type Res = 'W' | 'L' | 'T'

/**
 * Tonight in your matchup. Game Night: each category says who took it tonight with a W/L letter, and
 * the winner's number lights up (green from the top on your row, coral from the bottom on theirs).
 * The night's category count leads the card ("6-3, Won the night"), your warm light sits in the near
 * corner and your rival's crest colour in the far one. On phones the nine categories are a 3x3 grid.
 */
function YourNight({
  games,
  teamId,
  matchup,
  abbrev,
  rival,
  day,
}: {
  games: Game[]
  teamId: number
  matchup: TonightMatchup | null
  abbrev: Map<number, string>
  rival?: string
  day: string
}) {
  const t = nightTotals(games, teamId)
  if (t.played === 0) return null
  const o = matchup ? nightTotals(games, matchup.opponentId) : null
  const lines = myLines(games, teamId)
  const top = best(lines)
  const pct = (m: number, a: number) => (a ? m / a : 0)
  const n = (v: number) => String(v)
  const r = (v: number) => (v ? v.toFixed(3).replace(/^0/, '') : '–')
  // The site's category order (lib/statOrder): shooting, box stats, then TO and PTS.
  const cats: Cat[] = [
    ['FG%', pct(t.fgm, t.fga), o ? pct(o.fgm, o.fga) : null, r],
    ['FT%', pct(t.ftm, t.fta), o ? pct(o.ftm, o.fta) : null, r],
    ['3PM', t.tpm, o?.tpm ?? null, n],
    ['REB', t.reb, o?.reb ?? null, n],
    ['AST', t.ast, o?.ast ?? null, n],
    ['STL', t.stl, o?.stl ?? null, n],
    ['BLK', t.blk, o?.blk ?? null, n],
    ['TO', t.to, o?.to ?? null, n],
    ['PTS', t.pts, o?.pts ?? null, n],
  ]
  // Only compare once they have played tonight; an empty side isn't a contest.
  const versus = o != null && o.played > 0
  const ahead = (label: string, mine: number, theirs: number | null) =>
    versus && theirs != null && mine !== theirs && (label === 'TO' ? mine < theirs : mine > theirs)
  const result = (label: string, mine: number, theirs: number | null): Res | null =>
    !versus || theirs == null ? null : ahead(label, mine, theirs) ? 'W' : ahead(label, theirs, mine) ? 'L' : 'T'
  const results = cats.map(([k, mine, theirs]) => result(k, mine, theirs))
  const count = (x: Res) => results.filter((v) => v === x).length
  const [w, l, tie] = [count('W'), count('L'), count('T')]
  const live = games.some((g) => g.status === 'live')
  const verdict = w > l ? 'W' : w < l ? 'L' : 'T'
  const verdictText = live
    ? { W: 'Ahead so far', L: 'Behind so far', T: 'Level so far' }[verdict]
    : { W: 'Won the night', L: 'Lost the night', T: 'Split the night' }[verdict]
  const oppShort = matchup ? (abbrev.get(matchup.opponentId) ?? matchup.opponentName) : ''
  const RES_WORD = { W: 'you took it', L: 'they took it', T: 'level' }
  return (
    <section
      className={`card your-night${matchup ? ' versus' : ''}`}
      aria-labelledby="night-title"
      style={rival ? ({ '--rival': rival } as CSSProperties) : undefined}
    >
      <div className="stack night-head">
        <h2 className="night-title" id="night-title">
          <Television size={20} aria-hidden="true" />
          <span>
            {matchup ? 'Tonight in your matchup' : `Your ${live ? 'night so far' : 'night'}`}
            {matchup && <span className="night-vs"> · vs {matchup.opponentName}</span>}
          </span>
        </h2>
        {versus && (
          <p className="night-score">
            <b className="num">{tie ? `${w}-${l}-${tie}` : `${w}-${l}`}</b>
            <span className="night-score-text">
              <span className={`night-verdict ${verdict}`}>{verdictText}</span>
              <span className="small">{day ? `${day} · categories` : 'categories'}</span>
            </span>
          </p>
        )}
        {top && (
          <span className="night-lead">
            <PlayerLink player={{ id: top.player_id, name: top.name }} decorative>
              <PlayerHead player={{ id: top.player_id, name: top.name }} size={36} />
            </PlayerLink>
            <span>
              <PlayerLink player={{ id: top.player_id, name: top.name }} /> led with {statLine(top)}.
            </span>
          </span>
        )}
      </div>
      <div className="night-totals">
        <span className="night-totals-label small muted" id="night-totals-label">
          <HeadStack players={lines.map((l) => ({ id: l.player_id, name: l.name }))} size={22} />
          {t.played === 1 ? 'Your 1 player' : `All ${t.played} of your players combined`}
          {matchup &&
            (versus ? `, against ${o!.played} of theirs` : ` · ${matchup.opponentName} haven't played tonight`)}
        </span>
        <dl className={`night-cats${versus ? ' lit' : ''}`} aria-labelledby="night-totals-label">
          {versus && (
            <div className="night-who" aria-hidden="true">
              <dt>&nbsp;</dt>
              <dd>You</dd>
              <dd className="them">{oppShort}</dd>
            </div>
          )}
          {cats.map(([k, mine, theirs, text], i) => {
            const res = results[i]
            return (
              <div key={k} className={res ? `res-${res}` : undefined}>
                <dt>
                  {k}
                  {res && (
                    <span className={`night-res ${res}`} aria-label={`, ${RES_WORD[res]}`}>
                      {res}
                    </span>
                  )}
                </dt>
                <dd className={`num${ahead(k, mine, theirs) ? ' ahead' : ''}${res === 'W' ? ' won' : ''}`}>
                  {text(mine)}
                </dd>
                {versus && theirs != null && (
                  <dd className={`num them${ahead(k, theirs, mine) ? ' ahead' : ''}${res === 'L' ? ' lost' : ''}`}>
                    <span className="sr-only">{matchup!.opponentName}: </span>
                    {text(theirs)}
                  </dd>
                )}
              </div>
            )
          })}
        </dl>
        {versus && (
          <p className="night-key small muted" aria-hidden="true">
            <span>You · big</span>
            <span>{oppShort} · small</span>
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * One game. Game Night: a game with your players or your rival's lifts off the page, its club logos
 * glow in their team colour and the faces carry a ring (gold yours, rival colour theirs). A finished
 * or live game with neither sits back, flat with grey logos and "Not in your matchup". The winning
 * score gets a small caret.
 */
function GameCard({
  game,
  teamId,
  rivalId = null,
  upcoming,
  open,
  origin,
  date,
  pending = false,
  onPick,
}: {
  game: Game
  teamId: number
  /** This week's opponent, whose players in the game count as a stake too. */
  rivalId?: number | null
  /** Your players in this game from the week's fixtures, for games that haven't started. */
  upcoming: FixturePlayer[]
  /** Its box score is open: the card comes forward and is the box's tab. */
  open: boolean
  /** Where the card grows from when it comes forward (edge cards grow inward). */
  origin: string
  date: string | null | undefined
  /** The scores are still on their way: started games show a soft pulse where the numbers go. */
  pending?: boolean
  onPick: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  const scheduled = game.status === 'scheduled'
  const mine = myPlayersIn(game, teamId, upcoming)
  const lead = leader(game)
  const top = best(game.lines)
  const rostered = game.lines.filter((l) => l.owner_team_id != null).length
  const rivals =
    rivalId == null
      ? []
      : game.lines.filter((l) => l.owner_team_id === rivalId).map((l) => ({ player_id: l.player_id, name: l.name }))
  const known = !scheduled && !pending
  const stake = mine.length > 0 || rivals.length > 0
  const cold = known && !stake
  const final = game.status === 'final'
  const call = game.call ?? null
  const showCalls = useFeature('game_calls')
  const faces = [
    ...mine.map((p) => ({ ...p, side: 'you' as const })),
    ...rivals.map((p) => ({ ...p, side: 'rival' as const })),
  ].slice(0, 3)
  // The open game's edge runs from the away club's light to the home club's.
  const edge = {
    ...tabStyle(origin),
    '--ta': teamLight(game.away.abbrev) ?? 'var(--accent)',
    '--tb': teamLight(game.home.abbrev) ?? 'var(--accent)',
  } as CSSProperties
  const ember = emberOf(game)
  const tick = useClockTick(game.clock)
  const left = game.status === 'live' ? timeLeftLine(ember.clock) : game.status === 'final' ? 'Final' : ''
  const className = [
    'game-card',
    'sc-ember',
    mine.length ? 'has-mine' : '',
    stake ? 'stake' : '',
    cold ? 'cold' : '',
    open ? 'is-tab' : '',
    call ? 'has-call' : '',
    // Room for "Our call · 84%" in the foot: a long top performer keeps one stat.
    call && top && shortName(top.name).length > 10 ? 'one' : '',
    // Two or more faces, or the "Not in your matchup" note: on a narrow card "off by N" drops.
    faces.length > 1 || (cold && faces.length === 0 && rivalId != null) ? 'crowd' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const body = (
    <>
      <Burn />
      {call && <CallPlate />}
      <span className="game-status">
        {final && call ? (
          <span className="gt-called">
            <GameTime game={game} ember={ember} />
            <CallVerdict game={game} />
          </span>
        ) : (
          <GameTime game={game} ember={ember} />
        )}
        {faces.length > 0 ? (
          <span className="game-mine game-faces">
            {faces.map((p) => (
              <span key={p.player_id} className={`face-ring ${p.side}`}>
                <PlayerHead player={{ id: p.player_id, name: p.name }} size={22} />
              </span>
            ))}
            {mine.length > 0 && <span className="sr-only">Your players: {mine.map((p) => p.name).join(', ')}</span>}
            {rivals.length > 0 && (
              <span className="sr-only">. Your opponent's players: {rivals.map((p) => p.name).join(', ')}</span>
            )}
          </span>
        ) : (
          cold && rivalId != null && <span className="game-cold muted">Not in your matchup</span>
        )}
      </span>
      <TeamRow
        side={game.away}
        state={scheduled ? 'pre' : lead === 'away' ? 'lead' : lead === 'home' ? 'trail' : 'level'}
        filling={pending && !scheduled}
        won={final && lead === 'away'}
        call={call}
      />
      <TeamRow
        side={game.home}
        state={scheduled ? 'pre' : lead === 'home' ? 'lead' : lead === 'away' ? 'trail' : 'level'}
        filling={pending && !scheduled}
        won={final && lead === 'home'}
        call={call}
        home
      />
      {call && <CallTotal game={game} />}
      <span className="game-foot small">
        <span className="sc-foot-a">
        {pending && !scheduled ? (
          <span className="muted game-foot-text">Fetching the box score</span>
        ) : top && !scheduled ? (
          <>
            <PlayerHead player={{ id: top.player_id, name: top.name }} size={20} />
            <span className="game-foot-text">
              <b>{shortName(top.name)}</b> <TopStats line={statLine(top)} />
            </span>
            {top.owner_team_id === teamId && <span className="badge badge-you">You</span>}
          </>
        ) : mine.length > 0 ? (
          <span className="game-foot-text">
            {mine.length === 1 ? 'Yours' : `${mine.length} of yours`}: {mine.map((p) => shortName(p.name)).join(', ')}
          </span>
        ) : rostered > 0 ? (
          <span className="muted">{rostered} rostered in your league</span>
        ) : (
          <span className="muted">None of your players</span>
        )}
        {call && <CallLabel call={call} />}
        {scheduled && !call && !showCalls && <ProCall />}
        </span>
        {/* As the open box's tab, the foot reads like the box head: time left and the day. */}
        <span className="sc-foot-b" aria-hidden="true">
          {left && (
            <>
              {left}
              <i />
            </>
          )}
          {dayLabel(date)}
        </span>
      </span>
      <CallSentence game={game} />
    </>
  )
  // A game that hasn't started opens its pre-game box once Our call is in; before that there's nothing to open.
  if (scheduled && !call)
    return (
      <div className={className} data-game={game.id} {...emberAttrs(ember, tabStyle(origin))}>
        {body}
      </div>
    )
  return (
    <button
      className={className}
      data-game={game.id}
      aria-expanded={open}
      aria-controls={open ? 'box' : undefined}
      onClick={onPick}
      {...emberAttrs(ember, edge, tick)}
    >
      {body}
    </button>
  )
}

function TeamRow({
  side,
  state,
  home = false,
  filling = false,
  won = false,
  call = null,
}: {
  side: Game['home']
  state: 'lead' | 'trail' | 'level' | 'pre'
  home?: boolean
  /** The score is on its way. */
  filling?: boolean
  /** The final winner: a small caret after the score. */
  won?: boolean
  /** Our call for the game: this side's figure in a fourth column. */
  call?: Game['call']
}) {
  return (
    <span className={`team-row ${state}`}>
      <span className="team-logo-slot">
        <TeamLogo abbrev={side.abbrev} size={28} />
      </span>
      <span className="team-name" title={home ? `${side.name} (home)` : side.name}>
        <b>{side.abbrev}</b>
        <span className="team-nick muted">{shortNick(nickname(side.name))}</span>
        {home && <span className="sr-only"> (home)</span>}
      </span>
      <span className="num score">
        {filling ? <Bone w={26} h={16} className="sc-score-bone" /> : state === 'pre' ? '' : (side.score ?? '')}
        {won && (
          <svg className="win-caret" viewBox="0 0 6 8" width="6" height="8" aria-label=", won">
            <path d="M6 0v8L0 4z" />
          </svg>
        )}
      </span>
      {call && <CallCell call={call} side={home ? 'home' : 'away'} />}
    </span>
  )
}

/** "34 pts, 9 ast": the stats after the first can drop on a narrow card with our call in the foot. */
function TopStats({ line }: { line: string }) {
  const at = line.indexOf(', ')
  if (at < 0) return <>{line}</>
  return (
    <>
      {line.slice(0, at)}
      <span className="s2">{line.slice(at)}</span>
    </>
  )
}

/** Scores are on their way: a quiet line where "Your night" will be. */
function ScoresFilling({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <p className="sc-filling small muted" role="status">
      {failed ? (
        <>
          Couldn't fetch the scores.{' '}
          <button type="button" className="ghost sc-retry" onClick={onRetry}>
            Try again
          </button>
        </>
      ) : (
        <>
          <Spinner />
          Fetching the scores
        </>
      )}
    </p>
  )
}

type Hop = 'prev' | 'next'
interface BoxNav {
  onClose: () => void
  onHop: (dir: Hop) => void
  /** The games either side of this one (games that open, in the grid's order). */
  hops: [Game | undefined, Game | undefined]
}

/**
 * The open box's title line: "Box score · Lakers at Suns", the team switch, the arrows to the games
 * either side, and Close (Esc). It pins under the top bar while you read; once the tab (which carries
 * the score) has scrolled away, it shows the score and clock in its place. On phones it always shows
 * the score, with the clock line under it, and the team switch drops to its own row.
 */
function BoxTitle({
  game,
  date,
  teamSwitch,
  onClose,
  onHop,
  hops,
  pregame,
}: BoxNav & {
  game: Game
  date: string | null | undefined
  teamSwitch?: (short: boolean) => ReactNode
  /** Before tip-off: the countdown and lineup-news line, and the title reads "Pre-game box". */
  pregame?: ReactNode
}) {
  const ember = emberOf(game)
  const phone = useMediaQuery('(max-width: 640px)')
  const narrow = useMediaQuery('(max-width: 1060px)')
  const ref = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    let raf = 0
    const check = () => {
      raf = 0
      const el = ref.current
      if (!el) return
      const top = topbarHeight()
      setStuck(el.getBoundingClientRect().top <= top + 0.5 && (el.parentElement?.getBoundingClientRect().top ?? 0) < top - 1)
      const card = cardOf(game.id)
      setGone(!!card && card.getBoundingClientRect().bottom < top + 24)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check)
    }
    check()
    addEventListener('scroll', onScroll, { passive: true })
    return () => {
      removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [game.id])
  const a = game.away.score ?? 0
  const h = game.home.score ?? 0
  const started = game.status !== 'scheduled'
  const left = game.status === 'live' ? timeLeftLine(ember.clock) : ''
  const name = (g: Game | undefined) => (g ? `${g.away.abbrev} at ${g.home.abbrev}` : '')
  return (
    <>
      <div
        ref={ref}
        className={`sc-bp-title${stuck ? ' stuck' : ''}${gone ? ' show-score' : ''}${pregame ? ' sc-bp-pre' : ''}`}
      >
        <h2 id="box-title" tabIndex={-1}>
          <span className="sc-bt-label" aria-hidden="true">
            {pregame ? 'Pre-game box' : 'Box score'}
            <span className="sc-bt-dot">·</span>
            <span className="sc-bt-sub">
              {nickname(game.away.name)} at {nickname(game.home.name)}
            </span>
          </span>
          <span className="sc-bt-score" aria-hidden="true">
            <span className={`sc-bt-side${started && a < h ? ' trail' : ''}`}>
              <span className="sc-bt-abbr">{game.away.abbrev}</span>
              <span className="num sc-bt-pts">{game.away.score ?? ''}</span>
            </span>
            <span className={`sc-bt-side${started && h < a ? ' trail' : ''}`}>
              <span className="sc-bt-abbr">{game.home.abbrev}</span>
              <span className="num sc-bt-pts">{game.home.score ?? ''}</span>
            </span>
            <span className="sc-bt-time">
              <GameTime game={game} ember={ember} />
            </span>
          </span>
          <span className="sr-only">
            {pregame ? (
              <>
                Pre-game box: {game.away.name} at {game.home.name}
              </>
            ) : (
              <>
                Box score: {game.away.name} {game.away.score ?? ''}, {game.home.name} {game.home.score ?? ''}
                {left ? `, ${left}` : ''}
              </>
            )}
          </span>
        </h2>
        {pregame ? (
          // Before tip-off: the tip time (on wide screens), the countdown and the lineup-news window.
          <span className="sc-bt-line">
            {!phone && (
              <>
                <GameTime game={game} ember={ember} />
                <i />
              </>
            )}
            {pregame}
          </span>
        ) : (
          <span className="sc-bt-line" aria-hidden="true">
            <GameTime game={game} ember={ember} />
            {left && (
              <>
                <i />
                {left}
              </>
            )}
            <i />
            {dayLabel(date)}
          </span>
        )}
        {!phone && teamSwitch?.(narrow)}
        <div className="sc-tools">
          {(['prev', 'next'] as const).map((d, i) => (
            <button
              key={d}
              type="button"
              className="sc-hop"
              data-hop={d}
              disabled={!hops[i]}
              aria-label={`${d === 'prev' ? 'Previous' : 'Next'} game${hops[i] ? `: ${name(hops[i])}` : ''}`}
              title={name(hops[i])}
              onClick={() => onHop(d)}
            >
              {d === 'prev' ? <CaretLeft size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
            </button>
          ))}
          <button
            type="button"
            className="sc-close"
            aria-label={pregame ? 'Close pre-game box' : 'Close box score'}
            aria-keyshortcuts="Escape"
            onClick={onClose}
          >
            <X size={16} weight="bold" aria-hidden="true" />
            <span className="sc-close-label">Close</span>
            <kbd>Esc</kbd>
          </button>
        </div>
      </div>
      {phone && teamSwitch && <div className="sc-switch-row">{teamSwitch(true)}</div>}
    </>
  )
}

/** A box score opened before its numbers are in: the game's header and a spinner, swapped for the table when ready. */
function BoxScoreFetching({
  game,
  date,
  failed,
  onRetry,
  ...nav
}: BoxNav & {
  game: Game
  date: string | null | undefined
  failed: boolean
  onRetry: () => void
}) {
  return (
    <div className="sc-box sc-box-fetching" aria-busy={!failed}>
      <BoxTitle game={game} date={date} {...nav} />
      <div className="sc-box-wait" role="status">
        {failed ? (
          <>
            <span>Couldn't fetch the box score.</span>
            <button type="button" className="secondary" onClick={onRetry}>
              Try again
            </button>
          </>
        ) : (
          <>
            <Spinner size={22} />
            <span>Fetching box score</span>
          </>
        )}
      </div>
    </div>
  )
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="30 20" />
    </svg>
  )
}

function BoxScore({
  game,
  date,
  teamId,
  rivalId = null,
  rivalColour,
  abbrev,
  ...nav
}: BoxNav & {
  game: Game
  date: string | null | undefined
  teamId: number
  /** This week's opponent: their players' rows get an edge in the rival's crest colour. */
  rivalId?: number | null
  rivalColour?: string
  abbrev: Map<number, string>
}) {
  // It opens in place under its game, so it never scrolls the page (Front Row).
  // The header row stays in view while you scroll down the players. A table that fits sticks
  // under the top bar; one too wide for the card scrolls in a window-tall box of its own.
  const wrap = useRef<HTMLDivElement>(null)
  const fits = useFitsWidth(wrap)

  // Tapping a category sorts the team's players by it and lights that column. Columns 1-3 are Player, Owner and Min; the categories follow.
  const [sort, setSort] = useState<BoxSort>(null)
  const col = sort ? BOX_CATS.findIndex((c) => c.key === sort.cat) + 4 : undefined

  // One team at a time keeps the box score short (Can, 2026-11-06). It opens on the team with more
  // of your players (the away team on a tie) and keeps your pick until another game is opened.
  const sides = [game.away, game.home]
  const mineOn = (side: Game['away']) =>
    game.lines.filter((l) => l.pro_team_id === side.pro_team_id && l.owner_team_id === teamId).length
  const opening = mineOn(game.home) > mineOn(game.away) ? game.home : game.away
  const [picked, setPicked] = useState<{ game: number; team: number } | null>(null)
  const side = sides.find((s) => picked?.game === game.id && s.pro_team_id === picked.team) ?? opening
  const fa = best(game.lines.filter((l) => l.owner_team_id == null))
  // No sort: the starting five, a break, then the bench (Can, 2026-11-06). A sort ranks the whole team.
  const teamLines = game.lines.filter((l) => l.pro_team_id === side.pro_team_id)
  const split = splitStarters(teamLines, sort)
  // Sorted, the five lose their block, so each keeps his face lit by the team's colour.
  // Your and your rival's abbreviations size the dot box, so both dots line up hugging the wider name.
  const marked = [teamId, rivalId].flatMap((id) => (id != null && abbrev.has(id) ? [abbrev.get(id)!] : []))
  // Desktop: in the title line. Phones: its own row. Narrow screens use the clubs' nicknames.
  const teamSwitch = (short: boolean) => (
    <div className="segmented sc-team-switch" role="group" aria-label="Team">
      {sides.map((s) => (
        <button
          key={s.pro_team_id}
          type="button"
          aria-pressed={s.pro_team_id === side.pro_team_id}
          onClick={() => setPicked({ game: game.id, team: s.pro_team_id })}
          style={{ '--tl': teamLight(s.abbrev) ?? 'var(--accent)' } as CSSProperties}
        >
          <TeamLogo abbrev={s.abbrev} size={20} />
          <span className="sc-team-label">{short ? nickname(s.name) : s.name}</span>
        </button>
      ))}
    </div>
  )
  const row = (l: GameLine) => (
    <BoxRow
      key={l.player_id}
      line={l}
      mine={l.owner_team_id === teamId}
      rival={rivalId != null && l.owner_team_id === rivalId}
      abbrev={abbrev}
      marked={marked}
      starter={!split && l.starter}
      team={side.abbrev}
    />
  )
  return (
    <div className="sc-box box-card" style={rivalColour ? ({ '--rival': rivalColour } as CSSProperties) : undefined}>
      <BoxTitle game={game} date={date} teamSwitch={teamSwitch} {...nav} />
      <CallBand game={game} />
      <div
        ref={wrap}
        className={`table-wrap box-scroll${fits ? ' fits' : ''}`}
        {...(fits ? {} : { tabIndex: 0, role: 'region', 'aria-label': 'Box score' })}
      >
        <table className="box" data-col={col}>
          <thead>
            <tr>
              <th scope="col" className="left">
                PLAYER
              </th>
              <th scope="col" className="left" title="The fantasy team in this league that owns him">
                OWNER
              </th>
              <th scope="col">MIN</th>
              {BOX_CATS.map((c) => {
                const on = sort?.cat === c.key ? sort : null
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={on ? (on.dir === 'desc' ? 'descending' : 'ascending') : undefined}
                  >
                    <button
                      type="button"
                      className="sc-key"
                      title={`Sort by ${c.name}`}
                      onClick={() => setSort((s) => nextSort(s, c.key))}
                    >
                      {c.label}
                      {on &&
                        (on.dir === 'desc' ? (
                          <ArrowDown className="sc-dir" size={10} weight="bold" aria-hidden />
                        ) : (
                          <ArrowUp className="sc-dir" size={10} weight="bold" aria-hidden />
                        ))}
                      <span className="sc-caret" aria-hidden="true" />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          {split ? (
            <>
              <tbody key={`${side.pro_team_id}-starters`} className="sc-starters">
                {split.starters.map(row)}
              </tbody>
              <tbody key={`${side.pro_team_id}-bench`} className="sc-bench">
                <BenchBreak count={split.bench.length} abbrev={side.abbrev} />
                {split.bench.map(row)}
              </tbody>
            </>
          ) : (
            <tbody key={side.pro_team_id}>{sortLines(teamLines, sort).map(row)}</tbody>
          )}
        </table>
      </div>
      {fa && (
        <p className="small muted box-foot">
          Best free agent in this game:{' '}
          <strong>
            <PlayerLink player={{ id: fa.player_id, name: fa.name }} />
          </strong>
          , {statLine(fa)} ({fa.fgm}/{fa.fga} FG).
        </p>
      )}
    </div>
  )
}

function BoxRow({
  line: l,
  mine,
  rival = false,
  abbrev,
  marked,
  starter = false,
  team,
}: {
  line: GameLine
  mine: boolean
  /** One of this week's opponent's players. */
  rival?: boolean
  abbrev: Map<number, string>
  /** Your and your rival's abbreviations: they size the dot box so the dots line up. */
  marked: string[]
  /** Marks a starter while a sort has merged the list. */
  starter?: boolean
  team: string
}) {
  const owner = l.owner_team_id == null ? 'FA' : (abbrev.get(l.owner_team_id) ?? '')
  return (
    <tr className={[mine && 'mine', rival && 'rival', starter && 'sc-starter'].filter(Boolean).join(' ') || undefined}>
      <th scope="row">
        <span className="box-player">
          <PlayerLink player={{ id: l.player_id, name: l.name }} decorative>
            <PlayerHead player={{ id: l.player_id, name: l.name }} size={24} team={starter ? team : undefined} />
          </PlayerLink>
          <PlayerLink player={{ id: l.player_id, name: l.name }} />
          {starter && <StarterNote />}
        </span>
      </th>
      <td className="left sc-owner">
        {mine || rival ? (
          // Your and your rival's abbreviations are stacked invisibly under the name, so the box is as wide as
          // the wider of the two and the dot at its top right lands in the same spot on every marked row.
          <span className="sc-owner-name">
            <span className="sc-owner-text">{owner}</span>
            {[...new Set(marked)].map((a) => (
              <span key={a} className="sc-owner-sizer" aria-hidden="true">
                {a}
              </span>
            ))}
            <span className={`sc-owner-dot ${mine ? 'you' : 'rival'}`} aria-hidden="true" />
          </span>
        ) : (
          owner
        )}
        {mine && <span className="sr-only"> (you)</span>}
        {rival && <span className="sr-only"> (your opponent)</span>}
      </td>
      <td className="muted">{l.minutes}</td>
      {BOX_CATS.map(({ key }) =>
        key === 'fg' || key === 'ft' ? (
          <td key={key} className="shot-cell">
            <ShotSplit
              made={key === 'fg' ? l.fgm : l.ftm}
              attempts={key === 'fg' ? l.fga : l.fta}
              label={key === 'fg' ? 'FG' : 'FT'}
            />
          </td>
        ) : (
          <td key={key}>{key === 'pts' ? <strong>{l.pts}</strong> : l[key]}</td>
        ),
      )}
    </tr>
  )
}

function shortName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}
