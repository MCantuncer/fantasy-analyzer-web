import type { GameLine } from '../api/client'
import { STAT_COLUMNS, type StatColumn } from './statOrder'

const BOX_META = {
  FG: { key: 'fg', label: 'FG', name: 'field goals made' },
  FT: { key: 'ft', label: 'FT', name: 'free throws made' },
  PTS: { key: 'pts', label: 'PTS', name: 'points' },
  '3PM': { key: 'tpm', label: '3PM', name: 'threes made' },
  REB: { key: 'reb', label: 'REB', name: 'rebounds' },
  AST: { key: 'ast', label: 'AST', name: 'assists' },
  STL: { key: 'stl', label: 'STL', name: 'steals' },
  BLK: { key: 'blk', label: 'BLK', name: 'blocks' },
  TO: { key: 'to', label: 'TO', name: 'turnovers' },
} as const satisfies Record<Exclude<StatColumn, 'MIN'>, { key: string; label: string; name: string }>

/** The nine fantasy categories a box score can be sorted by, in the site's column order (after Min). */
export const BOX_CATS = STAT_COLUMNS.filter((c): c is Exclude<StatColumn, 'MIN'> => c !== 'MIN').map(
  (c) => BOX_META[c],
)

export type BoxCat = (typeof BOX_META)[keyof typeof BOX_META]['key']
export type BoxSort = { cat: BoxCat; dir: 'desc' | 'asc' } | null

/** One tap on a category: highest first, then lowest first, then back to the game's own order. */
export function nextSort(sort: BoxSort, cat: BoxCat): BoxSort {
  if (sort?.cat !== cat) return { cat, dir: 'desc' }
  return sort.dir === 'desc' ? { cat, dir: 'asc' } : null
}

// Shooting sorts by makes, so a 1/1 night doesn't land above 9/16; fewer misses breaks a tie.
function value(l: GameLine, cat: BoxCat): [number, number] {
  if (cat === 'fg') return [l.fgm, l.fgm - l.fga]
  if (cat === 'ft') return [l.ftm, l.ftm - l.fta]
  return [l[cat], 0]
}

/** Sorts one team's lines. Ties keep the game's order (minutes), whichever way the sort runs. */
export function sortLines(lines: GameLine[], sort: BoxSort): GameLine[] {
  if (!sort) return lines
  const sign = sort.dir === 'desc' ? -1 : 1
  return lines
    .map((line, i) => ({ line, i, v: value(line, sort.cat) }))
    .sort((a, b) => sign * (a.v[0] - b.v[0]) || sign * (a.v[1] - b.v[1]) || a.i - b.i)
    .map((x) => x.line)
}

/**
 * With no sort, a team reads like a real box score: the starting five, then the bench, each by minutes
 * (the game's order). Any sort ranks the whole team together, so there is no split. No split either when
 * the lines don't say who started (a day the server hasn't tagged yet).
 */
export function splitStarters(
  lines: GameLine[],
  sort: BoxSort,
): { starters: GameLine[]; bench: GameLine[] } | null {
  if (sort) return null
  const starters = lines.filter((l) => l.starter)
  if (!starters.length) return null
  const byMinutes = (a: GameLine, b: GameLine) => b.minutes - a.minutes
  return {
    starters: [...starters].sort(byMinutes),
    bench: lines.filter((l) => !l.starter).sort(byMinutes),
  }
}

