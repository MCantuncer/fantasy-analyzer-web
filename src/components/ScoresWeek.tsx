import { useMemo, useState } from 'react'
import type { FixtureDay } from '../api/client'
import { dayLabel, isOut } from '../lib/scores'
import { PlayerLink } from './PlayerCard'
import { TeamLogo } from './PlayerHead'
import './ScoresWeek.css'

type Side = FixtureDay['games'][number]['home']

interface Cell {
  kind: 'play' | 'sit' | 'out' | 'none'
  opp?: Side
}

interface Row {
  id: number
  name: string
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
        if (!row) {
          row = { id: p.player_id, name: p.name, cells: week.map(() => ({ kind: 'none' })), starts: 0 }
          rows.set(p.player_id, row)
        }
        const opp = p.pro_team_id === g.home.pro_team_id ? g.away : g.home
        const kind = isOut(p.injury_status) ? 'out' : sits.has(p.player_id) ? 'sit' : 'play'
        row.cells[i] = { kind, opp }
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
  const cols = { gridTemplateColumns: `minmax(92px, 200px) repeat(${week.length}, minmax(0, 88px)) 40px` }
  return (
    <section className="card sw" aria-labelledby="week-title">
      <div className="sw-head">
        <h2 id="week-title">Still to play this week</h2>
        <p className="small muted sw-sum">
          <span className="num sw-sum-n">{starts}</span> {starts === 1 ? 'start' : 'starts'} left
          {sitTotal > 0 && (
            <>
              {' · '}
              <span className="num sw-sum-n sw-warn">{sitTotal}</span> {sitTotal === 1 ? 'player sits' : 'players sit'}{' '}
              on full days
            </>
          )}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="empty">None of your players has a game left this week.</p>
      ) : (
        <div className="sw-grid" role="table" aria-label="Your players' games left this week">
          <div className="sw-row sw-days" role="row" style={cols}>
            <span role="columnheader">
              <span className="sr-only">Player</span>
            </span>
            {week.map((d, i) => {
              const n = sitsByDay[i]
              return (
                <button
                  key={d.day}
                  type="button"
                  role="columnheader"
                  className="link sw-day"
                  onClick={() => onPick(d.day)}
                  title={`Games on ${dayLabel(d.date)}`}
                  aria-label={n > 0 ? `${dayLabel(d.date)}, ${n} sit` : dayLabel(d.date)}
                >
                  <span className="sw-day-name">
                    {dayLabel(d.date)
                      .split(' ')
                      .map((part) => (
                        <span key={part}>{part}</span>
                      ))}
                  </span>
                  <span className="sw-day-mark">
                    {n > 0 && (
                      <span className="sw-day-sit">
                        <BenchBadge />
                        {n}
                        <span className="sw-sit-word"> sit</span>
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
            <span role="columnheader" className="small muted sw-starts-h">
              Starts
            </span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="sw-row" role="row" style={cols}>
              <span role="rowheader" className="sw-name">
                <PlayerLink player={{ id: r.id, name: r.name }}>{shortName(r.name)}</PlayerLink>
              </span>
              {r.cells.map((c, i) => (
                <span key={i} role="cell" className={`sw-cell sw-${c.kind}`} title={cellTitle(c)}>
                  {c.kind === 'out' ? (
                    <span className="sw-out-text">OUT</span>
                  ) : c.opp ? (
                    <>
                      <span className="sw-logo">
                        <TeamLogo abbrev={c.opp.abbrev} size={22} />
                        <span className="sw-abbrev" aria-hidden="true">
                          {c.opp.abbrev}
                        </span>
                      </span>
                      {c.kind === 'sit' && <BenchBadge />}
                    </>
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
        <span className="small muted sw-legend">
          <span className="sw-key">
            <BenchBadge />
          </span>
          sits: more games that day than your lineup spots
        </span>
        <button type="button" className="link small" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Hide NBA games' : `All ${nbaGames} NBA games`}
        </button>
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
      <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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

function shortName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}
