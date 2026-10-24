import type { Game, GameLine } from '../api/client'

export interface NightTotals {
  played: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tpm: number
  to: number
  fgm: number
  fga: number
  ftm: number
  fta: number
}

/** Your players' combined line for the day, in the league's nine categories. */
export function nightTotals(games: Game[], teamId: number): NightTotals {
  const t: NightTotals = {
    played: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tpm: 0,
    to: 0,
    fgm: 0,
    fga: 0,
    ftm: 0,
    fta: 0,
  }
  for (const line of myLines(games, teamId)) {
    t.played += 1
    t.pts += line.pts
    t.reb += line.reb
    t.ast += line.ast
    t.stl += line.stl
    t.blk += line.blk
    t.tpm += line.tpm
    t.to += line.to
    t.fgm += line.fgm
    t.fga += line.fga
    t.ftm += line.ftm
    t.fta += line.fta
  }
  return t
}

export function myLines(games: Game[], teamId: number): GameLine[] {
  return games.flatMap((g) => g.lines.filter((l) => l.owner_team_id === teamId))
}

/** A rough single-number game score, only used to pick who stood out. */
export function impact(l: GameLine): number {
  return l.pts + l.reb + l.ast + 2 * (l.stl + l.blk) + l.tpm - l.to - 0.5 * (l.fga - l.fgm)
}

export function best(lines: GameLine[]): GameLine | undefined {
  return lines.reduce<GameLine | undefined>((top, l) => (!top || impact(l) > impact(top) ? l : top), undefined)
}

/** "36 pts, 12 reb, 5 ast": points always, then the two biggest of rebounds, assists, steals, blocks. */
export function statLine(l: GameLine): string {
  const extras = (
    [
      [l.reb, 'reb'],
      [l.ast, 'ast'],
      [l.stl, 'stl'],
      [l.blk, 'blk'],
    ] as [number, string][]
  )
    .filter(([v]) => v >= 3)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2)
  return [`${l.pts} pts`, ...extras.map(([v, k]) => `${v} ${k}`)].join(', ')
}

export function ratio(made: number, attempts: number): string {
  return attempts ? (made / attempts).toFixed(3).replace(/^0/, '') : '—'
}

/** "Thu 23" from an ESPN game date (YYYY-MM-DD, the US date of the games). */
export function dayLabel(date: string | null | undefined): string {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${dt.toLocaleDateString('en-US', { weekday: 'short' })} ${d}`
}

/** Tip-off in the viewer's own time zone. */
export function tipOff(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function winner(g: Game): 'away' | 'home' | null {
  if (g.status !== 'final' || g.away.score == null || g.home.score == null || g.away.score === g.home.score) return null
  return g.away.score > g.home.score ? 'away' : 'home'
}
