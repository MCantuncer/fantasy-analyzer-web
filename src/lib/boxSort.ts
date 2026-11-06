import type { GameLine } from '../api/client'

/** The nine fantasy categories a box score can be sorted by, in the table's column order. */
export const BOX_CATS = [
  { key: 'pts', label: 'Pts', name: 'points' },
  { key: 'fg', label: 'FG', name: 'field goals made' },
  { key: 'ft', label: 'FT', name: 'free throws made' },
  { key: 'tpm', label: '3PM', name: 'threes made' },
  { key: 'reb', label: 'Reb', name: 'rebounds' },
  { key: 'ast', label: 'Ast', name: 'assists' },
  { key: 'stl', label: 'Stl', name: 'steals' },
  { key: 'blk', label: 'Blk', name: 'blocks' },
  { key: 'to', label: 'TO', name: 'turnovers' },
] as const

export type BoxCat = (typeof BOX_CATS)[number]['key']
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
