/**
 * Night Grade: one 9-cat letter for one player's finished game, so you can read down My Players and
 * see who carried you. It answers "how much did this line help a 9-cat team?", not "was it good for
 * him", so every line is measured against the same fixed yardstick, never his own average.
 *
 * The yardstick is the real game of a rostered player in this league: the mean and spread of the
 * 1,501 final lines by rostered players over days 1–25 of the 2026-27 season (minutes > 0).
 * - PTS, REB, AST, 3PM, STL, BLK: (stat − mean) / spread, more is better.
 * - TO: the same with the sign flipped, fewer is better.
 * - FG and FT are scored the way they move a team's percentage, by volume: makes above (or below)
 *   what a league-average shooter makes on the same attempts (fgm − fga × .470, ftm − fta × .800),
 *   over the spread of that number. 15/20 FG is a big plus, 6/11 FT a real drain, 0/0 exactly zero.
 * Each category is held to ±3 (three spreads) so one freak number can't decide a night alone; the
 * nine are added with equal weight, which is what 9-cat is.
 *
 * The letter floors are percentiles of that same sum over the same 1,501 lines: the A range is the
 * top 15% (A+ the top 4%), B and C the middle 71%, D the next 9% and F the bottom 5%. So a letter
 * says where the night stands among real rostered nights, and about one row in seven lights green
 * and one in seven coral.
 *
 * Only a final line gets a letter. A live line is partial and would be graded against full games
 * (everyone is a D in the first quarter), so callers grade at the final whistle only.
 */
import type { GameLine } from '../api/client'

export type Category = 'FG' | 'FT' | '3PM' | 'REB' | 'AST' | 'STL' | 'BLK' | 'TO' | 'PTS'

/** A rostered player's game in this league: the mean and the game-to-game spread (one SD). */
export const BASELINE = {
  PTS: { mean: 17, spread: 8.8 },
  REB: { mean: 5.8, spread: 3.6 },
  AST: { mean: 3.9, spread: 2.9 },
  '3PM': { mean: 1.8, spread: 1.7 },
  STL: { mean: 1, spread: 1.1 },
  BLK: { mean: 0.65, spread: 1 },
  TO: { mean: 2.1, spread: 1.7 },
} as const

/** League shooting among rostered players, and the spread of makes above/below it in one game. */
export const SHOOTING = {
  FG: { pct: 0.47, spread: 1.8 },
  FT: { pct: 0.8, spread: 0.9 },
} as const

/** No single category moves the night by more than this many spreads. */
export const CAP = 3

export type Grade = 'A+' | 'A' | 'A−' | 'B+' | 'B' | 'B−' | 'C+' | 'C' | 'C−' | 'D' | 'F'

/**
 * Lowest total for each letter, best first; anything under the last one is an F. Each floor is a
 * percentile of the calibration sums (rounded to a quarter): A+ 96th, A 91st, A− 85th, B+ 74th,
 * B 61st, B− 48th, C+ 37th, C 27th, C− 14th, D 5th.
 */
export const GRADE_FLOORS: ReadonlyArray<readonly [Grade, number]> = [
  ['A+', 6.25],
  ['A', 4.75],
  ['A−', 3.5],
  ['B+', 2],
  ['B', 0.75],
  ['B−', -0.25],
  ['C+', -1.25],
  ['C', -2.25],
  ['C−', -3.75],
  ['D', -5.25],
]

/** The A range lights green, D and F coral, the middle stays neutral. */
export type Tier = 'top' | 'mid' | 'low'

/** A category must move by at least two spreads to be marked as what made the night. */
export const DRIVER_MIN = 2

/** Minutes this far off his season average get a small +/− under MIN. */
export const MINUTES_DELTA_MIN = 5

export interface Driver {
  cat: Category
  /** The category's score: positive helped you, negative hurt. */
  z: number
}

export interface NightGrade {
  grade: Grade
  /** The letter alone (A) and its modifier (+, −, or ''), for typesetting. */
  letter: 'A' | 'B' | 'C' | 'D' | 'F'
  mod: '+' | '−' | ''
  tier: Tier
  /** The sum of the nine category scores. */
  score: number
  /** Every category's score, capped. */
  z: Record<Category, number>
  /** At most three categories that moved the night by two spreads or more, biggest first. */
  drivers: Driver[]
}

export type GradedLine = Pick<
  GameLine,
  'minutes' | 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tpm' | 'to' | 'fgm' | 'fga' | 'ftm' | 'fta'
>

const cap = (v: number) => Math.max(-CAP, Math.min(CAP, v))
const z = (v: number, b: { mean: number; spread: number }) => (v - b.mean) / b.spread

/** Each category's score for one line, capped at ±3. */
export function categoryScores(l: GradedLine): Record<Category, number> {
  return {
    FG: cap((l.fgm - l.fga * SHOOTING.FG.pct) / SHOOTING.FG.spread),
    FT: cap((l.ftm - l.fta * SHOOTING.FT.pct) / SHOOTING.FT.spread),
    '3PM': cap(z(l.tpm, BASELINE['3PM'])),
    REB: cap(z(l.reb, BASELINE.REB)),
    AST: cap(z(l.ast, BASELINE.AST)),
    STL: cap(z(l.stl, BASELINE.STL)),
    BLK: cap(z(l.blk, BASELINE.BLK)),
    TO: cap(-z(l.to, BASELINE.TO)),
    PTS: cap(z(l.pts, BASELINE.PTS)),
  }
}

/** The sum of the nine capped category scores. */
export function nightScore(l: GradedLine): number {
  return Object.values(categoryScores(l)).reduce((a, b) => a + b, 0)
}

export function gradeFor(score: number): Grade {
  for (const [g, floor] of GRADE_FLOORS) if (score >= floor) return g
  return 'F'
}

export function tierFor(g: Grade): Tier {
  if (g.startsWith('A')) return 'top'
  if (g === 'D' || g === 'F') return 'low'
  return 'mid'
}

/** The grade for a finished line, or null when there is nothing to grade (no line, no minutes). */
export function nightGrade(line: GradedLine | null | undefined): NightGrade | null {
  if (!line || line.minutes <= 0) return null
  const zs = categoryScores(line)
  const score = Object.values(zs).reduce((a, b) => a + b, 0)
  const grade = gradeFor(score)
  const drivers = (Object.entries(zs) as [Category, number][])
    .filter(([, v]) => Math.abs(v) >= DRIVER_MIN)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([cat, v]) => ({ cat, z: v }))
  return {
    grade,
    letter: grade[0] as NightGrade['letter'],
    mod: (grade.slice(1) as NightGrade['mod']) || '',
    tier: tierFor(grade),
    score,
    z: zs,
    drivers,
  }
}

/** "A− night: PTS and FG helped most, FT hurt most", the badge's spoken form and tooltip. */
export function gradeWords(g: NightGrade): string {
  const up = g.drivers.filter((d) => d.z > 0).map((d) => d.cat)
  const down = g.drivers.filter((d) => d.z < 0).map((d) => d.cat)
  const parts: string[] = []
  if (up.length) parts.push(`${up.join(' and ')} helped most`)
  if (down.length) parts.push(`${down.join(' and ')} hurt most`)
  return parts.length ? `${g.grade} night: ${parts.join(', ')}` : `${g.grade} night`
}

/**
 * His minutes against his season average, rounded, when they are at least 5 off: +7 (a long night)
 * or −6 (a short one). Null when it's within 5, or there is no average yet.
 */
export function minutesDelta(minutes: number, avgMin: number | null | undefined): number | null {
  if (avgMin == null || !Number.isFinite(avgMin)) return null
  const d = Math.round(minutes - avgMin)
  return Math.abs(d) >= MINUTES_DELTA_MIN ? d : null
}

/** "+7" / "−6" with a real minus sign. */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'
}
