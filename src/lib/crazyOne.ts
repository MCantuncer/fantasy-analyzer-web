import type { CrazyGame, CrazyRecord } from '../api/client'

/* Crazy One: a persona that believes what fans believe and the data backs on average, but not in every
   season (api app/tunings.py STORY). Its numbers live only in its own world, always named "Crazy One's
   call", never Our call. Everything here turns POST /api/crazy-one into words and marks. */

export type BeliefKey = 'rivalry' | 'bounce' | 'slump' | 'tank' | 'one_man'

export interface Belief {
  key: BeliefKey
  name: string
  /** What it believes, in its own voice. */
  creed: string
  /** The weight, in plain words. */
  weight: string
  /** How often it held, from the research it stands on. */
  held: string
  /** Seasons it held of those measured, for the pips (none where it was never counted by season). */
  pips?: [number, number]
}

export const BELIEFS: Belief[] = [
  {
    key: 'rivalry',
    name: 'Rivalry stack',
    creed: 'A fallen contender in a slump, facing a team it met in the last two playoffs, plays like it’s May.',
    weight: '+12 wins per 100 (+3 when the other side’s star sits)',
    held: 'Beat the book in 13 of 15 seasons',
    pips: [13, 15],
  },
  {
    key: 'bounce',
    name: 'Favourite bounce',
    creed: 'A favourite that lost three in a row gets angry, not worse.',
    weight: '+0.65 points on the margin, +2.1 when favoured by 6 or more',
    held: 'Held in 6 of 8 seasons',
    pips: [6, 8],
  },
  {
    key: 'slump',
    name: 'Slumping strong team',
    creed: 'A good team in a bad run is closer to its real level than the run says.',
    weight: '+0.5 points on the margin',
    held: 'Fails on its own; a fan’s hunch',
  },
  {
    key: 'tank',
    name: 'Tankers sink late',
    creed: 'After game 55, bad teams stop caring before the book notices.',
    weight: '−1.5 points on the margin, under .350 after 55 games',
    held: 'Under the book 5 of 5 recent seasons (not older ones)',
    pips: [5, 5],
  },
  {
    key: 'one_man',
    name: 'Two one-man shows',
    creed: 'When both teams run their shots through one or two players, defenses load up on them and the game comes in low.',
    weight: '−1 point off the game’s total (the total, not the winner)',
    held: 'Under Our call’s total in 4 of 5 seasons',
    pips: [4, 5],
  },
]

/** A belief's team code is empty when it moves the game's total, not the winner (api tunings.TOTAL). */
export function onTotal(b: { team: string }): boolean {
  return b.team === ''
}

/** Whether a game has a belief that moves the winner (a total-only game still agrees on who wins). */
export function movesWinner(g: Pick<CrazyGame, 'beliefs'>): boolean {
  return g.beliefs.some((b) => !onTotal(b))
}

/** Its total against Our call's, when a belief moved the total: { ours, crazy }. */
export function totals(g: CrazyGame): { ours: number; crazy: number } | null {
  if (!g.beliefs.some(onTotal)) return null
  return { ours: g.ours.away + g.ours.home, crazy: g.crazy.away + g.crazy.home }
}

/** The myths it refuses, with what the data says. */
export const MYTHS: { name: string; data: string }[] = [
  { name: 'Revenge games', data: 'stars score 0.8 less after a bad loss' },
  { name: 'Contract year', data: '−0.65 pts, 11 of 11 seasons' },
  { name: '“He’s due”', data: 'cold leads to cold' },
  { name: 'Win-streak complacency', data: 'flips every season' },
  { name: 'Size mismatch', data: 'no effect' },
  { name: 'Soft defense tonight', data: 'no more booms than expected; fewer in 3 of 5 seasons' },
]

export function beliefOf(key: string): Belief | undefined {
  return BELIEFS.find((b) => b.key === key)
}

/** "62%" */
export function pct(p: number): string {
  return `${Math.round(p * 100)}%`
}

/** One decimal with its sign: "+1.4", "−0.6" (a true minus). */
export function signed(x: number, digits = 1): string {
  const v = Number(x.toFixed(digits))
  if (v === 0) return (0).toFixed(digits)
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`
}

/** The team a call backs and by how much: { team, by }. */
export function leanOf(call: { away: number; home: number }, g: Pick<CrazyGame, 'away' | 'home'>) {
  const margin = call.home - call.away
  return margin >= 0 ? { team: g.home, by: margin } : { team: g.away, by: -margin }
}

/** The team Crazy One moves toward and how far, in wins per 100 (from Our call's chance). */
export function swingOf(g: CrazyGame): { team: string; per100: number } {
  return g.swing >= 0 ? { team: g.home, per100: g.swing * 100 } : { team: g.away, per100: -g.swing * 100 }
}

/** A game where Crazy One and Our call pick different winners. */
export function flips(g: CrazyGame): boolean {
  return g.crazy.home_chance >= 0.5 !== g.ours.home_chance >= 0.5
}

export type RecordState = 'empty' | 'early' | 'leading' | 'behind'

/** Where its record stands: no finals yet, too early to tell, a lead (the whole range above zero), or
 *  behind (the whole range below). */
export function recordState(r: CrazyRecord): RecordState {
  if (r.games === 0) return 'empty'
  if (r.leading) return 'leading'
  if (r.edge_high != null && r.edge_high < 0) return 'behind'
  return 'early'
}

export const RECORD_WORDS: Record<RecordState, string> = {
  empty: 'No record yet. Its first calls settle after tonight’s finals.',
  early: 'Too early: the range still crosses zero, so a hit could be luck.',
  leading: 'A lead: its whole range sits above Our call.',
  behind: 'Behind: its whole range sits below Our call.',
}

/** Where a home chance sits on a 0-100% track, as a percentage from the away end. */
export function trackAt(homeChance: number): number {
  return Math.min(100, Math.max(0, homeChance * 100))
}

/** "Wed 25 Nov": the US game date of a night, from its first tip. */
export function nightOf(games: Pick<CrazyGame, 'tip'>[]): string {
  const tips = games.map((g) => g.tip).sort()
  const d = tips.length ? new Date(tips[0]) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { timeZone: 'America/New_York', weekday: 'short', day: 'numeric', month: 'short' })
}

/** Its edge over Our call, per 100 games of log loss: "+0.4". */
export function edge100(x: number | null | undefined): string {
  return x == null ? '–' : signed(x * 100)
}

/** Where the edge, its range and zero sit on one bar, as percentages across it. */
export function rangeMarks(r: Pick<CrazyRecord, 'edge' | 'edge_low' | 'edge_high'>) {
  if (r.edge == null || r.edge_low == null || r.edge_high == null) return null
  const reach = Math.max(Math.abs(r.edge_low), Math.abs(r.edge_high), 1e-9) * 1.15
  const at = (x: number) => 50 + (x / reach) * 50
  return { low: at(r.edge_low), high: at(r.edge_high), edge: at(r.edge), zero: 50 }
}
