import type { Game, GameLine, LineupSpot, NextGame } from '../api/client'

/**
 * What one of your players is doing on the day on screen:
 * - live: his game is on (``line`` is null until he checks in)
 * - final: his game is over and he played
 * - dnp: his game is over and he never got on the floor
 * - later: his game hasn't started
 * - idle: his team has no game that day
 */
export type RowState = 'live' | 'final' | 'dnp' | 'later' | 'idle'

export interface PlayerRow {
  spot: LineupSpot
  game: Game | null
  line: GameLine | null
  state: RowState
}

/** One row per player, in ESPN's lineup order (the server sends starting slots, then BE, then IR). */
export function buildRows(spots: LineupSpot[], games: Game[]): PlayerRow[] {
  const byId = new Map(games.map((g) => [g.id, g]))
  return spots.map((spot) => {
    const game = spot.game_id != null ? (byId.get(spot.game_id) ?? null) : null
    const line = game?.lines.find((l) => l.player_id === spot.player_id) ?? null
    const state: RowState = !game
      ? 'idle'
      : game.status === 'scheduled'
        ? 'later'
        : game.status === 'live'
          ? 'live'
          : line
            ? 'final'
            : 'dnp'
    return { spot, game, line, state }
  })
}

export const isBench = (s: LineupSpot) => s.slot === 'BE'
export const isIR = (s: LineupSpot) => s.slot === 'IR'

export interface Counts {
  /** Starting slots whose player has a game that day. */
  playing: number
  starters: number
  live: number
  final: number
  later: number
  idle: number
  /** Bench players with a game that day (their lines count for nothing). */
  benchPlaying: number
}

export function counts(rows: PlayerRow[], openSlots: number): Counts {
  const starting = rows.filter((r) => r.spot.starting)
  const n = (s: RowState) => starting.filter((r) => r.state === s).length
  return {
    playing: starting.filter((r) => r.state !== 'idle').length,
    starters: starting.length + openSlots,
    live: n('live'),
    final: n('final') + n('dnp'),
    later: n('later'),
    idle: n('idle') + openSlots,
    benchPlaying: rows.filter((r) => isBench(r.spot) && r.state !== 'idle').length,
  }
}

export interface Totals {
  played: number
  on: number
  min: number
  fgm: number
  fga: number
  ftm: number
  fta: number
  tpm: number
  reb: number
  ast: number
  stl: number
  blk: number
  to: number
  pts: number
}

/** What counts so far: the lines of players in starting slots only. */
export function starterTotals(rows: PlayerRow[]): Totals {
  const t: Totals = { played: 0, on: 0, min: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, tpm: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pts: 0 }
  for (const r of rows) {
    if (!r.spot.starting || !r.line) continue
    const l = r.line
    t.played += 1
    if (r.state === 'live') t.on += 1
    t.min += l.minutes
    t.fgm += l.fgm
    t.fga += l.fga
    t.ftm += l.ftm
    t.fta += l.fta
    t.tpm += l.tpm
    t.reb += l.reb
    t.ast += l.ast
    t.stl += l.stl
    t.blk += l.blk
    t.to += l.to
    t.pts += l.pts
  }
  return t
}

export interface Swap {
  /** The bench player whose game is still to come. */
  bench: PlayerRow
  /** The starting slot he fits that has nobody playing in it. */
  slot: string
  /** Who sits in that slot with no game, if anyone (an empty slot has nobody). */
  idle: PlayerRow | null
}

const OUT = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION'])

/**
 * A lineup fix you can still make: a bench player whose game hasn't tipped, who fits a starting
 * slot that has no game (or nobody) in it. Only the first one: the note is a nudge, not a list.
 */
export function swapToMake(rows: PlayerRow[], openSlots: string[]): Swap | null {
  const holes: { slot: string; idle: PlayerRow | null }[] = [
    ...rows.filter((r) => r.spot.starting && r.state === 'idle').map((r) => ({ slot: r.spot.slot, idle: r })),
    ...openSlots.map((slot) => ({ slot, idle: null })),
  ]
  if (!holes.length) return null
  for (const bench of rows) {
    if (!isBench(bench.spot) || bench.state !== 'later' || OUT.has(bench.spot.injury_status)) continue
    const hole = holes.find((h) => (bench.spot.eligible ?? []).includes(h.slot))
    if (hole) return { bench, ...hole }
  }
  return null
}

/** "Thompson's 19 pts sat on your bench": the best bench line of a finished day, when it beat nothing. */
export function benchLeftOut(rows: PlayerRow[]): PlayerRow | null {
  const idle = rows.some((r) => r.spot.starting && (r.state === 'idle' || r.state === 'dnp'))
  if (!idle) return null
  const bench = rows.filter((r) => isBench(r.spot) && r.line && r.line.minutes > 0)
  return bench.sort((a, b) => b.line!.pts - a.line!.pts)[0] ?? null
}

export function lastName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? parts.slice(1).join(' ') : name
}

/** ESPN's own team page, where the lineup is set. ESPN has no link straight to a day's lineup. */
export function espnTeamUrl(leagueId: number, teamId: number, season: number): string {
  return `https://fantasy.espn.com/basketball/team?leagueId=${leagueId}&teamId=${teamId}&seasonId=${season}`
}

/** "in 2h 10m", "in 40m", "any minute": the time left to a tip-off. ``soon`` inside the last hour. */
export function countdown(startIso: string, now: number): { text: string; soon: boolean } {
  const mins = Math.ceil((new Date(startIso).getTime() - now) / 60_000)
  if (mins <= 0) return { text: 'any minute', soon: true }
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return { text: h > 0 ? `in ${h}h${m ? ` ${m}m` : ''}` : `in ${m}m`, soon: mins <= 60 }
}

/** The weekday of an ESPN day ("Wed"), on the US date as the day picker shows it. */
export function weekday(date: string | null | undefined): string {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}

/** "Wed @ IND" / "Wed vs BKN": where his team plays next. */
export function nextLabel(g: NextGame): string {
  return `${weekday(g.date)} ${g.home ? 'vs' : '@'} ${g.opponent.abbrev}`
}

/** His team's games left this week after the day on screen. */
export function gamesLeft(spot: LineupSpot, day: number): number {
  return (spot.week_games ?? []).filter((d) => d > day).length
}
