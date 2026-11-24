// Quarter and first-half bets on Game picks (Can 2026-11-24: "check the quarter base bets"). Each bet
// carries iddaa's line and prices, our number and chance on each side, our lean (pick) and, once
// played, the result. Shown first, kept out of Kupons until about two weeks show they beat the price.
import type { CompareGame, QuarterBet, QuarterSide } from './iddaaCompare'

const ORD = ['1st half', '1st', '2nd', '3rd', '4th']

/** "1st quarter winner", "1st half handicap", "1st half PHI points". */
export function quarterLabel(b: QuarterBet, g: Pick<CompareGame, 'away' | 'home'>): { when: string; what: string } {
  const when = b.period ? `${ORD[b.period]} quarter` : '1st half'
  const what =
    b.market === 'q_winner'
      ? 'winner'
      : b.market === 'h1_margin'
        ? 'handicap'
        : b.market === 'h1_home'
          ? `${g.home} points`
          : b.market === 'h1_away'
            ? `${g.away} points`
            : 'total'
  return { when, what }
}

export const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0')
const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

/** The bet on one side: "Over 56.5", "PHI", "MIL +3.5", "Under 54.5". */
export function sideLabel(b: QuarterBet, side: string, g: Pick<CompareGame, 'away' | 'home'>): string {
  if (b.market === 'q_winner') return side === 'home' ? g.home : side === 'away' ? g.away : 'Tie'
  if (b.market === 'h1_margin' && b.line != null)
    return side === 'home' ? `${g.home} ${signed(b.line)}` : `${g.away} ${signed(-b.line)}`
  return `${side === 'over' ? 'Over' : 'Under'} ${b.line ?? ''}`.trim()
}

/** Our number in words: "PHI by 4.0", "56.0". */
export function oursText(b: QuarterBet, g: Pick<CompareGame, 'away' | 'home'>): string {
  if (b.market === 'q_winner' || b.market === 'h1_margin') {
    if (Math.abs(b.ours) < 0.05) return 'Level'
    return `${b.ours > 0 ? g.home : g.away} by ${one(Math.abs(b.ours))}`
  }
  return one(b.ours)
}

/** What happened: "Got PHI by 13", "Got 53", "Got a tie". */
export function gotText(b: QuarterBet, g: Pick<CompareGame, 'away' | 'home'>): string | null {
  if (b.actual == null) return null
  if (b.market === 'q_winner' || b.market === 'h1_margin') {
    if (b.actual === 0) return 'Got a tie'
    return `Got ${b.actual > 0 ? g.home : g.away} by ${Math.abs(b.actual)}`
  }
  return `Got ${b.actual}`
}

export const pickSide = (b: QuarterBet): QuarterSide | null =>
  b.pick == null ? null : (b.sides.find((s) => s.side === b.pick) ?? null)

/** The chance a price needs to break even: 1 / odds. */
export const needs = (odd: number) => (odd > 0 ? 1 / odd : 1)

/** A pick with value over 0: our chance x its price beats 1. */
export const isEdge = (b: QuarterBet) => b.edge != null && b.edge > 0

/** Value as shown: "+0.06", "−0.12". */
export const valueText = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : `−${Math.abs(v).toFixed(2)}`)

/** The grid: quarter winners and totals by quarter (1-4, a hole where the book has none), and the
 *  first half's handicap, total and both team points. */
export function quarterGrid(bets: QuarterBet[]) {
  const at = (m: QuarterBet['market'], p: number) => bets.find((b) => b.market === m && b.period === p) ?? null
  return {
    winner: [1, 2, 3, 4].map((p) => at('q_winner', p)),
    total: [1, 2, 3, 4].map((p) => at('q_total', p)),
    half: (['h1_margin', 'h1_total', 'h1_away', 'h1_home'] as const).map((m) => at(m, 0)),
  }
}

/** One game's count: bets we lean on, how many have value, and once settled how many won. */
export function quarterCount(bets: QuarterBet[]) {
  const picked = bets.filter((b) => b.pick != null)
  const settled = picked.filter((b) => b.hit != null)
  return {
    bets: picked.length,
    edges: picked.filter(isEdge).length,
    settled: settled.length,
    won: settled.filter((b) => b.hit).length,
  }
}
