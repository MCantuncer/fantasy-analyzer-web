import type { GameLine } from '../api/client'
import { categoryScores } from './nightGrade'
import type { Category as NightCategory } from './nightGrade'
import { CATEGORY_ORDER } from './statOrder'
import { isBench } from './myPlayers'
import type { PlayerRow, Totals } from './myPlayers'

export type Category = (typeof CATEGORY_ORDER)[number]
export type DayResult = 'W' | 'L' | 'T'

export interface DayCategory {
  stat: Category
  /** Null when nobody on that side has a number for it yet (no shots for FG% or FT%). */
  mine: number | null
  theirs: number | null
  /** Your result today; null while neither side has a number. */
  result: DayResult | null
}

const LOWER_WINS = new Set<Category>(['TO'])

/** One category's number from a day's starter totals: a ratio needs at least one attempt. */
export function categoryValue(t: Totals, stat: Category): number | null {
  switch (stat) {
    case 'FG%':
      return t.fga > 0 ? t.fgm / t.fga : null
    case 'FT%':
      return t.fta > 0 ? t.ftm / t.fta : null
    case '3PM':
      return t.played > 0 ? t.tpm : null
    case 'REB':
      return t.played > 0 ? t.reb : null
    case 'AST':
      return t.played > 0 ? t.ast : null
    case 'STL':
      return t.played > 0 ? t.stl : null
    case 'BLK':
      return t.played > 0 ? t.blk : null
    case 'TO':
      return t.played > 0 ? t.to : null
    case 'PTS':
      return t.played > 0 ? t.pts : null
  }
}

/**
 * Who wins each of the nine categories on the day so far, from both lineups' starter totals.
 * A side with no number loses a counting category to any number (0 REB beats nobody), but a
 * ratio with no attempts against a ratio with some stays open (ESPN scores it the same way).
 */
export function dayCategories(mine: Totals, theirs: Totals): DayCategory[] {
  return CATEGORY_ORDER.map((stat) => {
    const a = categoryValue(mine, stat)
    const b = categoryValue(theirs, stat)
    if (a === null && b === null) return { stat, mine: a, theirs: b, result: null }
    const ratio = stat === 'FG%' || stat === 'FT%'
    if (a === null || b === null) {
      if (ratio) return { stat, mine: a, theirs: b, result: null }
      const x = a ?? 0
      const y = b ?? 0
      return { stat, mine: a, theirs: b, result: compare(stat, x, y) }
    }
    return { stat, mine: a, theirs: b, result: compare(stat, a, b) }
  })
}

function compare(stat: Category, a: number, b: number): DayResult {
  // Ratios to three places, as ESPN shows them.
  const ratio = stat === 'FG%' || stat === 'FT%'
  const x = ratio ? Math.round(a * 1000) : a
  const y = ratio ? Math.round(b * 1000) : b
  if (x === y) return 'T'
  const better = LOWER_WINS.has(stat) ? x < y : x > y
  return better ? 'W' : 'L'
}

/** The day's score so far, yours first: wins, losses, ties over the categories that have a result. */
export function dayRecord(cats: DayCategory[]): {
  wins: number
  losses: number
  ties: number
} {
  const n = (r: DayResult) => cats.filter((c) => c.result === r).length
  return { wins: n('W'), losses: n('L'), ties: n('T') }
}

/** Bench players who got on the floor that day: their lines counted for nothing. Best scorer first. */
export function benchProduced(rows: PlayerRow[]): PlayerRow[] {
  return rows.filter((r) => isBench(r.spot) && r.line && r.line.minutes > 0).sort((a, b) => b.line!.pts - a.line!.pts)
}

const CHIP_CATS: NightCategory[] = ['FG', 'FT', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO']

const OUT = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION'])

/** A starting slot that gave the team nothing today: empty, held by a player who is out, or one with no game. */
export interface Hole {
  slot: string
  kind: 'empty' | 'out' | 'idle'
  /** Who sits in it; none for an empty slot. */
  name: string | null
}

export interface LeftOnBench {
  row: PlayerRow
  /** The slot he could have filled, when there was one he fits. */
  hole: Hole | null
  /** Other bench players who produced too. */
  more: number
}

/**
 * The bench player whose line most clearly went to waste: he played at least 10 minutes or moved a
 * category by a spread or more. Names a starting slot he fits that gave nothing (empty, OUT, no game,
 * or did not play), so the flag can say what the mistake cost.
 */
export function leftOnBench(rows: PlayerRow[], openSlots: string[]): LeftOnBench | null {
  const produced = benchProduced(rows).filter((r) => {
    const l = r.line!
    const z = categoryScores(l)
    return l.minutes >= 10 || CHIP_CATS.some((c) => c !== 'TO' && z[c] >= 1) || z.PTS >= 1
  })
  if (!produced.length) return null
  const best = produced[0]
  const fits = new Set(best.spot.eligible ?? [])
  const holes: Hole[] = [
    ...openSlots.map((slot) => ({ slot, kind: 'empty' as const, name: null })),
    ...rows
      .filter((r) => r.spot.starting)
      .flatMap((r): Hole[] => {
        if (r.state === 'idle') return [{ slot: r.spot.slot, kind: 'idle', name: r.spot.name }]
        if (
          r.state === 'dnp' ||
          ((r.state === 'later' || r.state === 'live') && !r.line && OUT.has(r.spot.injury_status))
        )
          return [{ slot: r.spot.slot, kind: 'out', name: r.spot.name }]
        return []
      }),
  ]
  return {
    row: best,
    hole: holes.find((h) => fits.has(h.slot)) ?? null,
    more: produced.length - 1,
  }
}

/**
 * The one thing besides points that a line is adding (or costing): the category it moves most, by at
 * least one spread. A drag shows only for shooting and turnovers (0/4 FG, 4 TO): a low count is not
 * news, so nobody reads as bad a few minutes into his game. Never a zero count, never "few turnovers".
 */
export function chipFor(line: GameLine | null): string | null {
  if (!line || line.minutes <= 0) return null
  const z = categoryScores(line)
  const pick = CHIP_CATS.filter((c) => {
    const v = z[c]
    if (Math.abs(v) < 1) return false
    if (c === 'TO') return v < 0
    return v > 0 || c === 'FG' || c === 'FT'
  }).sort((a, b) => Math.abs(z[b]) - Math.abs(z[a]))[0]
  if (!pick) return null
  if (pick === 'FG') return `${line.fgm}/${line.fga} FG`
  if (pick === 'FT') return `${line.ftm}/${line.fta} FT`
  return `${count(line, pick)} ${pick}`
}

function count(l: GameLine, c: NightCategory): number {
  switch (c) {
    case '3PM':
      return l.tpm
    case 'REB':
      return l.reb
    case 'AST':
      return l.ast
    case 'STL':
      return l.stl
    case 'BLK':
      return l.blk
    case 'TO':
      return l.to
    case 'PTS':
      return l.pts
    default:
      return 0
  }
}

/**
 * Short names for both lineups at once: the last name, or the first name when the last is too long
 * to fit a phone column (Antetokounmpo → Giannis), with an initial when two players share it
 * (K. George, P. George).
 */
export function shortNames(names: string[]): Map<string, string> {
  const base = (n: string) => {
    const parts = n.split(' ')
    if (parts.length < 2) return n
    const last = parts.slice(1).join(' ')
    return last.length > 12 ? parts[0] : last
  }
  const seen = new Map<string, number>()
  for (const n of names) seen.set(base(n), (seen.get(base(n)) ?? 0) + 1)
  return new Map(names.map((n) => [n, (seen.get(base(n)) ?? 0) > 1 ? `${n[0]}. ${base(n)}` : base(n)]))
}

/** "C. Gillespie": the desktop table's name, the same form for everyone. */
export function initialName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}
