import { describe, expect, it } from 'vitest'
import type { CrazyBoom, CrazyGame } from '../api/client'
import {
  boomState,
  boomVoice,
  callId,
  horizon,
  lift,
  marks,
  shortName,
  shown,
  skyFloor,
  skyTop,
  stars,
  surpriseTag,
  touches,
  whyWords,
} from './crazyBooms'

const call = (over: Partial<CrazyBoom> = {}): CrazyBoom => ({
  game_id: 1,
  day: 40,
  player: 7,
  name: 'Coby White',
  team: 'CHI',
  opponent: 'CHA',
  home: false,
  tip: '2026-11-28T00:00:00Z',
  stat: 'pts',
  line: 17.5,
  bar: 26,
  ours: 0.12,
  crazy: 0.19,
  beliefs: [{ belief: 'hot', value: 24, push: 0.04 }],
  ...over,
})

const game = (id: number, tip: string, over: Partial<CrazyGame> = {}): CrazyGame => ({
  game_id: id,
  day: 40,
  away: 'MIN',
  home: 'OKC',
  tip,
  final: null,
  ours: { away: 110, home: 108, home_chance: 0.44 },
  crazy: { away: 110, home: 108, home_chance: 0.44 },
  book_home_chance: null,
  swing: 0,
  beliefs: [],
  ...over,
})

describe('boom calls', () => {
  it('names him short and says why in words', () => {
    expect(shortName('Coby White')).toBe('White')
    expect(shortName('Jaren Jackson Jr.')).toBe('Jackson Jr.')
    expect(shortName('Nene')).toBe('Nene')
    const c = call()
    expect(whyWords({ belief: 'hot', value: 24 }, c)).toBe('24.0 points a game over his last 3, on a 17.5 line.')
    expect(whyWords({ belief: 'swings', value: 8.04 }, c)).toBe('His points swing by ±8.0 a night over his last 10.')
    expect(whyWords({ belief: 'minutes', value: 6.2 }, c)).toBe('His minutes swing by ±6.2 a night.')
    expect(whyWords({ belief: 'done_it', value: 17 }, c)).toBe('He had 17 rebounds in one of his last 10.')
  })

  it('keeps the filter’s calls, likeliest first, and speaks for the night', () => {
    const a = call({ player: 1, crazy: 0.1 })
    const b = call({ player: 2, crazy: 0.2, stat: 'reb' })
    expect(shown([a, b], 'all').map((x) => x.player)).toEqual([2, 1])
    expect(shown([a, b], 'pts').map((x) => x.player)).toEqual([1])
    expect(boomVoice([a, b])).toBe('Two players I think blow past their line tonight.')
    expect(
      boomVoice([
        { ...a, boom: true, got: 30 },
        { ...b, boom: false, got: 4 },
      ]),
    ).toBe('1 of my 2 calls went way over.')
    expect(boomVoice([])).toMatch(/No boom calls/)
  })

  it('places games on the horizon in tip order and spreads a game’s calls', () => {
    const late = game(2, '2026-11-28T03:00:00Z')
    const early = game(1, '2026-11-28T00:00:00Z')
    const h = horizon([late, early], [])
    expect(h.order).toEqual([1, 2])
    expect(h.at.get(1)).toBe(0.25)
    const a = call({ player: 1, crazy: 0.19 })
    const b = call({ player: 2, crazy: 0.15, ours: 0.14 })
    const s = stars([a, b], [late, early])
    expect(s.map((x) => x.id)).toEqual([callId(a), callId(b)])
    expect(s[0].x).toBeLessThan(0.25)
    expect(s[1].x).toBeGreaterThan(0.25)
    expect(skyTop([a, b])).toBe(0.2)
    expect(s[0].y).toBeCloseTo(0.9)
    expect(s[1].ours).toBeCloseTo(0.4)
    expect(s.map((x) => x.first)).toEqual([true, false])
    expect(skyFloor([a, b])).toBe(0.1)
    expect(skyTop([call({ crazy: 0.04, ours: 0.03 })])).toBe(0.1)
  })

  it('finds what a belief touches and tags the games that could break', () => {
    const flip = game(1, 'a', {
      crazy: { away: 108, home: 110, home_chance: 0.53 },
      beliefs: [{ belief: 'rivalry', team: 'OKC', points: 2 }],
    })
    const low = game(2, 'b', { beliefs: [{ belief: 'one_man', team: '', points: -1 }] })
    const lean = game(3, 'c', {
      crazy: { away: 110, home: 108.5, home_chance: 0.46 },
      beliefs: [{ belief: 'bounce', team: 'OKC', points: 0.65 }],
    })
    expect(surpriseTag(flip)).toBe('Upset alert')
    expect(surpriseTag(low)).toBe('Low-scoring watch')
    expect(surpriseTag(lean)).toBe('Lean watch')
    expect(touches('rivalry', [call()], [flip, low])).toEqual({ calls: [], games: [1] })
    expect(touches('hot', [call()], [flip])).toEqual({ calls: [callId(call())], games: [] })
  })

  it('reads the booms record honestly', () => {
    const r = {
      nights: 3,
      picks: 15,
      caught: 4,
      expected: 1.9,
      edge: 0.7,
      edge_low: -0.2,
      edge_high: 1.6,
      leading: false,
      by_night: [
        {
          day: 9,
          caught: 1,
          expected: 0.2,
          picks: [{ player: 1, name: 'A', team: 'X', stat: 'pts' as const, ours: 0.2, boom: true }],
        },
      ],
    }
    expect(boomState(null)).toBe('empty')
    expect(boomState({ ...r, nights: 0 })).toBe('empty')
    expect(boomState(r)).toBe('early')
    expect(boomState({ ...r, leading: true, edge_low: 0.1 })).toBe('leading')
    expect(boomState({ ...r, edge_high: -0.1 })).toBe('behind')
    expect(marks(r).map((m) => m.key)).toEqual(['9-1-pts-0'])
    expect(lift(1.1)).toBe('+10%')
    expect(lift(0.9)).toBe('−10%')
    expect(lift(1)).toBe('0%')
  })
})
