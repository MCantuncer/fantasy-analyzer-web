import { useMemo, useState, type CSSProperties } from 'react'
import { CalendarDots, CaretDown } from '@phosphor-icons/react'
import type { FixtureDay } from '../api/client'
import { dayLabel, isOut, usToday } from '../lib/scores'
import { PlayerLink } from './PlayerCard'
import { PlayerHead, TeamLogo } from './PlayerHead'
import './ScoresWeek.css'

type Side = FixtureDay['games'][number]['home']

interface Cell {
  kind: 'play' | 'sit' | 'out' | 'none'
  opp?: Side
  /** He plays at home ("vs IND"); otherwise away ("@GS"). */
  home?: boolean
}

interface Row {
  id: number
  name: string
  /** His own NBA team, for the face's team light. */
  team: string | null
  cells: Cell[]
  starts: number
}

/** Your week as a grid: a row per player, a column per day left, the opponent in each cell. */
function buildRows(week: FixtureDay[]): Row[] {
  const rows = new Map<number, Row>()
  week.forEach((d, i) => {
    const sits = new Set(d.sits ?? [])
    for (const g of d.games) {
      for (const p of g.my_players) {
        let row = rows.get(p.player_id)
        const own = p.pro_team_id === g.home.pro_team_id ? g.home : p.pro_team_id === g.away.pro_team_id ? g.away : null
        if (!row) {
          row = {
            id: p.player_id,
            name: p.name,
            team: own?.abbrev ?? null,
            cells: week.map(() => ({ kind: 'none' })),
            starts: 0,
          }
          rows.set(p.player_id, row)
        }
        const opp = p.pro_team_id === g.home.pro_team_id ? g.away : g.home
        const kind = isOut(p.injury_status) ? 'out' : sits.has(p.player_id) ? 'sit' : 'play'
        row.cells[i] = { kind, opp, home: p.pro_team_id === g.home.pro_team_id }
        if (kind === 'play') row.starts += 1
      }
    }
  })
  return [...rows.values()].sort((a, b) => b.starts - a.starts || a.name.localeCompare(b.name))
}

export function ScoresWeek({ week, onPick }: { week: FixtureDay[]; onPick: (day: number) => void }) {
  const rows = useMemo(() => buildRows(week), [week])
  const [all, setAll] = useState(false)
  const starts = rows.reduce((n, r) => n + r.starts, 0)
  // Counted from the cells: a sitter whose game already tipped off today isn't in the fixtures.
  const sitsByDay = week.map((_, i) => rows.filter((r) => r.cells[i].kind === 'sit').length)
  const sitTotal = sitsByDay.reduce((n, x) => n + x, 0)
  const nbaGames = week.reduce((n, d) => n + d.games.length, 0)
  const today = usToday()
  // Sized to its content: the name, one 76px column per day left and the starts (ScoresWeek.css).
  const cols = { '--sw-days': week.length } as CSSProperties
  // Phones squeeze the day columns: fewer days keep the logo, more days keep only the letters.
  const fit = week.length <= 3 ? 'roomy' : week.length <= 5 ? 'snug' : 'tight'
  return (
    <section className="sw" aria-labelledby="week-title" data-fit={fit}>
      <div className="sw-head">
        <h2 id="week-title">
          <CalendarDots className="sw-head-ic" aria-hidden="true" />
          Still to play this week
        </h2>
        <p className="sw-sum">
          <b className="num">{starts}</b> {starts === 1 ? 'start' : 'starts'} left
          {sitTotal > 0 && (
            <>
              {' · '}
              <b className="num sw-warn">{sitTotal}</b> {sitTotal === 1 ? 'player sits' : 'players sit'} on full days
            </>
          )}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="sw-empty">None of your players has a game left this week.</p>
      ) : (
        <div className="sw-grid" role="table" aria-label="Your players' games left this week" style={cols}>
          <div className="sw-row" role="row">
            <span role="columnheader" className="sw-h">
              <span className="sr-only">Player</span>
            </span>
            {week.map((d, i) => {
              const n = sitsByDay[i]
              const isToday = d.date === today
              return (
                <span key={d.day} role="columnheader" className="sw-h sw-h-day">
                  <button
                    type="button"
                    className="sw-day"
                    onClick={() => onPick(d.day)}
                    title={`Games on ${dayLabel(d.date)}`}
                    aria-label={`${dayLabel(d.date)}${isToday ? ', today' : ''}${n > 0 ? `, ${n} sit` : ''}`}
                  >
                    {isToday && <i className="sw-today" aria-hidden="true" />}
                    <span className="sw-day-name">
                      {dayLabel(d.date)
                        .split(' ')
                        .map((part) => (
                          <span key={part}>{part}</span>
                        ))}
                    </span>
                    {n > 0 && (
                      <span className="sw-day-sit" aria-hidden="true">
                        <BenchBadge />
                        {n}
                      </span>
                    )}
                  </button>
                </span>
              )
            })}
            <span role="columnheader" className="sw-h sw-h-starts">
              Starts
            </span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="sw-row" role="row">
              <span role="rowheader" className="sw-name">
                <PlayerLink player={{ id: r.id, name: r.name }} decorative>
                  <PlayerHead player={{ id: r.id, name: r.name }} size={22} team={r.team} />
                </PlayerLink>
                <span className="sw-name-text">
                  <PlayerLink player={{ id: r.id, name: r.name }}>
                    <ShortName name={r.name} />
                  </PlayerLink>
                </span>
              </span>
              {r.cells.map((c, i) => (
                <span key={i} role="cell" className={`sw-cell sw-${c.kind}`} title={cellTitle(c)}>
                  {c.kind === 'out' ? (
                    <span className="sw-op" aria-hidden="true">
                      OUT
                    </span>
                  ) : c.opp ? (
                    <span className="sw-op" aria-hidden="true">
                      <span className="sw-logo">
                        <TeamLogo abbrev={c.opp.abbrev} size={16} />
                      </span>
                      <span className="sw-at">{c.home ? 'vs\u00a0' : '@'}</span>
                      {c.opp.abbrev}
                      {c.kind === 'sit' && <BenchBadge />}
                    </span>
                  ) : null}
                  <span className="sr-only">{cellTitle(c)}</span>
                </span>
              ))}
              <span role="cell" className="num sw-starts">
                {r.starts}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="sw-foot">
        <button type="button" className="sw-all-btn" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Hide NBA games' : `All ${nbaGames} NBA games`}
          <CaretDown className="sw-all-caret" aria-hidden="true" />
        </button>
        {sitTotal > 0 && (
          <span className="sw-legend">
            <BenchBadge />
            sits: more games that day than your lineup spots
          </span>
        )}
      </div>
      {all && <AllGames week={week} onPick={onPick} />}
    </section>
  )
}

function cellTitle(c: Cell): string {
  if (c.kind === 'none' || !c.opp) return c.kind === 'out' ? 'Out' : 'No game'
  if (c.kind === 'out') return `Out, vs ${c.opp.abbrev}`
  return c.kind === 'sit' ? `Sits, vs ${c.opp.abbrev}` : `Plays ${c.opp.abbrev}`
}

function BenchBadge() {
  return (
    <span className="sw-bench" aria-hidden="true">
      <svg
        width="7"
        height="7"
        viewBox="0 0 8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M4 1v5M1.8 4.2 4 6.4l2.2-2.2" />
      </svg>
    </span>
  )
}

/** Every NBA game left this week, for checking a matchup the grid doesn't show. */
function AllGames({ week, onPick }: { week: FixtureDay[]; onPick: (day: number) => void }) {
  return (
    <ol className="sw-all">
      {week.map((d) => (
        <li key={d.day}>
          <button type="button" className="link sw-all-day" onClick={() => onPick(d.day)}>
            {dayLabel(d.date)} · {d.games.length} {d.games.length === 1 ? 'game' : 'games'}
          </button>
          <ul className="sw-all-games">
            {d.games.map((g) => (
              <li key={g.id}>
                <TeamLogo abbrev={g.away.abbrev} size={18} />
                <span className="num">{g.away.abbrev}</span>
                <span className="muted">@</span>
                <TeamLogo abbrev={g.home.abbrev} size={18} />
                <span className="num">{g.home.abbrev}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

/** "C. Spencer"; a crowded phone week drops the initial ("Spencer"). */
function ShortName({ name }: { name: string }) {
  const parts = name.split(' ')
  if (parts.length < 2) return <>{name}</>
  return (
    <>
      <span className="sw-initial">{parts[0][0]}.</span> {parts.slice(1).join(' ')}
    </>
  )
}
