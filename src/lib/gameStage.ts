// Game picks one match at a time (Can 2026-11-24: "User selects a match and its details came. Not
// like listing all"). The slate lists the night's matches grouped Final / Live / To come; the stage
// shows the chosen one. These helpers pick the order, the opening match and the number lines' scales.
import type { CompareGame, QuarterBet, Stat } from './iddaaCompare'
import { isEdge } from './quarterBets'

/** Market rows in the spec's order: Handicap, Total points, then Match result. Team totals are not a
 *  bet the engine makes, so they stay in Every line. */
export const PICK_KINDS: [Stat, string][] = [
  ['MAR', 'Handicap'],
  ['TOT', 'Total points'],
  ['WIN', 'Match result'],
]

export type Phase = 'final' | 'live' | 'next'

/** Final once the scores are in, live from tip-off, else still to come. */
export function phaseOf(g: CompareGame, now: Date = new Date()): Phase {
  if (g.status === 'final' && g.away_score != null && g.home_score != null) return 'final'
  if (g.status === 'live' || new Date(g.tip) <= now) return 'live'
  return 'next'
}

export const PHASE_NAME: Record<Phase, string> = { final: 'Final', live: 'Live', next: 'To come' }
const ORDER: Phase[] = ['final', 'live', 'next']

/** The slate's groups in order, each keeping the night's own order (tip time). Empty groups drop out. */
export function slateGroups(games: CompareGame[], now: Date = new Date()): { phase: Phase; games: CompareGame[] }[] {
  return ORDER.map((phase) => ({ phase, games: games.filter((g) => phaseOf(g, now) === phase) })).filter(
    (s) => s.games.length > 0,
  )
}

/** The slate's order flattened: what ‹ › and "Game 4 of 9" walk through. */
export function slateOrder(games: CompareGame[], now: Date = new Date()): CompareGame[] {
  return slateGroups(games, now).flatMap((s) => s.games)
}

/** The best quarter value in a game (its strongest edge), or null when none beats the price. */
export function bestEdge(bets: QuarterBet[] | undefined): number | null {
  const edges = (bets ?? []).filter(isEdge).map((b) => b.edge ?? 0)
  return edges.length ? Math.max(...edges) : null
}

/** "+0.13": the best quarter value, as the slate row's tag. */
export const edgeTag = (v: number) => `+${v.toFixed(2)}`

/** The match the page opens on: the next to tip, else the live one, else the first with a quarter
 *  edge, else the first. */
export function openingGame(games: CompareGame[], now: Date = new Date()): number | null {
  if (!games.length) return null
  const next = games
    .filter((g) => phaseOf(g, now) === 'next')
    .sort((a, b) => new Date(a.tip).getTime() - new Date(b.tip).getTime())[0]
  if (next) return next.game_id
  const live = games.find((g) => phaseOf(g, now) === 'live')
  if (live) return live.game_id
  const valued = games.find((g) => bestEdge(g.quarters) != null)
  return (valued ?? games[0]).game_id
}

/** The game in the URL (`?game=`) when it is on tonight's slate, else the opening match. */
export function chosenGame(games: CompareGame[], asked: number | null, now: Date = new Date()): number | null {
  if (asked != null && games.some((g) => g.game_id === asked)) return asked
  return openingGame(games, now)
}

export const GAME_PARAM = 'game'

export function readGameParam(): number | null {
  if (typeof window === 'undefined') return null
  const v = Number(new URLSearchParams(window.location.search).get(GAME_PARAM))
  return Number.isInteger(v) && v > 0 ? v : null
}

export function writeGameParam(id: number | null) {
  if (typeof window === 'undefined') return
  const q = new URLSearchParams(window.location.search)
  if (id == null) q.delete(GAME_PARAM)
  else q.set(GAME_PARAM, String(id))
  const s = q.toString()
  window.history.replaceState(window.history.state, '', s ? `?${s}` : window.location.pathname)
}

/** A number line's scale: centred on `mid`, wide enough for every value with some air, never
 *  narrower than `min` each side. */
export function scaleAround(
  mid: number,
  values: (number | null | undefined)[],
  min: number,
): { lo: number; hi: number } {
  const far = values.reduce<number>((a, v) => (v == null ? a : Math.max(a, Math.abs(v - mid))), 0)
  const half = Math.max(min, far * 1.35)
  return { lo: mid - half, hi: mid + half }
}

/** Where a value sits on a scale, in percent, kept inside the line's ends. */
export function pos(v: number, lo: number, hi: number): number {
  if (hi <= lo) return 50
  return Math.min(97, Math.max(3, ((v - lo) / (hi - lo)) * 100))
}

/** The duel bar's reach each side: 20 points, or the next 5 past the widest margin it shows. */
export function duelReach(...margins: (number | null | undefined)[]): number {
  const far = margins.reduce<number>((a, v) => (v == null ? a : Math.max(a, Math.abs(v))), 0)
  return Math.max(20, Math.ceil((far + 1) / 5) * 5)
}
