// Ready-made iddaa coupons for a night (Can 2026-11-22): a few picks whose odds multiply, built from
// iddaa's own priced lines and our chance for each. Comparison only: nothing here feeds the model.
//
// Rules: only the book's own lines with odds over MIN_ODD; at most one pick per game (picks from one
// game move together, so their chances can't simply be multiplied); the coupon's chance is our chances
// multiplied. Among the sets whose total odds land in the coupon's range, the engine keeps the one with
// the highest combined chance.
import { MIN_ODD, STAT_UNIT } from './iddaaCompare'
import type { Line, Stat } from './iddaaCompare'

export type CouponKind = 'safe' | 'surprise' | 'players' | 'matches'

export interface CouponSpec {
  kind: CouponKind
  title: string
  target: number // total odds aimed at
  lo: number
  hi: number
  min: number // legs
  max: number
  only: 'player' | 'game' | null
}

export const COUPONS: CouponSpec[] = [
  { kind: 'safe', title: 'Highest confidence', target: 4.5, lo: 4, hi: 5.5, min: 3, max: 4, only: null },
  { kind: 'surprise', title: 'Surprise', target: 20, lo: 17, hi: 25, min: 3, max: 7, only: null },
  { kind: 'players', title: 'Players only', target: 4.5, lo: 4, hi: 5.5, min: 2, max: 5, only: 'player' },
  { kind: 'matches', title: 'Matches only', target: 4.5, lo: 4, hi: 5.5, min: 2, max: 5, only: 'game' },
]

/** One pick on a coupon. */
export interface Leg {
  id: string
  line: Line
  kind: 'player' | 'game'
  stat: Stat
  gameId: number
  /** "22+", "PHI to win", "PHI −4.5", "Over 226.5" */
  bet: string
  /** For a player rung: the threshold n (22 for 22+); for a game line: the line. */
  at: number
  odd: number
  chance: number // ours, 0-1
  /** won / lost once settled; void when the player sat out (iddaa counts the leg at 1.00). */
  result: 'won' | 'lost' | 'void' | null
}

export interface Coupon {
  spec: CouponSpec
  legs: Leg[]
  odds: number // total odds (void legs count 1.00 once settled)
  chance: number // ours, all legs multiplied
  implied: number // what the total odds read as: 1 / odds
  /** won once every leg is in, lost at the first leg that loses, null while any is open. */
  result: 'won' | 'lost' | null
}

const GAME_PICKS: Stat[] = ['WIN', 'MAR', 'TOT']

/** Every pick the engine may use: our one bet on each game line, and for players every rung iddaa
 *  prices (not just our usual bet), each with our chance for it. */
export function candidates(lines: Line[]): Leg[] {
  const out: Leg[] = []
  for (const l of lines) {
    if (l.kind === 'game') {
      const b = l.barem
      if (!GAME_PICKS.includes(l.stat) || !b || b.odd == null || b.odd <= MIN_ODD || b.sure == null) continue
      out.push({
        id: l.id,
        line: l,
        kind: 'game',
        stat: l.stat,
        gameId: l.game.game_id,
        bet: b.label,
        at: b.at,
        odd: b.odd,
        chance: b.sure,
        result: l.oursHit == null ? null : l.oursHit ? 'won' : 'lost',
      })
      continue
    }
    for (const r of l.rungs) {
      if (r.ours == null || r.odd <= MIN_ODD || r.ours <= 0 || r.ours >= 1) continue
      const settled = l.game.status === 'final'
      out.push({
        id: `${l.id}-${r.n}`,
        line: l,
        kind: 'player',
        stat: l.stat,
        gameId: l.game.game_id,
        bet: `${r.n}+`,
        at: r.n,
        odd: r.odd,
        chance: r.ours,
        result: !settled
          ? null
          : l.played === false
            ? 'void'
            : r.hit != null
              ? r.hit
                ? 'won'
                : 'lost'
              : l.actual != null
                ? l.actual >= r.n
                  ? 'won'
                  : 'lost'
                : null,
      })
    }
  }
  return out
}

const PER_GAME = 6 // the best few picks a game keeps for the search
const BUDGET = 400_000 // search steps, a safety net on big nights

/** The set of legs (one per game) with the highest combined chance whose total odds sit in
 *  [lo, hi]; ties go to the total nearer the target. Branch and bound: adding a leg only ever lowers
 *  the chance and raises the odds, so a branch stops once it can't beat the best or is past hi. */
export function bestSet(pool: Leg[], spec: CouponSpec): Leg[] | null {
  const byGame = new Map<number, Leg[]>()
  for (const c of pool) byGame.set(c.gameId, [...(byGame.get(c.gameId) ?? []), c])
  const games = [...byGame.values()]
    .map((cs) => cs.sort((a, b) => b.chance - a.chance || b.odd - a.odd).slice(0, PER_GAME))
    .sort((a, b) => b[0].chance - a[0].chance)
  const logHi = Math.log(spec.hi)
  const logLo = Math.log(spec.lo)
  const logT = Math.log(spec.target)
  let best: Leg[] | null = null
  let bestP = -Infinity
  let bestMiss = Infinity
  let steps = 0
  const pick: Leg[] = []
  const walk = (gi: number, logP: number, logO: number) => {
    if (++steps > BUDGET) return
    if (pick.length >= spec.min && logO >= logLo) {
      const miss = Math.abs(logO - logT)
      if (logP > bestP + 1e-9 || (Math.abs(logP - bestP) <= 1e-9 && miss < bestMiss)) {
        best = [...pick]
        bestP = logP
        bestMiss = miss
      }
    }
    if (pick.length >= spec.max) return
    for (let g = gi; g < games.length; g++) {
      for (const c of games[g]) {
        const p = logP + Math.log(c.chance)
        const o = logO + Math.log(c.odd)
        if (o > logHi + 1e-9 || p <= bestP) continue
        pick.push(c)
        walk(g + 1, p, o)
        pick.pop()
      }
    }
  }
  walk(0, 0, 0)
  return best
}

const product = (xs: number[]) => xs.reduce((a, x) => a * x, 1)

export function couponOf(spec: CouponSpec, legs: Leg[]): Coupon {
  const sorted = [...legs].sort((a, b) => b.chance - a.chance)
  const odds = product(sorted.map((l) => (l.result === 'void' ? 1 : l.odd)))
  const open = sorted.some((l) => l.result == null)
  const lost = sorted.some((l) => l.result === 'lost')
  return {
    spec,
    legs: sorted,
    odds,
    chance: product(sorted.filter((l) => l.result !== 'void').map((l) => l.chance)),
    implied: 1 / odds,
    result: lost ? 'lost' : open ? null : 'won',
  }
}

/** The night's four coupons. A coupon the night can't fill (too few games, or no player bets yet)
 *  comes back with why. */
export function couponsOf(lines: Line[]): { spec: CouponSpec; coupon: Coupon | null; why: string | null }[] {
  const pool = candidates(lines)
  const players = pool.some((c) => c.kind === 'player')
  return COUPONS.map((spec) => {
    const mine = spec.only ? pool.filter((c) => c.kind === spec.only) : pool
    if (spec.only === 'player' && !players) return { spec, coupon: null, why: 'waiting' }
    const set = bestSet(mine, spec)
    return set ? { spec, coupon: couponOf(spec, set), why: null } : { spec, coupon: null, why: 'short' }
  })
}

/** What a stake pays if the coupon wins: 10 TL at 4.62 pays 46 TL. */
export const pays = (stake: number, odds: number) => Math.round(stake * odds)

/** "Brunson 22+ points", "PHI to win": a leg in words. */
export function legWords(l: Leg): string {
  if (l.kind === 'game') return l.bet
  return `${l.line.name} ${l.bet} ${STAT_UNIT[l.stat]}`
}
