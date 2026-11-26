import { describe, expect, it } from 'vitest'
import type { CrazyGame, CrazyRecord } from '../api/client'
import {
  BELIEFS,
  craziest,
  edge100,
  flips,
  movesWinner,
  nightOf,
  rangeMarks,
  recordState,
  signed,
  steps,
  swingOf,
  totals,
  voice,
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
    expect(voice(game({ crazy: { away: 108, home: 112, home_chance: 0.6 } }))).toBe(
      'I think OKC wins tonight. You don’t.',
    )
    expect(voice(game())).toBe('I like OKC more than you do tonight.')
    expect(voice(null)).toMatch(/Nothing tonight/)
  })

  it('walks from Our call to its own, belief by belief', () => {
    expect(steps(game())).toEqual([
      { label: 'Our call, OKC win chance', value: '44%' },
      { label: 'Rivalry stack', value: '+0.9 pts' },
      { label: 'Slumping strong team', value: '+0.5 pts' },
      { label: 'Crazy One’s call, OKC win chance', value: '49%' },
    ])
    // a belief for the other side counts against the side it moves toward
    const s = steps(game({ beliefs: [...game().beliefs, { belief: 'bounce', team: 'MIN', points: 0.65 }] }))
    expect(s[3]).toEqual({ label: 'Favourite bounce (MIN)', value: '−0.7 pts' })
  })

  it('picks the biggest swing still to come as the craziest call', () => {
    const a = game({ game_id: 1, swing: 0.05 })
    const b = game({ game_id: 2, swing: -0.2, final: [100, 90] })
    const c = game({ game_id: 3, swing: 0.09 })
    const quiet = game({ game_id: 4, swing: 0, beliefs: [] })
    expect(craziest([a, b, c, quiet])?.game_id).toBe(3)
    expect(craziest([b, quiet])?.game_id).toBe(2)
    expect(craziest([quiet])).toBeNull()
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

  it('keeps a total belief out of the winner walk and the craziest pick', () => {
    const shows = { belief: 'one_man', team: '', points: -1 }
    const both = game({ beliefs: [...game().beliefs, shows] })
    expect(steps(both)).toEqual(steps(game()))
    const onlyTotal = game({ game_id: 9, swing: 0, beliefs: [shows], crazy: { away: 110.5, home: 108.8, home_chance: 0.444 } })
    expect(movesWinner(onlyTotal)).toBe(false)
    expect(craziest([onlyTotal])).toBeNull()
    expect(totals(onlyTotal)).toEqual({ ours: 220.3, crazy: 219.3 })
    expect(totals(game())).toBeNull()
  })
})
