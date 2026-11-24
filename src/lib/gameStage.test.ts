import { describe, expect, it } from 'vitest'
import type { CompareGame } from './iddaaCompare'
import { quarterBets } from './quarterBets.fixture'
import {
  bestEdge,
  chosenGame,
  duelReach,
  edgeTag,
  openingGame,
  phaseOf,
  pos,
  scaleAround,
  slateGroups,
  slateOrder,
} from './gameStage'

const NOW = new Date('2026-11-24T02:00:00Z')
const g = (id: number, status: CompareGame['status'], tip: string, over: Partial<CompareGame> = {}): CompareGame => ({
  game_id: id,
  away: 'MIL',
  home: 'PHI',
  tip,
  checked: '',
  status,
  away_score: status === 'final' ? 100 : null,
  home_score: status === 'final' ? 110 : null,
  markets: [],
  players: [],
  ...over,
})

describe('the slate', () => {
  const night = [
    g(1, 'scheduled', '2026-11-24T03:00:00Z'),
    g(2, 'final', '2026-11-24T00:00:00Z'),
    g(3, 'scheduled', '2026-11-24T01:30:00Z'), // tipped, the feed still says scheduled
    g(4, 'scheduled', '2026-11-24T02:30:00Z'),
  ]

  it('reads each match as Final, Live or To come', () => {
    expect(night.map((x) => phaseOf(x, NOW))).toEqual(['next', 'final', 'live', 'next'])
    // final without a score stays live
    expect(phaseOf(g(5, 'final', '2026-11-24T00:00:00Z', { home_score: null }), NOW)).toBe('live')
  })

  it('groups Final, Live, To come, each in the night order, and drops empty groups', () => {
    expect(slateGroups(night, NOW).map((s) => [s.phase, s.games.map((x) => x.game_id)])).toEqual([
      ['final', [2]],
      ['live', [3]],
      ['next', [1, 4]],
    ])
    expect(slateOrder(night, NOW).map((x) => x.game_id)).toEqual([2, 3, 1, 4])
    expect(slateGroups([night[0]], NOW).map((s) => s.phase)).toEqual(['next'])
  })

  it('opens on the next to tip, else the live one, else the first with a quarter edge', () => {
    expect(openingGame(night, NOW)).toBe(4)
    expect(openingGame([night[1], night[2]], NOW)).toBe(3)
    const flat = quarterBets(true).map((b) => ({ ...b, edge: -0.1 }))
    const finals = [g(6, 'final', 'x', { quarters: flat }), g(7, 'final', 'x', { quarters: quarterBets(true) })]
    expect(openingGame(finals, NOW)).toBe(7)
    expect(openingGame([finals[0]], NOW)).toBe(6)
    expect(openingGame([], NOW)).toBeNull()
  })

  it('keeps the match from the URL when it is on the slate', () => {
    expect(chosenGame(night, 1, NOW)).toBe(1)
    expect(chosenGame(night, 99, NOW)).toBe(4)
    expect(chosenGame(night, null, NOW)).toBe(4)
  })

  it('tags the best quarter value', () => {
    expect(bestEdge(quarterBets(false))).toBe(0.11)
    expect(bestEdge(undefined)).toBeNull()
    expect(edgeTag(0.13)).toBe('+0.13')
  })
})

describe('the number lines', () => {
  it('centres a line on the book with room for every value', () => {
    expect(scaleAround(226.5, [230, null], 8)).toEqual({ lo: 218.5, hi: 234.5 })
    const s = scaleAround(0, [10, -2], 4)
    expect(s.hi).toBeCloseTo(13.5)
    expect(pos(10, s.lo, s.hi)).toBeLessThan(97)
  })

  it('keeps a mark inside the line', () => {
    expect(pos(50, 0, 10)).toBe(97)
    expect(pos(-5, 0, 10)).toBe(3)
    expect(pos(5, 0, 10)).toBe(50)
    expect(pos(1, 1, 1)).toBe(50)
  })

  it('reaches 20 points each side of the duel, or the next 5 past the widest margin', () => {
    expect(duelReach(8, null, 6.5)).toBe(20)
    expect(duelReach(-24)).toBe(25)
    expect(duelReach(19.5)).toBe(25)
  })
})
