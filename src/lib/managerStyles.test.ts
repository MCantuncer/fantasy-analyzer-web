import { describe, expect, it } from 'vitest'
import type { ManagerStyleRow, ManagerStyles } from '../api/client'
import { inOrder, listCats, lookFor, partnerLine, pathBoard, swingGain, weeksWon } from './managerStyles'

const cats = (shares: Record<string, number>) =>
  Object.entries(shares).map(([cat, s]) => ({ cat, won: s * 5, weeks: 5 }))

const me = {
  team_id: 3,
  categories: cats({ PTS: 0, BLK: 1, 'FG%': 1, AST: 0.6, TO: 0.6, 'FT%': 0.6, REB: 0.2, STL: 0.2, '3PM': 0.2 }),
} as unknown as ManagerStyleRow

const data = {
  win_path: {
    lock: ['BLK', 'FG%'],
    swing: ['FT%', 'TO', 'AST'],
    let_go: ['REB', '3PM', 'STL', 'PTS'],
    adds_bring: [],
    adds_should_bring: [],
  },
} as unknown as ManagerStyles

describe('pathBoard', () => {
  it('keeps the site category order and bands each category', () => {
    const board = pathBoard(data, me)
    expect(board.map((c) => c.cat)).toEqual(['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'])
    expect(board.filter((c) => c.band === 'lock').map((c) => c.cat)).toEqual(['FG%', 'BLK'])
    expect(board.find((c) => c.cat === 'PTS')?.band).toBe('let_go')
  })

  it('values the swing at three categories from 60% to 80%', () => {
    expect(swingGain(pathBoard(data, me))).toBeCloseTo(0.6)
  })
})

describe('text helpers', () => {
  it('counts a tie as half a week', () => {
    expect(weeksWon(2.5, 5)).toBe('2.5 of 5')
    expect(weeksWon(3, 5)).toBe('3 of 5')
  })
  it('joins categories in plain English', () => {
    expect(listCats(['FT%', 'AST', 'TO'])).toBe('FT%, AST and TO')
    expect(listCats(['BLK'])).toBe('BLK')
  })
})

describe('inOrder and lookFor', () => {
  it('puts categories in the site order', () => {
    expect(inOrder(['TO', 'FT%', 'AST'])).toEqual(['FT%', 'AST', 'TO'])
    expect(inOrder(['STL', 'FG%'])).toEqual(['FG%', 'STL'])
  })
  it('never asks an add to bring turnovers', () => {
    expect(lookFor(['FT%', 'AST', 'TO'])).toBe('Look for FT% and AST, without the turnovers.')
    expect(lookFor(['REB'])).toBe('Look for REB.')
    expect(lookFor(['TO'])).toBe('Look for adds that keep the turnovers down.')
  })
})

describe('partnerLine', () => {
  const base = {
    activity: 'steady_hands',
    lineup: 'sharp',
    door: 'unknown',
    declined: 0,
    trades: 0,
    missed_starts: 0,
    starts_per_week: 38,
    chases: ['STL', '3PM'],
  } as unknown as ManagerStyleRow
  it('says what matters most for a trade', () => {
    expect(partnerLine({ ...base, door: 'closed', declined: 2 })).toBe('Door closed · declined 2, never traded')
    expect(partnerLine({ ...base, door: 'open', trades: 1 })).toBe('Steady hands · door open, traded 1')
    expect(partnerLine({ ...base, lineup: 'leaks_starts', missed_starts: 8 })).toBe(
      'Steady hands · leaks starts, 8 missed',
    )
    expect(partnerLine(base)).toBe('Steady hands · chases 3PM and STL')
    expect(partnerLine({ ...base, chases: [] })).toBe('Steady hands')
  })
})
