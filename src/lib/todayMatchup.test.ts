import { describe, expect, it } from 'vitest'
import type { Game, GameLine, LineupSpot } from '../api/client'
import { buildRows } from './myPlayers'
import type { Totals } from './myPlayers'
import {
  benchProduced,
  categoryValue,
  chipFor,
  dayCategories,
  dayRecord,
  initialName,
  leftOnBench,
  shortNames,
} from './todayMatchup'

const zero: Totals = {
  played: 0,
  on: 0,
  min: 0,
  fgm: 0,
  fga: 0,
  ftm: 0,
  fta: 0,
  tpm: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  to: 0,
  pts: 0,
}
const t = (x: Partial<Totals>): Totals => ({ ...zero, played: 1, ...x })

describe('categoryValue', () => {
  it('leaves a ratio open without attempts', () => {
    expect(categoryValue(t({ fgm: 0, fga: 0 }), 'FG%')).toBeNull()
    expect(categoryValue(t({ fgm: 5, fga: 10 }), 'FG%')).toBe(0.5)
  })
  it('has no counting number before anyone plays', () => {
    expect(categoryValue(zero, 'PTS')).toBeNull()
    expect(categoryValue(t({}), 'PTS')).toBe(0)
  })
})

describe('dayCategories', () => {
  it('scores each category, lower TO winning', () => {
    const mine = t({
      fgm: 13,
      fga: 26,
      ftm: 6,
      fta: 7,
      tpm: 7,
      reb: 14,
      ast: 8,
      stl: 1,
      blk: 0,
      to: 5,
      pts: 39,
    })
    const theirs = t({
      fgm: 12,
      fga: 38,
      ftm: 16,
      fta: 17,
      tpm: 1,
      reb: 20,
      ast: 20,
      stl: 4,
      blk: 1,
      to: 8,
      pts: 41,
    })
    const cats = dayCategories(mine, theirs)
    expect(cats.map((c) => `${c.stat}:${c.result}`)).toEqual([
      'FG%:W',
      'FT%:L',
      '3PM:W',
      'REB:L',
      'AST:L',
      'STL:L',
      'BLK:L',
      'TO:W',
      'PTS:L',
    ])
    expect(dayRecord(cats)).toEqual({ wins: 3, losses: 6, ties: 0 })
  })
  it('ties ratios equal to three places and keeps a one-sided ratio open', () => {
    const cats = dayCategories(t({ fgm: 1, fga: 3, ftm: 2, fta: 2 }), t({ fgm: 2, fga: 6 }))
    expect(cats[0].result).toBe('T')
    expect(cats[1]).toMatchObject({
      stat: 'FT%',
      mine: 1,
      theirs: null,
      result: null,
    })
  })
  it('has no results before anyone plays, and counts nobody as zero after', () => {
    expect(dayCategories(zero, zero).every((c) => c.result === null)).toBe(true)
    const cats = dayCategories(t({ reb: 3, to: 1 }), zero)
    expect(cats.find((c) => c.stat === 'REB')!.result).toBe('W')
    expect(cats.find((c) => c.stat === 'TO')!.result).toBe('L')
  })
})

describe('benchProduced', () => {
  const spot = (id: number, slot: string): LineupSpot => ({
    player_id: id,
    name: `P${id}`,
    pro_team_id: 1,
    slot,
    slot_id: 0,
    starting: slot !== 'BE',
    injury_status: 'ACTIVE',
    game_id: 1,
    eligible: [],
  })
  const line = (id: number, pts: number, minutes = 30): GameLine => ({
    player_id: id,
    name: `P${id}`,
    pro_team_id: 1,
    minutes,
    pts,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tpm: 0,
    to: 0,
    fgm: 0,
    fga: 0,
    ftm: 0,
    fta: 0,
    starter: false,
  })
  const game: Game = {
    id: 1,
    start: '2026-11-15T23:00:00Z',
    status: 'final',
    away: { pro_team_id: 1, abbrev: 'A', name: 'A' },
    home: { pro_team_id: 2, abbrev: 'B', name: 'B' },
    lines: [line(1, 30), line(2, 12), line(3, 28), line(4, 0, 0)],
  }
  it('lists bench players who played, best scorer first', () => {
    const rows = buildRows([spot(1, 'PG'), spot(2, 'BE'), spot(3, 'BE'), spot(4, 'BE')], [game])
    expect(benchProduced(rows).map((r) => r.spot.player_id)).toEqual([3, 2])
  })
})

describe('chipFor, leftOnBench, shortNames', () => {
  const ln = (x: Partial<GameLine>): GameLine => ({
    player_id: 1,
    name: 'P',
    pro_team_id: 1,
    minutes: 30,
    pts: 15,
    reb: 5,
    ast: 4,
    stl: 1,
    blk: 0,
    tpm: 2,
    to: 2,
    fgm: 6,
    fga: 13,
    ftm: 2,
    fta: 2,
    starter: true,
    ...x,
  })
  it('names the biggest non-points category, drags only for shooting and turnovers', () => {
    expect(chipFor(ln({ ast: 9 }))).toBe('9 AST')
    expect(chipFor(ln({ fgm: 0, fga: 8 }))).toBe('0/8 FG')
    expect(chipFor(ln({ to: 6 }))).toBe('6 TO')
    expect(chipFor(ln({ reb: 0 }))).toBeNull()
    expect(chipFor(ln({}))).toBeNull()
    expect(chipFor(null)).toBeNull()
  })
  it('finds the slot a benched scorer could have filled', () => {
    const sp = (id: number, slot: string, extra: Partial<LineupSpot> = {}): LineupSpot => ({
      player_id: id,
      name: `P${id}`,
      pro_team_id: 1,
      slot,
      slot_id: 0,
      starting: slot !== 'BE',
      injury_status: 'ACTIVE',
      game_id: 1,
      eligible: ['UTIL'],
      ...extra,
    })
    const game: Game = {
      id: 1,
      start: '2026-11-15T23:00:00Z',
      status: 'final',
      away: { pro_team_id: 1, abbrev: 'A', name: 'A' },
      home: { pro_team_id: 2, abbrev: 'B', name: 'B' },
      lines: [
        ln({ player_id: 3, pts: 28 }),
        ln({
          player_id: 4,
          pts: 2,
          minutes: 4,
          fgm: 1,
          fga: 2,
          reb: 1,
          ast: 0,
          tpm: 0,
          stl: 0,
          to: 0,
          ftm: 0,
          fta: 0,
        }),
      ],
    }
    const rows = buildRows([sp(1, 'PG', { game_id: null }), sp(3, 'BE'), sp(4, 'BE')], [game])
    expect(leftOnBench(rows, ['UTIL'])).toMatchObject({
      row: { spot: { player_id: 3 } },
      hole: { slot: 'UTIL', kind: 'empty' },
      more: 0,
    })
    expect(leftOnBench(rows, [])!.hole).toBeNull()
  })
  it('shortens names and tells two Georges apart', () => {
    const m = shortNames(['Kyshawn George', 'Paul George', 'Giannis Antetokounmpo', 'Jayson Tatum'])
    expect([...m.values()]).toEqual(['K. George', 'P. George', 'Giannis', 'Tatum'])
    expect(initialName('Collin Gillespie')).toBe('C. Gillespie')
  })
})
