// His line for his next game (PlayerRef.next_game), shown the way the site writes stats. Pure
// functions only. Rules this follows:
// - One number per stat, never a range (Can, 2026-11-15: "27 points, 6 rebs, 7 assists, 3 stl").
// - Counting stats and minutes round to whole numbers; FG% and FT% print the box-score way
//   (".420", ratioPct), with "–" when he has no attempts.
// - The site's column order (STAT_COLUMNS: MIN, then the nine categories as CATEGORY_ORDER).
//   Minutes are context, not a category: never bold.
// - Two lines (the player you add, the player you drop) are compared on the numbers as shown, so a
//   1.3 against a 1.0 steal is a tie: one game can't tell them apart.
import type { components } from '../api/schema'
import { isRatio, lowerIsBetter } from './league'
import { ratioPct } from './shooting'
import { CATEGORY_ORDER } from './statOrder'

export type NextGameLine = components['schemas']['NextGameLine']
export type LineKey = 'MIN' | (typeof CATEGORY_ORDER)[number]

export interface LineCell {
  key: LineKey
  /** Spoken label, for screen readers. */
  word: string
  /** The number as shown (a ratio for FG%/FT%), or null for no attempts. */
  value: number | null
  text: string
}

const PICK: Record<LineKey, { word: string; pick: (l: NextGameLine) => number | null }> = {
  MIN: { word: 'minutes', pick: (l) => l.minutes },
  'FG%': { word: 'field goal percentage', pick: (l) => l.fg_pct ?? null },
  'FT%': { word: 'free throw percentage', pick: (l) => l.ft_pct ?? null },
  '3PM': { word: 'threes made', pick: (l) => l.three_pm },
  REB: { word: 'rebounds', pick: (l) => l.reb },
  AST: { word: 'assists', pick: (l) => l.ast },
  STL: { word: 'steals', pick: (l) => l.stl },
  BLK: { word: 'blocks', pick: (l) => l.blk },
  TO: { word: 'turnovers', pick: (l) => l.to },
  PTS: { word: 'points', pick: (l) => l.pts },
}

/** STAT_COLUMNS order, with FG and FT as the percentages Can counts. */
const KEYS: LineKey[] = ['MIN', ...CATEGORY_ORDER]

/** The column heads, in the site's order, with their spoken words. */
export const LINE_LABELS = KEYS.map((key) => ({ key, word: PICK[key].word }))

/** The line as ten cells in the site's column order. */
export function lineCells(line: NextGameLine): LineCell[] {
  return KEYS.map((key) => {
    const raw = PICK[key].pick(line)
    if (raw == null || Number.isNaN(raw)) return { key, word: PICK[key].word, value: null, text: '–' }
    const value = isRatio(key) ? Math.round(raw * 1000) / 1000 : Math.round(raw)
    return { key, word: PICK[key].word, value, text: isRatio(key) ? ratioPct(value) : String(value) }
  })
}

/**
 * Which side has the better number as shown: 'add', 'drop' or null for a tie, a missing number, or
 * minutes (not a category). Fewer turnovers is better.
 */
export function better(key: LineKey, add: number | null, drop: number | null): 'add' | 'drop' | null {
  if (key === 'MIN' || add == null || drop == null || add === drop) return null
  return (lowerIsBetter(key) ? add < drop : add > drop) ? 'add' : 'drop'
}
