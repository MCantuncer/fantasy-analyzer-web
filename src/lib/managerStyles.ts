import type { ManagerStyleRow, ManagerStyles } from '../api/client'
import { CATEGORY_ORDER } from './statOrder'

export const ACTIVITY_LABEL: Record<ManagerStyleRow['activity'], string> = {
  waiver_hawk: 'Waiver hawk',
  streamer: 'Streamer',
  steady_hands: 'Steady hands',
  draft_loyalist: 'Draft loyalist',
  set_and_forget: 'Set and forget',
}

export const LINEUP_LABEL: Record<ManagerStyleRow['lineup'], string> = {
  sharp: 'Sharp',
  steady: 'Steady',
  leaks_starts: 'Leaks starts',
  low_volume: 'Low volume',
}

export type Band = 'lock' | 'swing' | 'let_go'

export interface BoardCell {
  cat: string
  band: Band
  /** Share of finished weeks won, 0-1. */
  share: number
  won: number
  weeks: number
}

/** The nine categories in the site's fixed order, each placed in its win-path band. */
export function pathBoard(data: ManagerStyles, me: ManagerStyleRow): BoardCell[] {
  const path = data.win_path
  const band = (cat: string): Band =>
    path?.lock.includes(cat) ? 'lock' : path?.swing.includes(cat) ? 'swing' : 'let_go'
  const order: readonly string[] = CATEGORY_ORDER
  return [...me.categories]
    .sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat))
    .map((c) => ({
      cat: c.cat,
      band: band(c.cat),
      share: c.weeks ? c.won / c.weeks : 0,
      won: c.won,
      weeks: c.weeks,
    }))
}

/** "3 of 5" with a tie counted half ("2.5 of 5"). */
export function weeksWon(won: number, weeks: number) {
  return `${Number.isInteger(won) ? won : won.toFixed(1)} of ${weeks}`
}

/** Categories in the site order (FG% first, PTS last), whatever order the API sent. */
export function inOrder(cats: readonly string[]): string[] {
  const at = (c: string) => {
    const i = (CATEGORY_ORDER as readonly string[]).indexOf(c)
    return i < 0 ? CATEGORY_ORDER.length : i
  }
  return [...cats].sort((a, b) => at(a) - at(b))
}

/** "A, B and C". */
export function listCats(cats: readonly string[]) {
  if (cats.length <= 1) return cats.join('')
  return `${cats.slice(0, -1).join(', ')} and ${cats[cats.length - 1]}`
}

/** What to look for on the wire. Fewer turnovers is not something an add brings, so TO is said as "without the turnovers". */
export function lookFor(need: string[]) {
  const bring = need.filter((c) => c !== 'TO')
  const lowTo = bring.length < need.length
  if (!bring.length) return lowTo ? 'Look for adds that keep the turnovers down.' : ''
  return `Look for ${listCats(bring)}${lowTo ? ', without the turnovers.' : '.'}`
}

export const SWING_TARGET = 0.8

/** Category wins a week gained if every swing category reached the target share. */
export function swingGain(board: BoardCell[]) {
  return board.filter((c) => c.band === 'swing').reduce((sum, c) => sum + Math.max(0, SWING_TARGET - c.share), 0)
}

export function pct(share: number) {
  return `${Math.round(share * 100)}%`
}

/** The quiet line under a trade partner's name: their activity, then the one thing that matters most for a trade. */
export function partnerLine(t: ManagerStyleRow): string {
  const activity = ACTIVITY_LABEL[t.activity]
  if (t.door === 'closed')
    return `Door closed · declined ${t.declined}, ${t.trades ? `traded ${t.trades}` : 'never traded'}`
  if (t.door === 'open') return `${activity} · door open, traded ${t.trades}`
  if (t.lineup === 'leaks_starts') return `${activity} · leaks starts, ${t.missed_starts} missed`
  if (t.lineup === 'low_volume') return `${activity} · low volume, ${t.starts_per_week.toFixed(1)} starts/wk`
  if (t.chases.length) return `${activity} · chases ${listCats(inOrder(t.chases))}`
  return activity
}
