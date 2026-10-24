import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { fetchScores } from '../api/client'
import type { FixtureDay, Game, GameLine, ScoreDay } from '../api/client'
import type { Credentials } from '../lib/credentials'
import {
  best,
  dayLabel,
  gamesLeft,
  isOut,
  longDayLabel,
  myLines,
  nightTotals,
  ratio,
  statLine,
  tipOff,
  winner,
} from '../lib/scores'

interface Props {
  leagueId: number
  season: number
  teamId: number
  teams: { id: number; abbrev: string; name: string }[]
  creds: Credentials | null
}

export function Scores({ leagueId, season, teamId, teams, creds }: Props) {
  const [day, setDay] = useState<number | null>(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const scores = useQuery({
    queryKey: ['scores', leagueId, season, day, teamId, creds?.swid ?? null],
    queryFn: () => fetchScores(leagueId, season, day, teamId, creds),
    retry: false,
    staleTime: 30_000,
    // While a game is on, follow it; ESPN's numbers move about once a minute.
    refetchInterval: (q) => (q.state.data?.live ? 60_000 : false),
  })

  if (scores.isLoading) {
    return (
      <section className="card" aria-busy="true">
        <p className="muted">Loading the scoreboard…</p>
      </section>
    )
  }
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
  const games = onlyMine ? data.games.filter((g) => g.lines.some((l) => l.owner_team_id === teamId)) : data.games
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
        <label className="row">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Only games with my players
        </label>
      </div>

      <YourNight games={data.games} teamId={teamId} />

      {games.length === 0 ? (
        <p className="card muted">None of your players play this day.</p>
      ) : (
        <div className="game-grid">
          {games.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              teamId={teamId}
              selected={g.id === selected?.id}
              onPick={() => setPicked(g.id)}
            />
          ))}
        </div>
      )}

      {data.week && data.week.length > 0 && <ThisWeek week={data.week} onPick={pickDay} />}

      {selected && <BoxScore game={selected} date={data.date} teamId={teamId} abbrev={abbrev} />}

      <p className="small muted">
        Scores are added up from ESPN's fantasy stats{data.live ? ' and refresh every minute' : ''}. ESPN's fantasy data
        has no quarter or game clock.
      </p>
    </div>
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

function ThisWeek({ week, onPick }: { week: FixtureDay[]; onPick: (day: number) => void }) {
  const left = gamesLeft(week)
  return (
    <section className="card flush" aria-labelledby="week-title">
      <div className="card-head">
        <h2 id="week-title">Still to play this week</h2>
        <span className="small muted">
          Your players have <strong className="tnum">{left}</strong> {left === 1 ? 'game' : 'games'} left before Monday.
          Days are US game dates; times are yours.
        </span>
      </div>
      <ol className="week-list">
        {week.map((d) => (
          <li key={d.day}>
            <button className="link week-day" onClick={() => onPick(d.day)}>
              {longDayLabel(d.date)} · {d.games.length} {d.games.length === 1 ? 'game' : 'games'}
            </button>
            <ul>
              {d.games.map((g) => (
                <li key={g.id} className="fixture">
                  <span className="num fixture-time">{tipOff(g.start)}</span>
                  <span className="fixture-teams">
                    {g.away.abbrev} @ {g.home.abbrev}
                  </span>
                  {g.my_players.length > 0 && (
                    <span className="fixture-mine">
                      {g.my_players.map((p, i) => (
                        <span key={p.player_id} className={isOut(p.injury_status) ? 'muted' : undefined}>
                          {i > 0 && ', '}
                          {shortName(p.name)}
                          {isOut(p.injury_status) && ' (out)'}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
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

function YourNight({ games, teamId }: { games: Game[]; teamId: number }) {
  const t = nightTotals(games, teamId)
  if (t.played === 0) return null
  const top = best(myLines(games, teamId))
  const cats: [string, string][] = [
    ['PTS', String(t.pts)],
    ['REB', String(t.reb)],
    ['AST', String(t.ast)],
    ['STL', String(t.stl)],
    ['BLK', String(t.blk)],
    ['3PM', String(t.tpm)],
    ['TO', String(t.to)],
    ['FG%', ratio(t.fgm, t.fga)],
    ['FT%', ratio(t.ftm, t.fta)],
  ]
  const live = games.some((g) => g.status === 'live')
  return (
    <section className="card your-night" aria-labelledby="night-title">
      <div className="stack" style={{ gap: 2 }}>
        <span className="eyebrow" id="night-title">
          Your {live ? 'night so far' : 'night'} · {t.played} played
        </span>
        {top && (
          <span className="night-lead">
            {top.name} led with {statLine(top)}.
          </span>
        )}
      </div>
      <dl className="night-cats">
        {cats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="num">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function GameCard({
  game,
  teamId,
  selected,
  onPick,
}: {
  game: Game
  teamId: number
  selected: boolean
  onPick: () => void
}) {
  const mine = game.lines.filter((l) => l.owner_team_id === teamId)
  const win = winner(game)
  const top = best(game.lines)
  const scheduled = game.status === 'scheduled'
  const className = `game-card${mine.length ? ' has-mine' : ''}`
  const body = (
    <>
      <span className="game-status small">
        {game.status === 'live' ? (
          <span className="badge badge-live">Live</span>
        ) : scheduled ? (
          tipOff(game.start)
        ) : (
          'Final'
        )}
        {mine.length > 0 && <span className="mine-names">Yours: {mine.map((l) => shortName(l.name)).join(', ')}</span>}
      </span>
      <TeamRow side={game.away} lead={win === 'away'} dim={win === 'home'} prefix="" />
      <TeamRow side={game.home} lead={win === 'home'} dim={win === 'away'} prefix="@ " />
      {top && !scheduled && (
        <span className="game-top small">
          {top.name} {statLine(top)}
        </span>
      )}
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

function TeamRow({ side, lead, dim, prefix }: { side: Game['home']; lead: boolean; dim: boolean; prefix: string }) {
  return (
    <span className={`team-row${lead ? ' lead' : ''}${dim ? ' dim' : ''}`}>
      <span title={side.name}>
        {prefix}
        {side.abbrev}
      </span>
      <span className="num score">{side.score ?? ''}</span>
    </span>
  )
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
          {game.status === 'live' ? 'Live' : 'Final'} · {dayLabel(date)}. Owner is the fantasy team in this league.
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
          Best free agent in this game: <strong>{fa.name}</strong>, {statLine(fa)} ({fa.fgm}-{fa.fga} FG).
        </p>
      )}
    </section>
  )
}

function BoxRow({ line: l, mine, abbrev }: { line: GameLine; mine: boolean; abbrev: Map<number, string> }) {
  const owner = l.owner_team_id == null ? 'FA' : (abbrev.get(l.owner_team_id) ?? '')
  return (
    <tr className={mine ? 'mine' : undefined}>
      <th scope="row">{l.name}</th>
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
      <td>
        {l.fgm}-{l.fga}
      </td>
      <td>
        {l.ftm}-{l.fta}
      </td>
    </tr>
  )
}

function shortName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}
