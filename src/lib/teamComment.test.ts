import { describe, expect, it } from 'vitest'
import type { TeamResult } from '../api/client'
import { shortName, streakText, teamComment } from './teamComment'
import real from './teamComment.fixture.json'

// Real last-five results (Nov 16), most recent first, as /api/nba-team sends them.
const LAST5 = real as Record<string, TeamResult[]>

let id = 0
function game(won: boolean, by: number, home = true, opponent = 'UTAH', top = 'Nikola Jokić', pts = 30): TeamResult {
  id += 1
  return {
    game_id: id,
    date: null,
    start: '',
    home,
    opponent,
    opponent_name: '',
    points: won ? 110 + by : 110,
    opponent_points: won ? 110 : 110 + by,
    won,
    top: { player_id: [...top].reduce((h, c) => h * 31 + c.charCodeAt(0), 7), name: top, pts, reb: 5, ast: 5 },
  }
}
/** Oldest first, in the order written, then flipped to the API's most-recent-first. */
const api = (...games: TeamResult[]) => [...games].reverse()

describe('team comment', () => {
  // SA won by 8 twice: a tie goes to the latest game.
  it('reads real runs in one sentence', () => {
    expect(teamComment(LAST5.DEN)).toBe('Won 4 of 5, the only loss by 10 at Houston, with Jokic their top scorer in 3.')
    expect(teamComment(LAST5.SA)).toBe('Won all 5, the closest by 8 at Utah, with Wembanyama their top scorer in 3.')
    expect(teamComment(LAST5.MIL)).toBe("Lost all 5, the closest by 7 to Atlanta, with Kuzma's 27 their best night.")
    expect(teamComment(LAST5.GS)).toBe('Won 3 of 5 but dropped the last 2, with Curry their top scorer in 3.')
    expect(teamComment(LAST5.OKC)).toBe(
      'Lost 3 of 5, the worst by 20 at Portland, with Gilgeous-Alexander their top scorer every game.',
    )
  })

  it('a mixed run that ends the way it went', () => {
    const g = api(game(false, 3), game(false, 6), game(true, 2), game(true, 9), game(true, 1))
    expect(teamComment(g)).toMatch(/^Won 3 of 5, the last 3 in a row, /)
  })

  it('a split run with no streak names the biggest result', () => {
    const g = api(game(true, 3), game(false, 4), game(true, 12, false, 'LAL'), game(false, 6), game(true, 2))
    expect(teamComment(g)).toMatch(/^Won 3 of 5, the biggest by 12 at the Lakers, /)
  })

  it('fewer than five games', () => {
    expect(teamComment([])).toBeNull()
    expect(teamComment(api(game(true, 9, true, 'UTAH')))).toBe('Won their first game by 9 over Utah.')
    expect(teamComment(api(game(true, 5), game(true, 2, false, 'NY')))).toMatch(
      /^Won both, the closest by 2 at New York, /,
    )
    expect(teamComment(api(game(true, 5), game(false, 2), game(true, 1)))).toMatch(
      /^Won 2 of 3, the only loss by 2 to Utah, /,
    )
  })

  it('skips a level score: a box still missing lines', () => {
    const level = { ...game(true, 1), points: 100, opponent_points: 100 }
    expect(teamComment([level, ...api(game(false, 4))])).toBe('Lost their first game by 4 to Utah.')
  })

  it('names a scorer by last name unless a teammate shares it', () => {
    expect(shortName('Jaren Jackson Jr.', ['Jaren Jackson Jr.'])).toBe('Jackson')
    expect(shortName('Jaylen Brown', ['Jaylen Brown', 'Bruce Brown'])).toBe('Jaylen Brown')
    const g = api(game(true, 3, true, 'MIA', 'Jaylen Brown'), game(true, 4, true, 'MIA', 'Jaylen Brown'))
    expect(teamComment([...g, ...api(game(true, 1, true, 'MIA', 'Jaylen Brown'))], ['Bruce Brown'])).toContain(
      'with Jaylen Brown their top scorer every game',
    )
  })

  it('says the streak in words', () => {
    expect(streakText('W2')).toBe('Won 2 straight')
    expect(streakText('L12')).toBe('Lost 12 straight')
    expect(streakText('W1')).toBe('Won the last game')
    expect(streakText(null)).toBeNull()
  })
})
