import { describe, expect, it } from 'vitest'
import type { RecordBucket, RecordLeg, RecordNight, RecordPicks } from './iddaaCompare'
import {
  EARLY_NIGHTS,
  bandName,
  bandsOf,
  calNote,
  calRows,
  dateOfDay,
  ledgerOf,
  ledgerPlayers,
  losingRun,
  oftenText,
  totalsOf,
  withoutBiggest,
} from './rungRecord'

const pick = (stat: string, from: number, to: number | null, picks: number, hits: number, said: number, net: number): RecordPicks => ({
  stat,
  odds_from: from,
  odds_to: to,
  picks,
  hits,
  said,
  net,
})
const night = (day: number, picks: number, hits: number, net: number, top: number | null = null, settled = true): RecordNight => ({
  day,
  settled,
  picks,
  hits,
  net,
  marked: picks * 0.15,
  players: Math.ceil(picks / 2),
  top_hit: top,
})
const KNOWN = [
  { day: 31, date: '2026-11-19', games: 6 },
  { day: 32, date: '2026-11-20', games: 4 },
  { day: 33, date: '2026-11-21', games: 5 },
]

describe('odds bands', () => {
  it('names bands from 1.33 up, with an open top', () => {
    expect(bandName(1.33, 1.6)).toBe('1.33–1.6')
    expect(bandName(12, null)).toBe('12+')
  })
  it('reads the server’s all rows, shortest odds first, and turns said back into a count', () => {
    const bands = bandsOf([
      pick('pts', 1.33, 1.6, 10, 8, 0.8, 1),
      pick('all', 12, null, 8, 1, 0.125, 6.2),
      pick('all', 1.33, 1.6, 30, 23, 0.76, 2.66),
    ])
    expect(bands.map((b) => b.name)).toEqual(['1.33–1.6', '12+'])
    const tot = totalsOf(bands)
    expect(tot).toMatchObject({ picks: 38, hits: 24, net: 8.86 })
    expect(tot.said).toBeCloseTo(23.8, 6) // 0.76·30 + 0.125·8
    expect(tot.perUnit).toBeCloseTo(8.86 / 38, 6)
  })
  it('sums the stat rows, weighting said by picks, when no all rows come', () => {
    const [b] = bandsOf([pick('pts', 2.5, 5, 10, 3, 0.3, -1), pick('reb', 2.5, 5, 30, 10, 0.4, 2)])
    expect(b).toMatchObject({ picks: 40, hits: 13, net: 1 })
    expect(b.said).toBeCloseTo(0.375, 6)
  })
  it('k in 10, or 1 in N under 15%', () => {
    expect(oftenText(0.76)).toBe('8 in 10')
    expect(oftenText(0.44)).toBe('4 in 10')
    expect(oftenText(0.15)).toBe('2 in 10')
    expect(oftenText(0.125)).toBe('1 in 8')
    expect(oftenText(0.096)).toBe('1 in 10')
    expect(oftenText(0)).toBe('none')
    expect(oftenText(1)).toBe('10 in 10')
  })
})

describe('the ledger from the series', () => {
  it('places days by any known date', () => {
    expect(dateOfDay(33, KNOWN)).toBe('2026-11-21')
    expect(dateOfDay(22, KNOWN)).toBe('2026-11-10')
    expect(dateOfDay(22, [])).toBeNull()
  })
  it('keeps settled nights in order, marks a known night the record skipped, and runs the balance', () => {
    const l = ledgerOf([night(30, 16, 7, 12.8, 14.2), night(32, 0, 0, 0), night(33, 19, 10, 9.06, 6.27), night(34, 9, 0, 0, null, false)], KNOWN)
    expect(l.map((n) => `${n.label}:${n.kind}:${n.balance}`)).toEqual([
      'Wed 18:night:12.8',
      'Thu 19:none:12.8',
      'Fri 20:empty:12.8',
      'Sat 21:night:21.86',
    ])
  })
  it('names a night by its day when no date is known, and is empty without a series', () => {
    expect(ledgerOf([night(5, 3, 1, -1)])[0].label).toBe('Day 5')
    expect(ledgerOf(undefined)).toEqual([])
    expect(ledgerOf([])).toEqual([])
  })
  it('without the biggest hit takes odds − 1 off the balance', () => {
    const l = ledgerOf([night(30, 16, 7, 12.8, 14.2), night(33, 19, 10, 9.06, 6.27)], KNOWN)
    expect(withoutBiggest(l, 4.21)).toEqual({ net: -8.99, odds: 14.2 })
    expect(withoutBiggest(ledgerOf([night(30, 4, 0, -4)], KNOWN), -4)).toBeNull()
  })
  it('shades only a run of three or more losing nights; an empty night breaks it', () => {
    const l = ledgerOf(
      [night(20, 5, 1, -1), night(21, 5, 1, -2), night(22, 5, 1, -3), night(23, 5, 3, 2), night(24, 5, 1, -1), night(25, 0, 0, 0), night(26, 5, 1, -1), night(27, 5, 1, -1)],
      [{ day: 20, date: '2026-11-08', games: 5 }],
    )
    expect(losingRun(l)).toEqual({ from: 0, to: 2, net: -6 })
    expect(losingRun(l.slice(3))).toBeNull()
  })
})

describe('said vs happened', () => {
  const b = (side: 'ours' | 'book', from: number, to: number, said: number, happened: number, rungs = 400): RecordBucket => ({
    side,
    chance_from: from,
    chance_to: to,
    rungs,
    said,
    happened,
  })
  const buckets = [
    b('book', 0.4, 0.5, 0.45, 0.37),
    b('ours', 0.4, 0.5, 0.45, 0.43),
    b('ours', 0, 0.1, 0.05, 0.05),
    b('book', 0, 0.1, 0.05, 0.03),
    b('ours', 0.7, 1, 0.78, 0.76),
    b('book', 0.7, 1, 0.78, 0.72),
  ]
  it('pairs the two sides by bucket, lowest first', () => {
    const rows = calRows(buckets)
    expect(rows.map((r) => r.label)).toEqual(['0–10%', '40–50%', '70%+'])
    expect(rows[1].ours?.happened).toBe(0.43)
    expect(rows[1].book?.happened).toBe(0.37)
    expect(rows[1].said).toBeCloseTo(0.45, 6)
  })
  it('writes the note from the buckets only', () => {
    expect(calNote(calRows(buckets))).toBe(
      'The book’s overs came in less often than it said in every bucket. Ours sit nearer the tick so far: off by 1 point on average, the book’s by 5.',
    )
    expect(calNote(calRows(buckets.slice(0, 2)))).toBeNull() // too few buckets to say anything
  })
  it('the early read lasts two weeks', () => {
    expect(EARLY_NIGHTS).toBe(14)
  })
})

describe('ledgerPlayers', () => {
  const leg = (name: string, id: number, stat: string, n: number, odd: number, actual: number): RecordLeg => ({
    name,
    player_id: id,
    team: 7,
    stat,
    n,
    odd,
    ours: 0.5,
    hit: actual >= n,
    actual,
  })
  it('groups a night by player, best night first, ladders in stat order and rungs low to high', () => {
    const got = ledgerPlayers([
      leg('Nikola Jokić', 1, 'ast', 10, 2.05, 9),
      leg('Nikola Jokić', 1, 'pts', 30, 1.95, 31),
      leg('Nikola Jokić', 1, 'pts', 25, 1.42, 31),
      leg('Nikola Jokić', 1, 'pts', 35, 3.4, 31),
      leg('Jayson Tatum', 2, 'three_pm', 3, 1.9, 4),
    ])
    expect(got.map((p) => [p.name, p.net])).toEqual([
      ['Jayson Tatum', 0.9],
      ['Nikola Jokić', -0.63], // +0.42 +0.95 −1 −1
    ])
    const [pts, ast] = got[1].ladders
    expect(pts.stat).toBe('pts')
    expect(pts.rungs.map((r) => r.n)).toEqual([25, 30, 35])
    expect([pts.got, pts.reached]).toEqual([31, 2])
    expect([ast.stat, ast.got, ast.reached]).toEqual(['ast', 9, 0])
  })
  it('a night the server sent no picks for has no players', () => {
    expect(ledgerPlayers([])).toEqual([])
  })
})
