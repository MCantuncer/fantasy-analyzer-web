import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bone, ScoresSkeleton } from './Skeleton'
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Television } from '@phosphor-icons/react'
import { fetchScoreGames, fetchScores, fetchScoreSits } from '../api/client'
import type { FixtureDay, Game, GameLine, ScoreDay } from '../api/client'
import type { Credentials } from '../lib/credentials'
import {
  best,
  dayLabel,
  leader,
  longDayLabel,
  myLines,
  nightTotals,
  statLine,
  tipOff,
} from '../lib/scores'
import { HeadStack, PlayerHead, TeamLogo } from './PlayerHead'
import { useFitsWidth } from '../lib/useFitsWidth'
import './Scores.css'
import './ScoresBox.css'
import { BOX_CATS, nextSort, sortLines, splitStarters } from '../lib/boxSort'
import { BenchBreak, StarterNote } from './StartersSplit'
import type { BoxSort } from '../lib/boxSort'
import { ScoresWeek } from './ScoresWeek'
import { PlayerLink } from './PlayerCard'
import { ScoresLens } from './ScoresLens'
import { ShotSplit } from './ShotSplit'
import type { Lens } from './ScoresLens'
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
  const [lens, setLens] = useState<Lens>('all')
  const [picked, setPicked] = useState<number | null>(null)
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
  const full = scores.data && (day === null || scores.data.day === day) && !scores.isPlaceholderData ? scores.data : null
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
    day: shownDay ?? base.day,
    week: base.week.map((d) => ({ ...d, sits: sitsByDay.get(d.day) ?? d.sits })),
  }
  const pickDay = (d: number) => {
    setDay(d)
    setPicked(null)
  }
  const abbrev = new Map(teams.map((t) => [t.id, t.abbrev]))
  const upcoming = new Map((data.week ?? []).flatMap((d) => d.games.map((f) => [f.id, f.my_players] as const)))
  const mineByGame = new Map(data.games.map((g) => [g.id, myPlayersIn(g, teamId, upcoming.get(g.id) ?? [])]))
  const mineGames = data.games.filter((g) => mineByGame.get(g.id)!.length > 0)
  const players = new Set([...mineByGame.values()].flatMap((ps) => ps.map((p) => p.player_id))).size
  // Until the scores are in, who played isn't known: show every game rather than an empty Mine list.
  const games = lens === 'mine' && !pending ? mineGames : data.games
  const selected =
    data.games.find((g) => g.id === picked) ??
    data.games.find((g) => g.status !== 'scheduled' && g.lines.some((l) => l.owner_team_id === teamId)) ??
    data.games.find((g) => g.status !== 'scheduled')

  return (
    <div className={`stack scores${switching ? ' scores-switching' : ''}`} aria-busy={switching || pending}>
      <div className="row scores-bar">
        <DayStrip data={data} onPick={pickDay} />
        <DayJump data={data} onPick={pickDay} />
        <span className="grow" />
        <div className="sl-row">
          <ScoresLens value={lens} onChange={setLens} all={data.games.length} mine={pending ? null : mineGames.length} />
          <p className="sl-summary sl-short">
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
      <p className="sl-summary sl-long">
        {pending ? (
          'Counting your players'
        ) : (
          <GamesSummary lens={lens} all={data.games.length} mine={mineGames.length} players={players} />
        )}
      </p>

      {pending ? (
        <ScoresFilling failed={failed} onRetry={() => scores.refetch()} />
      ) : (
        <YourNight games={data.games} teamId={teamId} matchup={matchup ?? null} abbrev={abbrev} />
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
        <div className="game-grid">
          {games.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              teamId={teamId}
              upcoming={upcoming.get(g.id) ?? []}
              selected={g.id === selected?.id}
              pending={pending}
              onPick={() => setPicked(g.id)}
            />
          ))}
        </div>
      )}

      {data.week && data.week.length > 0 && <ScoresWeek week={data.week} onPick={pickDay} />}

      {selected &&
        (pending ? (
          <BoxScoreFetching game={selected} failed={failed} onRetry={() => scores.refetch()} />
        ) : (
          <BoxScore game={selected} date={data.date} teamId={teamId} abbrev={abbrev} />
        ))}

      <p className="small muted">
        Scores are added up from ESPN's fantasy stats
        {data.live ? ' and refresh every minute' : ''}. ESPN's fantasy data has no quarter or game clock.
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
    </label>
  )
}

function DayStrip({ data, onPick }: { data: ScoreDay; onPick: (day: number) => void }) {
  const i = data.days.findIndex((d) => d.day === data.day)
  const around = data.days.slice(Math.max(0, i - 2), i + 3)
  const prev = data.days[i - 1]
  const next = data.days[i + 1]
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
          aria-label={`${dayLabel(d.date)}, ${d.games} games`}
          onClick={() => onPick(d.day)}
        >
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

function YourNight({
  games,
  teamId,
  matchup,
  abbrev,
}: {
  games: Game[]
  teamId: number
  matchup: TonightMatchup | null
  abbrev: Map<number, string>
}) {
  const t = nightTotals(games, teamId)
  if (t.played === 0) return null
  const o = matchup ? nightTotals(games, matchup.opponentId) : null
  const lines = myLines(games, teamId)
  const top = best(lines)
  const pct = (m: number, a: number) => (a ? m / a : 0)
  const n = (v: number) => String(v)
  const r = (v: number) => (v ? v.toFixed(3).replace(/^0/, '') : '–')
  const cats: Cat[] = [
    ['PTS', t.pts, o?.pts ?? null, n],
    ['REB', t.reb, o?.reb ?? null, n],
    ['AST', t.ast, o?.ast ?? null, n],
    ['STL', t.stl, o?.stl ?? null, n],
    ['BLK', t.blk, o?.blk ?? null, n],
    ['3PM', t.tpm, o?.tpm ?? null, n],
    ['TO', t.to, o?.to ?? null, n],
    ['FG%', pct(t.fgm, t.fga), o ? pct(o.fgm, o.fga) : null, r],
    ['FT%', pct(t.ftm, t.fta), o ? pct(o.ftm, o.fta) : null, r],
  ]
  // Only compare once they have played tonight; an empty side isn't a contest.
  const versus = o != null && o.played > 0
  const ahead = (label: string, mine: number, theirs: number | null) =>
    versus && theirs != null && mine !== theirs && (label === 'TO' ? mine < theirs : mine > theirs)
  const live = games.some((g) => g.status === 'live')
  const oppShort = matchup ? (abbrev.get(matchup.opponentId) ?? matchup.opponentName) : ''
  return (
    <section className={`card your-night${matchup ? ' versus' : ''}`} aria-labelledby="night-title">
      <div className="stack night-head">
        <h2 className="night-title" id="night-title">
          <Television size={20} aria-hidden="true" />
          <span>
            {matchup ? 'Tonight in your matchup' : `Your ${live ? 'night so far' : 'night'}`}
            {matchup && <span className="night-vs"> · vs {matchup.opponentName}</span>}
          </span>
        </h2>
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
        <dl className="night-cats" aria-labelledby="night-totals-label">
          {versus && (
            <div className="night-who" aria-hidden="true">
              <dt>&nbsp;</dt>
              <dd>You</dd>
              <dd className="them">{oppShort}</dd>
            </div>
          )}
          {cats.map(([k, mine, theirs, text]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className={`num${ahead(k, mine, theirs) ? ' ahead' : ''}`}>{text(mine)}</dd>
              {versus && theirs != null && (
                <dd className={`num them${ahead(k, theirs, mine) ? ' ahead' : ''}`}>
                  <span className="sr-only">{matchup!.opponentName}: </span>
                  {text(theirs)}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function GameCard({
  game,
  teamId,
  upcoming,
  selected,
  pending = false,
  onPick,
}: {
  game: Game
  teamId: number
  /** Your players in this game from the week's fixtures, for games that haven't started. */
  upcoming: FixturePlayer[]
  selected: boolean
  /** The scores are still on their way: started games show a soft pulse where the numbers go. */
  pending?: boolean
  onPick: () => void
}) {
  const scheduled = game.status === 'scheduled'
  const live = game.status === 'live'
  const mine = myPlayersIn(game, teamId, upcoming)
  const lead = leader(game)
  const top = best(game.lines)
  const rostered = game.lines.filter((l) => l.owner_team_id != null).length
  const tipping = live && !game.away.score && !game.home.score
  const className = ['game-card', mine.length ? 'has-mine' : ''].filter(Boolean).join(' ')
  const body = (
    <>
      <span className="game-status">
        {live ? (
          <span className="live-dot">
            <i aria-hidden="true" />
            Live
            {game.clock ? (
              <span className="num game-clock"> · {game.clock}</span>
            ) : (
              tipping && <span className="muted"> · Tip-off</span>
            )}
          </span>
        ) : scheduled ? (
          <span className="num tip">{tipOff(game.start)}</span>
        ) : (
          <span className="muted">Final</span>
        )}
        {mine.length > 0 && (
          <span className="game-mine">
            <HeadStack players={mine.map((p) => ({ id: p.player_id, name: p.name }))} size={22} />
            <span className="sr-only">Your players: {mine.map((p) => p.name).join(', ')}</span>
          </span>
        )}
      </span>
      <TeamRow
        side={game.away}
        state={scheduled ? 'pre' : lead === 'away' ? 'lead' : lead === 'home' ? 'trail' : 'level'}
        filling={pending && !scheduled}
      />
      <TeamRow
        side={game.home}
        state={scheduled ? 'pre' : lead === 'home' ? 'lead' : lead === 'away' ? 'trail' : 'level'}
        filling={pending && !scheduled}
        home
      />
      <span className="game-foot small">
        {pending && !scheduled ? (
          <span className="muted game-foot-text">Fetching the box score</span>
        ) : top && !scheduled ? (
          <>
            <PlayerHead player={{ id: top.player_id, name: top.name }} size={20} />
            <span className="game-foot-text">
              <b>{shortName(top.name)}</b> {statLine(top)}
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
      </span>
    </>
  )
  // A game that hasn't started has no box score to open.
  if (scheduled) return <div className={className}>{body}</div>
  return (
    <button className={className} aria-pressed={selected} onClick={onPick}>
      {body}
    </button>
  )
}

function TeamRow({
  side,
  state,
  home = false,
  filling = false,
}: {
  side: Game['home']
  state: 'lead' | 'trail' | 'level' | 'pre'
  home?: boolean
  /** The score is on its way. */
  filling?: boolean
}) {
  return (
    <span className={`team-row ${state}`}>
      <span className="team-logo-slot">
        <TeamLogo abbrev={side.abbrev} size={28} />
      </span>
      <span className="team-name" title={home ? `${side.name} (home)` : side.name}>
        <b>{side.abbrev}</b>
        <span className="team-nick muted">{nickname(side.name)}</span>
        {home && <span className="sr-only"> (home)</span>}
      </span>
      <span className="num score">
        {filling ? <Bone w={26} h={16} className="sc-score-bone" /> : state === 'pre' ? '' : (side.score ?? '')}
      </span>
    </span>
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

/** A box score opened before its numbers are in: the game's header and a spinner, swapped for the table when ready. */
function BoxScoreFetching({ game, failed, onRetry }: { game: Game; failed: boolean; onRetry: () => void }) {
  return (
    <section className="card flush sc-box-fetching" aria-labelledby="box-title" aria-busy={!failed}>
      <div className="card-head">
        <h2 id="box-title">
          {game.away.abbrev} · {game.home.abbrev}
        </h2>
      </div>
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
    </section>
  )
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="30 20" />
    </svg>
  )
}

/** "Boston Celtics" → "Celtics", "Portland Trail Blazers" → "Trail Blazers". */
function nickname(name: string) {
  const words = name.trim().split(/\s+/)
  if (words.length < 2) return name
  return /trail/i.test(words[words.length - 2]) ? words.slice(-2).join(' ') : words[words.length - 1]
}

function BoxScore({
  game,
  date,
  teamId,
  abbrev,
}: {
  game: Game
  date: string | null | undefined
  teamId: number
  abbrev: Map<number, string>
}) {
  const ref = useRef<HTMLElement>(null)
  const first = useRef(true)
  useEffect(() => {
    // Picking a game scrolls its box score into view; the first render doesn't jump.
    if (first.current) first.current = false
    else ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [game.id])

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
  const row = (l: GameLine) => (
    <BoxRow
      key={l.player_id}
      line={l}
      mine={l.owner_team_id === teamId}
      abbrev={abbrev}
      starter={!split && l.starter}
      team={side.abbrev}
    />
  )
  return (
    <section className="card flush box-card" ref={ref} aria-labelledby="box-title">
      <div className="card-head">
        <h2 id="box-title">
          {game.away.abbrev} <span className="num">{game.away.score ?? ''}</span> · {game.home.abbrev}{' '}
          <span className="num">{game.home.score ?? ''}</span>
        </h2>
        <span className="small muted">
          {game.status === 'live' ? `Live${game.clock ? ` · ${game.clock}` : ''}` : 'Final'} · {dayLabel(date)}. Owner
          is the fantasy team in this league.
        </span>
      </div>
      <div className="segmented sc-team-switch" role="group" aria-label="Team">
        {sides.map((s) => (
          <button
            key={s.pro_team_id}
            type="button"
            aria-pressed={s.pro_team_id === side.pro_team_id}
            onClick={() => setPicked({ game: game.id, team: s.pro_team_id })}
          >
            <TeamLogo abbrev={s.abbrev} size={20} />
            <span className="sc-team-label">{s.name}</span>
          </button>
        ))}
      </div>
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
              <th scope="col" className="left">
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
    </section>
  )
}

function BoxRow({
  line: l,
  mine,
  abbrev,
  starter = false,
  team,
}: {
  line: GameLine
  mine: boolean
  abbrev: Map<number, string>
  /** Marks a starter while a sort has merged the list. */
  starter?: boolean
  team: string
}) {
  const owner = l.owner_team_id == null ? 'FA' : (abbrev.get(l.owner_team_id) ?? '')
  return (
    <tr className={[mine && 'mine', starter && 'sc-starter'].filter(Boolean).join(' ') || undefined}>
      <th scope="row">
        <span className="box-player">
          <PlayerLink player={{ id: l.player_id, name: l.name }} decorative>
            <PlayerHead player={{ id: l.player_id, name: l.name }} size={24} team={starter ? team : undefined} />
          </PlayerLink>
          <PlayerLink player={{ id: l.player_id, name: l.name }} />
          {starter && <StarterNote />}
        </span>
      </th>
      <td className={`left${l.owner_team_id == null ? ' good' : ''}`}>{owner}</td>
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
