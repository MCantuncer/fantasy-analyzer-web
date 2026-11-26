import type { ManagerStyleRow, ManagerStyles } from '../api/client'

/** One dot per manager on a 0-100% track, the league median as a tick: where this manager sits. */
export interface Strip {
  dots: { id: number; at: number }[]
  median: number
  /** Where the median tick sits, 0-1. */
  medianAt: number
  lo: number
  hi: number
}

export function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  if (!s.length) return 0
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Spread the values over the track, with a little room at each end so no dot sits on the edge. */
export function strip(
  teams: ManagerStyleRow[],
  value: (t: ManagerStyleRow) => number,
  fixed?: [number, number],
): Strip {
  const vals = teams.map(value)
  const lo = fixed ? fixed[0] : Math.min(...vals)
  const hi = fixed ? fixed[1] : Math.max(...vals)
  const span = hi - lo || 1
  const at = (v: number) => 0.04 + 0.92 * ((v - lo) / span)
  const med = median(vals)
  return { dots: teams.map((t, i) => ({ id: t.team_id, at: at(vals[i]) })), median: med, medianAt: at(med), lo, hi }
}

/** Share of finished weeks this manager won a category, 0-1. */
export function catShare(t: ManagerStyleRow, cat: string) {
  const c = t.categories.find((x) => x.cat === cat)
  return c && c.weeks ? c.won / c.weeks : 0
}

export type Chip = 'activity' | 'lineup' | 'door' | 'wins' | 'gives'

/** "+2.3" against the median; "±0" when level. */
export function vsMedian(v: number, med: number, digits = 1) {
  const d = v - med
  if (Math.abs(d) < 0.5 * 10 ** -digits) return '±0'
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(digits)}`
}

export function teamOf(data: ManagerStyles, id: number) {
  return data.teams.find((t) => t.team_id === id)
}
