// Pure logic for CatStrip's `pair` variant (League's line score): per category, both sides'
// figures, who leads, how far the lead bar reaches and whether the week is close.

import { CATEGORY_ORDER } from './statOrder'
import { formatStat, isClose, leadReach, lowerIsBetter } from './league'

/** One running figure for one category. CategoryScore and today's box both fit. */
export interface StatValue {
  stat: string
  value: number
}

/** One team in a pair strip: who it is, plus its figures for today (optional) and the week. */
export interface StripSide {
  id: number
  name: string
  /** The short name used in the key on narrow screens and in screen-reader labels ("You", "Bastards"). */
  short: string
  colour?: string
  today?: StatValue[] | null
  week: StatValue[]
}

export type Leader = 'a' | 'b' | 'tie' | 'none'

export interface PairCell {
  stat: string
  /** The top figure for each side, or null when there isn't one yet (shown as "–"). */
  a: number | null
  b: number | null
  /** The small figure under each side (this week, in the Today view), or null when there's no sub row. */
  aSub: number | null
  bSub: number | null
  /** Who leads on the top figures. 'none' when there are no figures or nobody has played yet. */
  leader: Leader
  /** Who leads on the sub figures, for their weight. */
  subLeader: Leader
  /** leadReach of the top figures (0.10 to 0.62), 0 when nobody leads. */
  reach: number
  /** The category could still flip this week (isClose on the week figures). */
  close: boolean
}

export interface PairOptions {
  /** Which figures sit on top and drive the bars. */
  top: 'today' | 'week'
  /** The small figures under each side, or none. */
  sub?: 'week' | null
  /** Where "close" comes from: the week, or null for no close flags (Scores' tonight-only strip). */
  closeFrom?: 'week' | null
}

const ORDER: readonly string[] = CATEGORY_ORDER

/** The categories a strip shows: the site's order first, then anything else in the order given. */
export function stripCategories(stats: readonly string[]): string[] {
  const known = ORDER.filter((c) => stats.includes(c))
  return [...known, ...stats.filter((c) => !ORDER.includes(c))]
}

function lookup(values: StatValue[] | null | undefined): Map<string, number> | null {
  return values ? new Map(values.map((v) => [v.stat, v.value])) : null
}

/** Nobody has a figure yet: every category is 0 on both sides (a week or a day before the first tip). */
function unplayed(a: Map<string, number>, b: Map<string, number>, stats: string[]): boolean {
  return stats.every((s) => (a.get(s) ?? 0) === 0 && (b.get(s) ?? 0) === 0)
}

function leaderOf(stat: string, a: number | null, b: number | null): Leader {
  if (a == null || b == null) return 'none'
  if (a === b) return 'tie'
  return (lowerIsBetter(stat) ? a < b : a > b) ? 'a' : 'b'
}

/**
 * One cell per category, in CATEGORY_ORDER (categories the league doesn't score are left out):
 * the top figures and who leads them, the sub figures, the bar's reach and the week's close flag.
 * A day or week where nobody has played yet has no leaders and no figures ("–"); a single 0–0
 * category once games are on (BLK today) is a tie, as the score above counts it.
 */
export function pairCells(a: StripSide, b: StripSide, { top, sub = null, closeFrom = 'week' }: PairOptions): PairCell[] {
  const stats = stripCategories([...new Set([...a.week, ...b.week].map((c) => c.stat))])
  const pick = (side: StripSide, which: 'today' | 'week') => lookup(which === 'today' ? side.today : side.week)
  const topA = pick(a, top)
  const topB = pick(b, top)
  const subA = sub ? pick(a, sub) : null
  const subB = sub ? pick(b, sub) : null
  const closeA = closeFrom ? pick(a, closeFrom) : null
  const closeB = closeFrom ? pick(b, closeFrom) : null
  const topLive = topA != null && topB != null && !unplayed(topA, topB, stats)
  const subLive = subA != null && subB != null && !unplayed(subA, subB, stats)

  return stats.map((stat) => {
    const av = topLive ? (topA.get(stat) ?? null) : null
    const bv = topLive ? (topB.get(stat) ?? null) : null
    const as = subLive ? (subA.get(stat) ?? null) : null
    const bs = subLive ? (subB.get(stat) ?? null) : null
    const leader = leaderOf(stat, av, bv)
    const ca = closeA?.get(stat)
    const cb = closeB?.get(stat)
    return {
      stat,
      a: av,
      b: bv,
      aSub: as,
      bSub: bs,
      leader,
      subLeader: leaderOf(stat, as, bs),
      reach: leader === 'a' || leader === 'b' ? leadReach(stat, av!, bv!) : 0,
      close: ca != null && cb != null && isClose(stat, ca, cb),
    }
  })
}

/** The bar's length as a share of the strip's full reach (0.16 to 1). */
export const barShare = (cell: PairCell) => cell.reach / 0.62

/** A strip figure: ".500" for shooting, whole numbers otherwise, "–" when there's none. */
export const pairFigure = (stat: string, v: number | null) => (v == null ? '–' : formatStat(stat, v))

/**
 * The whole reading of one category for screen readers, e.g. "FG%: you .500, Bastards .429, you
 * lead. Week .509 to .476. Close this week, can flip". ``names`` are how each side is spoken
 * ("you" for your own team).
 */
export function pairLabel(cell: PairCell, names: { a: string; b: string }): string {
  const { stat } = cell
  const fig = (v: number | null) => pairFigure(stat, v)
  const head =
    cell.a == null || cell.b == null
      ? `${stat}: nothing yet`
      : `${stat}: ${names.a} ${fig(cell.a)}, ${names.b} ${fig(cell.b)}, ${
          cell.leader === 'tie' ? 'tied' : `${cell.leader === 'a' ? names.a : names.b} lead`
        }`
  const week = cell.aSub != null && cell.bSub != null ? `. Week ${fig(cell.aSub)} to ${fig(cell.bSub)}` : ''
  const close = cell.close ? '. Close this week, can flip' : ''
  return head + week + close
}

/** One category in CatStrip's `rank` variant (League builds): which way the bar points, how far, its tone. */
export interface RankBar {
  /** Up for the top half of the league (strong), down for the bottom half (weak). */
  dir: 'up' | 'down'
  /** The bar's length as a share of the full reach: its distance from the middle rank, at least a stub. */
  share: number
  /** good for 1st–2nd, bad for a likely punt, neutral otherwise. */
  tone: 'good' | 'bad' | 'neu'
}

/**
 * A weekly category rank (1 is best, ``n`` teams) as a bar from the middle of the league: ranks
 * 1 to n/2 point up, the rest down, and the length grows with the distance from the middle, so 1st
 * and last reach full and the middle ranks are short stubs. 1st and 2nd are good; a likely punt
 * (``punt``) is bad whatever its rank.
 */
export function rankBar(rank: number, n: number, punt = false): RankBar {
  const mid = (n + 1) / 2
  const far = Math.max(1, mid - 1)
  return {
    dir: rank < mid ? 'up' : 'down',
    share: Math.max(0.18, Math.min(1, Math.abs(mid - rank) / far)),
    tone: punt ? 'bad' : rank <= 2 ? 'good' : 'neu',
  }
}
