// Your matchup sheet (League → Line Score): today's line from the two lineups, as the sheet's
// scoreboard and CatStrip pair read it. Pure, so the score and the strip are worked out once.

import type { StatValue } from './catStrip'
import { buildRows, starterTotals } from './myPlayers'
import type { TodayData } from './todayData'
import { dayCategories, dayRecord, type DayCategory } from './todayMatchup'

const RATIO = new Set(['FG%', 'FT%'])

export interface Record3 {
  wins: number
  losses: number
  ties: number
}

export interface TodayLine {
  cats: DayCategory[]
  /** Today's category score, from your side. */
  rec: Record3
  /** Starters still to tip off today, per side. */
  toCome: [number, number]
  live: boolean
  started: boolean
  allFinal: boolean
  /** The first tip of the day, while nobody has played yet. */
  firstTip: string | null
  /** Today's figures per side for the strip. A side with no number counts as 0 where the score does
   * (counting stats once the other side has one), so the bars agree with the score above them. */
  figures: [StatValue[], StatValue[]]
}

/** Today's line for the two lineups in ``data`` (yours first). */
export function todayLine(data: TodayData): TodayLine {
  const { scores } = data
  const sides = data.lineups.map((l) => {
    const rows = buildRows(l.spots, scores.games)
    const starters = rows.filter((r) => r.spot.starting)
    return { totals: starterTotals(rows), later: starters.filter((r) => r.state === 'later').length }
  })
  const cats = dayCategories(sides[0].totals, sides[1].totals)
  const started = scores.games.some((g) => g.status !== 'scheduled')
  const tips = scores.games.filter((g) => g.status === 'scheduled').map((g) => g.start)
  const figure = (own: number | null, other: number | null, stat: string) =>
    own != null ? (RATIO.has(stat) ? Math.round(own * 1000) / 1000 : own) : !RATIO.has(stat) && other != null ? 0 : null
  const side = (i: 0 | 1): StatValue[] =>
    cats.flatMap((c) => {
      const v = figure(i === 0 ? c.mine : c.theirs, i === 0 ? c.theirs : c.mine, c.stat)
      return v == null ? [] : [{ stat: c.stat, value: v }]
    })
  return {
    cats,
    rec: dayRecord(cats),
    toCome: [sides[0].later, sides[1].later],
    live: scores.games.some((g) => g.status === 'live'),
    started,
    allFinal: scores.games.length > 0 && scores.games.every((g) => g.status === 'final'),
    firstTip: !started && tips.length ? tips.sort()[0] : null,
    figures: [side(0), side(1)],
  }
}

/** "5–4–0". */
export const recText = (r: Record3) => `${r.wins}–${r.losses}–${r.ties}`

/** "Lakers" from "Eryaman Lakers": the last word, which is what a team goes by. */
export function shortTeam(name: string): string {
  const w = name.trim().split(/\s+/)
  return w[w.length - 1]
}

/** Within one category: the same rule the league pulse counts (|wins difference| ≤ 1). */
export const withinOne = (a: { wins: number }, b: { wins: number }) => Math.abs(a.wins - b.wins) <= 1
