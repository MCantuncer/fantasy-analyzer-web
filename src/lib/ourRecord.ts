// Our record on Our Estimates (The Slip Rail, Can 2026-11-23): the night's three counts. Before the
// results they say what is open (bets, Kupons, rungs); as games go final the same three fill in with
// what happened. Kept apart from the component so the counting can be tested.

import type { CouponSlot } from './coupons'
import { picksNight, slipReturn } from './iddaaCompare'
import type { CompareGame, CompareTally, Line } from './iddaaCompare'
import { rungCount, scoreRows } from './valueRungs'

export interface BetCount {
  /** Every bet the night takes: game picks (winner, handicap, total) and one per player line. */
  n: number
  game: number
  player: number
  settled: number
  won: number
  /** One unit on each settled bet at its own odds: net units. */
  net: number
}

export interface KuponCount {
  /** Kupons built tonight; a slip with the same picks as an earlier one counts once. */
  n: number
  settled: number
  won: number
  /** Picks still to settle on the Kupons that are still open. */
  picksOpen: number
  /** What each won Kupon paid on (void legs at 1.00), in the page's order. */
  paid: number[]
}

export interface RungTally {
  /** Every player rung iddaa prices over 1.33. */
  n: number
  /** Rungs with a result and both chances, and on how many each side's chance sat nearer it. */
  judged: number
  ours: number
  book: number
  level: number
  /** Rungs in games not yet final. */
  open: number
}

export interface RecordCounts {
  bets: BetCount
  kupons: KuponCount
  rungs: RungTally
}

export function recordCounts(games: CompareGame[], lines: Line[], slots: CouponSlot[]): RecordCounts {
  const g = picksNight(games, lines)
  const playerBets = lines.filter((l) => l.kind === 'player' && l.barem)
  const pSettled = playerBets.filter((l) => l.oursHit != null)
  const bets: BetCount = {
    n: g.bets + playerBets.length,
    game: g.bets,
    player: playerBets.length,
    settled: g.settled + pSettled.length,
    won: g.won + pSettled.filter((l) => l.oursHit).length,
    net: g.net + pSettled.reduce((a, l) => a + (slipReturn(l) ?? 0), 0),
  }

  const built = slots.flatMap((s) => (s.coupon && !s.same ? [s.coupon] : []))
  const open = built.filter((c) => c.result == null)
  const legsOpen = new Set(open.flatMap((c) => c.legs.filter((l) => l.result == null).map((l) => l.id)))
  const kupons: KuponCount = {
    n: built.length,
    settled: built.length - open.length,
    won: built.filter((c) => c.result === 'won').length,
    picksOpen: legsOpen.size,
    paid: built.filter((c) => c.result === 'won').map((c) => c.odds),
  }

  const players = lines.filter((l) => l.kind === 'player')
  const all = players.flatMap((l) => l.rungs)
  const rungsOpen = players.reduce((a, l) => a + (l.game.status === 'final' ? 0 : l.rungs.length), 0)
  const c = rungCount(all)
  return { bets, kupons, rungs: { n: all.length, judged: c.n, ours: c.ours, book: c.book, level: c.level, open: rungsOpen } }
}

/** Nothing to count yet: no bet, no Kupon and no priced rung (iddaa has not posted the night). */
export const nothingYet = (c: RecordCounts) => c.bets.n === 0 && c.kupons.n === 0 && c.rungs.n === 0

/** Settled player rungs the night's tally scores, by both sides: the rung scores by stat have
 *  something to show. 0 before any result, and on a night whose ladders did not load. */
export function scoredRungs(tally: CompareTally[], lines: Line[]): number {
  if (!lines.some((l) => l.kind === 'player' && l.rungs.length > 0)) return 0
  const rows = scoreRows(tally, lines)
  return rows[rows.length - 1]?.rungs ?? 0
}

/** "+1.20", "−0.40", "0.00": units at one a bet. */
export const unitsSigned = (v: number) => {
  const r = Math.round(v * 100) / 100
  return r > 0 ? `+${r.toFixed(2)}` : r < 0 ? `−${Math.abs(r).toFixed(2)}` : '0.00'
}
