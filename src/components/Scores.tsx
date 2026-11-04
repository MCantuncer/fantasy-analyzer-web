import { useQuery } from '@tanstack/react-query'
import { ScoresSkeleton } from './Skeleton'
import { useEffect, useRef, useState } from 'react'
import { fetchScores } from '../api/client'
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
import './Scores.css'
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
  const scores = useQuery({
    queryKey: ['scores', leagueId, season, day, teamId, creds?.swid ?? null],
    queryFn: () => fetchScores(leagueId, season, day, teamId, creds),
    retry: false,
    staleTime: 30_000,
    // While a game is on, follow it; ESPN's numbers move about once a minute.
    refetchInterval: (q) => (q.state.data?.live ? 60_000 : false),
  })

  if (scores.isLoading) return <ScoresSkeleton />
  if (scores.error || !scores.data) {
    return (
      <div className="card error stack">
        <h2>Couldn't load the scores</h2>
        <p>{scores.error?.message ?? 'Try again in a minute.'}</p>
        <div className="row">
          <button className="secondary" onClick={() => scores.refetch()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  const data = scores.data
  const pickDay = (d: number) => {
    setDay(d)
    setPicked(null)
  }
  const abbrev = new Map(teams.map((t) => [t.id, t.abbrev]))
  const upcoming = new Map((data.week ?? []).flatMap((d) => d.games.map((f) => [f.id, f.my_players] as const)))
  const mineByGame = new Map(data.games.map((g) => [g.id, myPlayersIn(g, teamId, upcoming.get(g.id) ?? [])]))
  const mineGames = data.games.filter((g) => mineByGame.get(g.id)!.length > 0)
  const players = new Set([...mineByGame.values()].flatMap((ps) => ps.map((p) => p.player_id))).size
  const games = lens === 'mine' ? mineGames : data.games
  const selected =
    data.games.find((g) => g.id === picked) ??
    data.games.find((g) => g.status !== 'scheduled' && g.lines.some((l) => l.owner_team_id === teamId)) ??
    data.games.find((g) => g.status !== 'scheduled')

  return (
    <div className="stack scores">
      <div className="row scores-bar">
        <DayStrip data={data} onPick={pickDay} />
        <DayJump data={data} onPick={pickDay} />
        <span className="grow" />
        <div className="sl-row">
          <ScoresLens value={lens} onChange={setLens} all={data.games.length} mine={mineGames.length} />
          <p className="sl-summary sl-short">
            {players ? (
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
        <GamesSummary lens={lens} all={data.games.length} mine={mineGames.length} players={players} />
      </p>

      <YourNight games={data.games} teamId={teamId} matchup={matchup ?? null} abbrev={abbrev} />

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
              onPick={() => setPicked(g.id)}
            />
          ))}
        </div>
      )}

      {data.week && data.week.length > 0 && <ScoresWeek week={data.week} onPick={pickDay} />}

      {selected && <BoxScore game={selected} date={data.date} teamId={teamId} abbrev={abbrev} />}

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
        <span className="eyebrow" id="night-title">
          {matchup ? `Tonight in your matchup · vs ${matchup.opponentName}` : `Your ${live ? 'night so far' : 'night'}`}
        </span>
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
  onPick,
}: {
  game: Game
  teamId: number
  /** Your players in this game from the week's fixtures, for games that haven't started. */
  upcoming: FixturePlayer[]
  selected: boolean
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
      />
      <TeamRow
        side={game.home}
        state={scheduled ? 'pre' : lead === 'home' ? 'lead' : lead === 'away' ? 'trail' : 'level'}
        home
      />
      <span className="game-foot small">
        {top && !scheduled ? (
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
}: {
  side: Game['home']
  state: 'lead' | 'trail' | 'level' | 'pre'
  home?: boolean
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
      <span className="num score">{state === 'pre' ? '' : (side.score ?? '')}</span>
    </span>
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

  const sides = [game.away, game.home]
  const fa = best(game.lines.filter((l) => l.owner_team_id == null))
  return (
    <section className="card flush" ref={ref} aria-labelledby="box-title">
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
      <div className="table-wrap">
        <table className="box">
          <thead>
            <tr>
              <th className="left">Player</th>
              <th className="left">Owner</th>
              <th>Min</th>
              <th>Pts</th>
              <th>Reb</th>
              <th>Ast</th>
              <th>Stl</th>
              <th>Blk</th>
              <th>3PM</th>
              <th>TO</th>
              <th>FG</th>
              <th>FT</th>
            </tr>
          </thead>
          {sides.map((side) => (
            <tbody key={side.pro_team_id}>
              <tr className="box-team">
                <th className="left" colSpan={12} scope="rowgroup">
                  {side.name}
                </th>
              </tr>
              {game.lines
                .filter((l) => l.pro_team_id === side.pro_team_id)
                .map((l) => (
                  <BoxRow key={l.player_id} line={l} mine={l.owner_team_id === teamId} abbrev={abbrev} />
                ))}
            </tbody>
          ))}
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

function BoxRow({ line: l, mine, abbrev }: { line: GameLine; mine: boolean; abbrev: Map<number, string> }) {
  const owner = l.owner_team_id == null ? 'FA' : (abbrev.get(l.owner_team_id) ?? '')
  return (
    <tr className={mine ? 'mine' : undefined}>
      <th scope="row">
        <span className="box-player">
          <PlayerLink player={{ id: l.player_id, name: l.name }} decorative>
            <PlayerHead player={{ id: l.player_id, name: l.name }} size={24} />
          </PlayerLink>
          <PlayerLink player={{ id: l.player_id, name: l.name }} />
        </span>
      </th>
      <td className={`left${l.owner_team_id == null ? ' good' : ''}`}>{owner}</td>
      <td className="muted">{l.minutes}</td>
      <td>
        <strong>{l.pts}</strong>
      </td>
      <td>{l.reb}</td>
      <td>{l.ast}</td>
      <td>{l.stl}</td>
      <td>{l.blk}</td>
      <td>{l.tpm}</td>
      <td>{l.to}</td>
      <td className="shot-cell">
        <ShotSplit made={l.fgm} attempts={l.fga} label="FG" />
      </td>
      <td className="shot-cell">
        <ShotSplit made={l.ftm} attempts={l.fta} label="FT" />
      </td>
    </tr>
  )
}

function shortName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}
