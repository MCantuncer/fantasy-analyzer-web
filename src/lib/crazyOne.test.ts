import { describe, expect, it } from 'vitest'
import type { CrazyGame, CrazyRecord } from '../api/client'
import {
  BELIEFS,
  edge100,
  flips,
  movesWinner,
  nightOf,
  rangeMarks,
  recordState,
  signed,
  swingOf,
  totals,
} from './crazyOne'

function game(over: Partial<CrazyGame> = {}): CrazyGame {
  return {
    game_id: 1,
    day: 37,
    away: 'MIN',
    home: 'OKC',
    tip: '2026-11-26T01:30:00Z',
    final: null,
    ours: { away: 111, home: 109.3, home_chance: 0.444 },
    crazy: { away: 110.2, home: 110.1, home_chance: 0.49 },
    book_home_chance: 0.558,
    swing: 0.046,
    beliefs: [
      { belief: 'rivalry', team: 'OKC', points: 0.92 },
      { belief: 'slump', team: 'OKC', points: 0.5 },
    ],
    ...over,
  }
}

const record = (over: Partial<CrazyRecord> = {}): CrazyRecord => ({
  games: 0,
  crazy_hits: 0,
  ours_hits: 0,
  edge: null,
  edge_low: null,
  edge_high: null,
  leading: false,
  bold: [],
  ...over,
})

describe('crazy one words', () => {
  it('signs with a true minus', () => {
    expect(signed(1.44)).toBe('+1.4')
    expect(signed(-0.6)).toBe('−0.6')
    expect(signed(0.01)).toBe('0.0')
  })

  it('names the side it moves toward', () => {
    expect(swingOf(game())).toEqual({ team: 'OKC', per100: 4.6 })
    expect(swingOf(game({ swing: -0.12 })).team).toBe('MIN')
  })

  it('says when it picks the other winner', () => {
    expect(flips(game())).toBe(false)
    expect(flips(game({ crazy: { away: 108, home: 112, home_chance: 0.6 } }))).toBe(true)
  })

  it('reads the record honestly', () => {
    expect(recordState(record())).toBe('empty')
    expect(recordState(record({ games: 4, edge: 0.01, edge_low: -0.02, edge_high: 0.04 }))).toBe('early')
    expect(recordState(record({ games: 60, edge: 0.03, edge_low: 0.01, edge_high: 0.05, leading: true }))).toBe(
      'leading',
    )
    expect(recordState(record({ games: 60, edge: -0.03, edge_low: -0.05, edge_high: -0.01 }))).toBe('behind')
  })

  it('places the range around zero', () => {
    expect(rangeMarks(record())).toBeNull()
    const m = rangeMarks(record({ games: 4, edge: 0.01, edge_low: -0.02, edge_high: 0.04 }))!
    expect(m.zero).toBe(50)
    expect(m.low).toBeLessThan(50)
    expect(m.high).toBeGreaterThan(m.edge)
    expect(m.high).toBeLessThanOrEqual(100)
    expect(edge100(0.0123)).toBe('+1.2')
    expect(edge100(null)).toBe('–')
  })

  it('dates a night by its US game date', () => {
    expect(nightOf([game()])).toBe('Wed 25 Nov')
    expect(nightOf([])).toBe('')
  })

  it('keeps the doubled starters out of its beliefs', () => {
    expect(BELIEFS.map((b) => b.key)).toEqual(['rivalry', 'bounce', 'slump', 'tank', 'one_man'])
  })

  it('keeps a total belief apart from the winner', () => {
    const shows = { belief: 'one_man', team: '', points: -1 }
    const onlyTotal = game({ game_id: 9, swing: 0, beliefs: [shows], crazy: { away: 110.5, home: 108.8, home_chance: 0.444 } })
    expect(movesWinner(onlyTotal)).toBe(false)
    expect(totals(onlyTotal)).toEqual({ ours: 220.3, crazy: 219.3 })
    expect(totals(game())).toBeNull()
  })
})
