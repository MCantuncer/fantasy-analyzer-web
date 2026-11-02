import { describe, expect, it } from 'vitest'
import type { MatchupSide } from '../api/client'
import { boxOrder, flipHint, formatStat, initials, isClose, teamColours, tonightMatchup } from './league'

type Cat = [string, number, 'W' | 'L' | 'T']

function side(teamId: number, cats: Cat[], left: number | null = null): MatchupSide {
  const count = (r: string) => cats.filter((c) => c[2] === r).length
  return {
    team_id: teamId,
    wins: count('W'),
    losses: count('L'),
    ties: count('T'),
    categories: cats.map(([stat, value, result]) => ({ stat, value, result })),
    games: left == null ? null : { today: left, left, total: 40 },
  }
}

// Week 2 of the reference league: you 4-5 against Los Avokados.
const ME: Cat[] = [
  ['FT%', 0.7266, 'L'],
  ['REB', 212, 'L'],
  ['PTS', 562, 'L'],
  ['BLK', 30, 'W'],
  ['STL', 29, 'L'],
  ['AST', 165, 'W'],
  ['3PM', 39, 'L'],
  ['FG%', 0.4977, 'W'],
  ['TO', 67, 'W'],
]
const THEM: Cat[] = [
  ['FT%', 0.7456, 'W'],
  ['REB', 237, 'W'],
  ['PTS', 740, 'W'],
  ['BLK', 23, 'L'],
  ['STL', 54, 'W'],
  ['AST', 140, 'L'],
  ['3PM', 70, 'W'],
  ['FG%', 0.4739, 'L'],
  ['TO', 76, 'L'],
]
const flip = (r: 'W' | 'L' | 'T') => (r === 'W' ? 'L' : r === 'L' ? 'W' : 'T')
const mirror = (cats: Cat[]): Cat[] => cats.map(([s, v, r]) => [s, v, flip(r)])

describe('team identity', () => {
  it('gives your team the accent and everyone else a stable slot by team id', () => {
    const c = teamColours([8, 3, 1, 10], 3)
    expect(c.get(3)).toBe('var(--accent)')
    expect([c.get(1), c.get(8), c.get(10)]).toEqual(['var(--team-0)', 'var(--team-1)', 'var(--team-2)'])
    expect(teamColours([10, 8, 1], 3).get(8)).toBe('var(--team-1)')
  })

  it('makes two-letter crests', () => {
    expect(initials('Kucukesat Aspavas')).toBe('KA')
    expect(initials("Jze's Scary Team")).toBe('JS')
    expect(initials('Çayyolu Bastards')).toBe('ÇB')
    expect(initials('BDMS')).toBe('BD')
    expect(initials('  ')).toBe('?')
  })
})

describe('box score', () => {
  it('orders categories the way ESPN does and formats them', () => {
    expect(boxOrder(side(3, ME).categories!).map((c) => c.stat)).toEqual([
      'PTS',
      'REB',
      'AST',
      'STL',
      'BLK',
      '3PM',
      'FG%',
      'FT%',
      'TO',
    ])
    expect(formatStat('FG%', 0.49768)).toBe('.498')
    expect(formatStat('PTS', 562.4)).toBe('562')
  })

  it('calls a category close when it could still flip', () => {
    expect(isClose('FT%', 0.7266, 0.7456)).toBe(true)
    expect(isClose('FG%', 0.4977, 0.4739)).toBe(false)
    expect(isClose('REB', 212, 237)).toBe(true)
    expect(isClose('PTS', 562, 740)).toBe(false)
  })
})

describe('flip hint', () => {
  it('names the close categories that would win a 4-5 week', () => {
    expect(flipHint(side(3, ME), side(7, THEM))).toBe('Flip REB or FT% to win 5-4-0')
  })

  it('says when the other side has no games left', () => {
    expect(flipHint(side(3, ME, 4), side(7, THEM, 0))).toBe(
      "They're done for the week. Your 4 games left can flip REB or FT% to win 5-4-0",
    )
  })

  it('counts ties: at 3-4-2 one tied category levels it', () => {
    const cats: Cat[] = [
      ['PTS', 600, 'W'],
      ['REB', 200, 'W'],
      ['AST', 150, 'W'],
      ['STL', 30, 'L'],
      ['BLK', 10, 'L'],
      ['3PM', 40, 'L'],
      ['FG%', 0.4, 'L'],
      ['FT%', 0.8, 'T'],
      ['TO', 60, 'T'],
    ]
    const them: Cat[] = mirror(cats).map(([s, v, r]) => [
      s,
      s === 'STL' ? 90 : s === 'BLK' ? 40 : s === '3PM' ? 99 : s === 'FG%' ? 0.5 : v,
      r,
    ])
    expect(flipHint(side(3, cats), side(7, them))).toBe('Flip FT% or TO to level it at 4-4-1')
  })

  it('stays quiet at the start of a week when every category is 0-0', () => {
    const empty: Cat[] = ME.map(([s]) => [s, 0, 'T'])
    expect(flipHint(side(3, empty), side(7, empty))).toBeNull()
  })

  it('skips categories still at 0-0 once the week is under way', () => {
    const cats: Cat[] = [
      ['PTS', 300, 'W'],
      ['REB', 120, 'W'],
      ['AST', 80, 'W'],
      ['STL', 12, 'T'],
      ['BLK', 0, 'T'],
      ['3PM', 20, 'L'],
      ['FG%', 0.4, 'L'],
      ['FT%', 0.7, 'L'],
      ['TO', 50, 'L'],
    ]
    const them: Cat[] = cats.map(([s, v, r]) => [
      s,
      r === 'T' ? v : s === '3PM' ? 40 : s === 'FG%' ? 0.5 : s === 'FT%' ? 0.9 : s === 'TO' ? 30 : v / 2,
      r === 'W' ? 'L' : r === 'L' ? 'W' : 'T',
    ])
    expect(flipHint(side(3, cats), side(7, them))).toBe('Flip STL to level it at 4-4-1')
  })

  it('stays quiet when nothing in reach changes the result', () => {
    const far: Cat[] = ME.map(([s, v, r]) => [s, v, r])
    const them = THEM.map(([s, v, r]): Cat => [s, s === 'REB' ? 400 : s === 'FT%' ? 0.9 : v, r])
    expect(flipHint(side(3, far), side(7, them))).toBeNull()
  })

  it('tells a narrow leader which close categories to hold', () => {
    expect(flipHint(side(7, mirror(ME)), side(3, mirror(THEM)))).toBe('Hold REB and FT% to keep the win')
  })
})

describe('tonight matchup', () => {
  it('finds your opponent and the hint from either side of the matchup', () => {
    const overview = {
      teams: [
        { id: 3, name: 'Kucukesat Aspavas' },
        { id: 7, name: 'Los Avokados' },
      ],
      matchups: [{ home: side(7, THEM, 0), away: side(3, ME, 4) }],
    } as unknown as Parameters<typeof tonightMatchup>[0]
    expect(tonightMatchup(overview, 3)).toEqual({
      opponentId: 7,
      opponentName: 'Los Avokados',
      hint: "They're done for the week. Your 4 games left can flip REB or FT% to win 5-4-0",
    })
    expect(tonightMatchup(overview, 5)).toBeNull()
    expect(tonightMatchup(overview, null)).toBeNull()
  })
})
