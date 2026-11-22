// Ready-made iddaa coupons for a night (Can 2026-11-22): a few picks whose odds multiply, built from
// iddaa's own priced lines and our chance for each. Comparison only: nothing here feeds the model.
//
// Rules: only the book's own lines with odds over MIN_ODD; at most two picks per game, and only ones
// that barely move together (spec.perGame; Surprise keeps one), so their chances can be multiplied;
// the coupon's chance is our chances
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
  /** A floor on our combined chance: no set under it is shown. */
  minChance?: number
  /** Total odds the set should reach when it can (Surprise: 15). Below it, down to lo, a set only wins
   *  when our chance times its odds is higher, so a 12 has to be clearly likelier than a 15. */
  aimFrom?: number
  /** Picks allowed from one game (default 1). Can 2026-11-22: "add a 3rd, 4th or 5th bet if needed" on
   *  every Kupon but Surprise. A second pick from a game is only one that barely moves with the first,
   *  so multiplying the chances stays honest: two different players, or the total beside a winner or
   *  handicap pick. Never a game line with a player from that game, never winner with handicap. */
  perGame?: number
}

/** Safest to boldest, the order the page shows them in. */
export const COUPONS: CouponSpec[] = [
  { kind: 'safe', title: 'Highest Confidence', target: 4.5, lo: 4, hi: 5.5, min: 3, max: 5, only: null, perGame: 2 },
  { kind: 'players', title: 'Players Only', target: 4.5, lo: 4, hi: 5.5, min: 2, max: 5, only: 'player', perGame: 2 },
  { kind: 'matches', title: 'Matches Only', target: 4.5, lo: 4, hi: 5.5, min: 2, max: 5, only: 'game', perGame: 2 },
  // Surprise: 15+ at 10%+ when it can, a likelier 12-15 when that is the better bet (Can 2026-11-22)
  { kind: 'surprise', title: 'Surprise', target: 15, lo: 12, hi: 20, min: 3, max: 7, only: null, minChance: 0.1, aimFrom: 15 },
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

/** The set of legs (one per game unless spec.perGame) with the highest combined chance whose total odds sit in
 *  [lo, hi]; ties go to the total nearer the target. Branch and bound: adding a leg only ever lowers
 *  the chance and raises the odds, so a branch stops once it can't beat the best or is past hi. */
export function bestSet(pool: Leg[], spec: CouponSpec): Leg[] | null {
  if (spec.aimFrom != null && spec.aimFrom > spec.lo) {
    // the likeliest set from aimFrom up and the likeliest just under it; the balance leans a little to
    // probability (odds count at the power 0.8), so 12 at 13% beats 15 at 10% (Can 2026-11-22) while
    // 12 at 11% does not
    const up = floored(likeliest(pool, { ...spec, lo: spec.aimFrom }), spec)
    const under = floored(likeliest(pool, { ...spec, hi: spec.aimFrom - 1e-6 }), spec)
    const score = (s: Leg[] | null) => (s ? product(s.map((l) => l.chance * l.odd ** BALANCE)) : -1)
    return under && score(under) > score(up) + 1e-12 ? under : up
  }
  return floored(likeliest(pool, spec), spec)
}

const BALANCE = 0.8

const floored = (set: Leg[] | null, spec: CouponSpec) =>
  set && spec.minChance != null && product(set.map((l) => l.chance)) < spec.minChance - 1e-9 ? null : set

/** What a pick is about inside its game: a player, the side (winner and handicap), or the total. */
const subject = (c: Leg) => (c.kind === 'player' ? `p:${c.line.name}` : c.stat === 'TOT' ? 'total' : 'side')

/** A second pick from a game only when it barely moves with the first (see perGame). */
const fits = (c: Leg, taken: Leg[]) => taken.every((t) => t.kind === c.kind && subject(t) !== subject(c))

function likeliest(pool: Leg[], spec: CouponSpec): Leg[] | null {
  const perGame = spec.perGame ?? 1
  // one group per game, or per subject when a game may give more than one pick
  const groupOf = (c: Leg) => (perGame > 1 ? `${c.gameId}:${subject(c)}` : String(c.gameId))
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
  const used = new Map<number, Leg[]>() // picks taken from each game
  const walk = (gi: number, logP: number, logO: number) => {
    if (++steps > BUDGET) return
    if (pick.length >= spec.min && logO >= logLo - 1e-9) {
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
      const taken = used.get(game) ?? []
      if (taken.length >= perGame) continue
      for (const c of groups[g]) {
        const p = logP + Math.log(c.chance)
        const o = logO + Math.log(c.odd)
        if (o > logHi + 1e-9 || p <= bestP || !fits(c, taken)) continue
        pick.push(c)
        used.set(game, [...taken, c])
        walk(g + 1, p, o)
        used.set(game, taken)
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
