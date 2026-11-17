import { beforeEach, describe, expect, it } from 'vitest'
import type { Game } from '../api/client'
import { band, firstFinal, percent, pick, shortNick, showKey, tally, timesInTen, verdict } from './ourCall'

function game(status: Game['status'], scores: [number | null, number | null], call: [number, number, number] | null) {
  return {
    id: Math.floor(Math.random() * 1e9),
    status,
    away: { pro_team_id: 1, abbrev: 'ORL', name: 'Orlando Magic', score: scores[0] },
    home: { pro_team_id: 2, abbrev: 'DET', name: 'Detroit Pistons', score: scores[1] },
    call: call && { away: call[0], home: call[1], chance: call[2] },
    lines: [],
  } as unknown as Game
}

describe('our call', () => {
  beforeEach(() => localStorage.clear())

  it('bands the whole percent shown', () => {
    expect(percent({ away: 105, home: 117, chance: 0.8449 })).toBe(84)
    expect([80, 79, 65, 64, 55, 54].map(band)).toEqual(['sure', 'likely', 'likely', 'lean', 'lean', 'flip'])
    expect(band(percent({ away: 1, home: 2, chance: 0.795 }))).toBe('sure')
  })

  it('judges the winner pick and the larger single-team miss', () => {
    const called = verdict(game('final', [98, 121], [107, 110, 0.59]))!
    expect(called).toEqual({ called: true, off: 11, misses: [9, 11] })
    expect(verdict(game('final', [121, 117], [113, 114, 0.52]))!.called).toBe(false)
    expect(verdict(game('live', [44, 39], [114, 107, 0.72]))).toBeNull()
    expect(verdict(game('final', [100, 90], null))).toBeNull()
    expect(pick({ away: 113, home: 112, chance: 0.51 })).toBe('away')
  })

  it("tallies the day's finals and says when all are in", () => {
    const games = [
      game('final', [98, 121], [107, 110, 0.59]),
      game('final', [121, 117], [113, 114, 0.52]),
      game('scheduled', [null, null], [105, 117, 0.84]),
    ]
    expect(tally(games)).toEqual({ finals: 2, right: 1, avg: 8, done: false })
    expect(tally(games.slice(0, 2))!.done).toBe(true)
    expect(tally(games.slice(2))).toBeNull()
  })

  it('puts the % in plain numbers', () => {
    expect(timesInTen(59, true)).toBe(6)
    expect(timesInTen(63, false)).toBe(4)
    expect(shortNick('Timberwolves')).toBe('Wolves')
    expect(shortNick('Magic')).toBe('Magic')
  })

  it('draws a verdict once and shows the key on the first three nights', () => {
    expect(firstFinal(7)).toBe(true)
    expect(firstFinal(7)).toBe(false)
    expect(['2026-11-15', '2026-11-16', '2026-11-17'].map(showKey)).toEqual([true, true, true])
    expect(showKey('2026-11-16')).toBe(true)
    expect(showKey('2026-11-18')).toBe(false)
  })
})
