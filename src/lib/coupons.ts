// Ready-made iddaa coupons for a night (Can 2026-11-22): a few picks whose odds multiply, built from
// iddaa's own priced lines and our chance for each. Comparison only: nothing here feeds the model.
//
// Rules: only the book's own lines with odds over MIN_ODD; at most one pick per game (picks from one
// game move together, so their chances can't simply be multiplied; Players Only allows two different
// players from one game, spec.perGame); the coupon's chance is our chances
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
  /** Set: the highest total odds in [lo, hi] whose combined chance stays at or above this, instead of
   *  the likeliest set near the target (Surprise, Can 2026-11-22: "at least 10%, lower odds a bit"). */
  minChance?: number
  /** Picks allowed from one game, never two from one player (default 1). Players Only takes 2 (Can
   *  2026-11-22: "add a 3rd, 4th or 5th player bet if needed", so a two-game night isn't stuck on two
   *  long rungs). Their chances still multiply, a fair read for two different players. */
  perGame?: number
}

/** Safest to boldest, the order the page shows them in. */
export const COUPONS: CouponSpec[] = [
  { kind: 'safe', title: 'Highest Confidence', target: 4.5, lo: 4, hi: 5.5, min: 3, max: 4, only: null },
  { kind: 'players', title: 'Players Only', target: 4.5, lo: 4, hi: 5.5, min: 2, max: 5, only: 'player', perGame: 2 },
  { kind: 'matches', title: 'Matches Only', target: 4.5, lo: 4, hi: 5.5, min: 2, max: 5, only: 'game' },
  { kind: 'surprise', title: 'Surprise', target: 15, lo: 8, hi: 20, min: 3, max: 7, only: null, minChance: 0.1 },
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
  legs: Leg[] // in tip-off order
  listed: number // total odds as built: every leg's odds multiplied
  odds: number // what it pays on: void legs count 1.00 once settled
  chance: number // ours as built, every leg's chance multiplied
  implied: number // what the listed odds read as: 1 / listed
  /** won once every leg is in, lost at the first leg that loses, null while any is open. */
  result: 'won' | 'lost' | null
  broke: Leg[] // the legs that lost it, in tip-off order
  voided: Leg[] // players who sat out
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

const PER_GAME = 8 // the most picks a game keeps for the search

/** A game's picks worth searching: those no other pick beats on both chance and odds (any set using a
 *  beaten pick does at least as well with the one that beats it), likeliest first. */
function frontier(cs: Leg[]): Leg[] {
  const sorted = [...cs].sort((a, b) => b.chance - a.chance || b.odd - a.odd)
  const out: Leg[] = []
  for (const c of sorted) if (!out.some((o) => o.odd >= c.odd && o.chance >= c.chance)) out.push(c)
  return out.slice(0, PER_GAME)
}
const BUDGET = 400_000 // search steps, a safety net on big nights

/** The set of legs (one per game) with the highest combined chance whose total odds sit in
 *  [lo, hi]; ties go to the total nearer the target. Branch and bound: adding a leg only ever lowers
 *  the chance and raises the odds, so a branch stops once it can't beat the best or is past hi. */
export function bestSet(pool: Leg[], spec: CouponSpec): Leg[] | null {
  if (spec.minChance != null) return boldestSet(pool, spec, spec.minChance)
  const perGame = spec.perGame ?? 1
  // one group per game, or per player when a game may give more than one pick
  const groupOf = (c: Leg) => (perGame > 1 ? `${c.gameId}:${c.line.name}` : String(c.gameId))
  const byGroup = new Map<string, Leg[]>()
  for (const c of pool) byGroup.set(groupOf(c), [...(byGroup.get(groupOf(c)) ?? []), c])
  const groups = [...byGroup.values()].map(frontier).sort((a, b) => b[0].chance - a[0].chance)
  const logHi = Math.log(spec.hi)
  const logLo = Math.log(spec.lo)
  const logT = Math.log(spec.target)
  let best: Leg[] | null = null
  let bestP = -Infinity
  let bestMiss = Infinity
  let steps = 0
  const pick: Leg[] = []
  const used = new Map<number, number>() // picks taken from each game
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
    for (let g = gi; g < groups.length; g++) {
      const game = groups[g][0].gameId
      if ((used.get(game) ?? 0) >= perGame) continue
      for (const c of groups[g]) {
        const p = logP + Math.log(c.chance)
        const o = logO + Math.log(c.odd)
        if (o > logHi + 1e-9 || p <= bestP) continue
        pick.push(c)
        used.set(game, (used.get(game) ?? 0) + 1)
        walk(g + 1, p, o)
        used.set(game, used.get(game)! - 1)
        pick.pop()
      }
    }
  }
  walk(0, 0, 0)
  return best
}

/** The set (one leg per game) with the highest total odds in [lo, hi] whose combined chance is still at
 *  least `floor`; ties go to the likelier set. Adding a leg only lowers the chance and raises the odds,
 *  so a branch stops once its chance falls under the floor or its odds pass hi. */
function boldestSet(pool: Leg[], spec: CouponSpec, floor: number): Leg[] | null {
  const byGame = new Map<number, Leg[]>()
  for (const c of pool) byGame.set(c.gameId, [...(byGame.get(c.gameId) ?? []), c])
  // every pick, not just each game's frontier: a long price with a fair chance is what this one wants
  const games = [...byGame.values()].map((cs) => [...cs].sort((a, b) => b.odd - a.odd))
  const logHi = Math.log(spec.hi)
  const logLo = Math.log(spec.lo)
  const logF = Math.log(floor)
  let best: Leg[] | null = null
  let bestO = -Infinity
  let bestP = -Infinity
  let steps = 0
  const pick: Leg[] = []
  const walk = (gi: number, logP: number, logO: number) => {
    if (++steps > BUDGET) return
    if (pick.length >= spec.min && logO >= logLo) {
      if (logO > bestO + 1e-9 || (Math.abs(logO - bestO) <= 1e-9 && logP > bestP)) {
        best = [...pick]
        bestO = logO
        bestP = logP
      }
    }
    if (pick.length >= spec.max) return
    for (let g = gi; g < games.length; g++) {
      for (const c of games[g]) {
        const p = logP + Math.log(c.chance)
        const o = logO + Math.log(c.odd)
        if (o > logHi + 1e-9 || p < logF - 1e-9) continue
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
  const sorted = [...legs].sort((a, b) => a.line.game.tip.localeCompare(b.line.game.tip) || b.chance - a.chance)
  const listed = product(sorted.map((l) => l.odd))
  const open = sorted.some((l) => l.result == null)
  const broke = sorted.filter((l) => l.result === 'lost')
  return {
    spec,
    legs: sorted,
    listed,
    odds: product(sorted.map((l) => (l.result === 'void' ? 1 : l.odd))),
    chance: product(sorted.map((l) => l.chance)),
    implied: 1 / listed,
    result: broke.length ? 'lost' : open ? null : 'won',
    broke,
    voided: sorted.filter((l) => l.result === 'void'),
  }
}

export interface CouponSlot {
  spec: CouponSpec
  coupon: Coupon | null
  /** waiting: no player bets posted yet; short: the night can't fill it. */
  why: 'waiting' | 'short' | null
  /** The kind of an earlier coupon with exactly the same picks (Matches Only before player bets). */
  same: CouponKind | null
}

/** The night's four coupons, always in the same order (Can 2026-11-22: Surprise stays 4th); one the
 *  night can't fill keeps its place, with why. */
export function couponsOf(lines: Line[]): CouponSlot[] {
  const pool = candidates(lines)
  const players = pool.some((c) => c.kind === 'player')
  const out: CouponSlot[] = COUPONS.map((spec) => {
    const mine = spec.only ? pool.filter((c) => c.kind === spec.only) : pool
    if (spec.only === 'player' && !players) return { spec, coupon: null, why: 'waiting', same: null }
    const set = bestSet(mine, spec)
    return { spec, coupon: set ? couponOf(spec, set) : null, why: set ? null : 'short', same: null }
  })
  const key = (c: Coupon) => c.legs.map((l) => l.id).join('|')
  out.forEach((slot, i) => {
    const twin = slot.coupon && out.slice(0, i).find((o) => o.coupon && key(o.coupon) === key(slot.coupon!))
    if (twin) slot.same = twin.spec.kind
  })
  return out
}

/** Total odds as iddaa prints them: two decimals. */
export const fmtOdds = (x: number) => (Math.round(x * 100) / 100).toFixed(2)

/** What a stake pays if the coupon wins: 10 TL at 4.62 pays 46 TL. */
export const pays = (stake: number, odds: number) => Math.round(stake * odds)

/** "Brunson 22+ points", "PHI to win": a leg in words. */
export function legWords(l: Leg): string {
  if (l.kind === 'game') return l.bet
  return `${l.line.name} ${l.bet} ${STAT_UNIT[l.stat]}`
}
