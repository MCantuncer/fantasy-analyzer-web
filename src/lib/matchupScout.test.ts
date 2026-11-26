import { describe, expect, it } from 'vitest'
import type { ManagerStyles } from '../api/client'
import fixture from './managerStyles.fixture.json'
import { edge, gamePlan, matchBoard, matchHeadline, signed, weeksIn } from './matchupScout'

const data = fixture as unknown as ManagerStyles
const them = data.teams.find((t) => t.team_id === data.matchup!.opponent_id)!

describe('matchBoard', () => {
  const board = matchBoard(data, them)
  it('bands the calls in the site order', () => {
    expect(board.map((c) => c.cat)).toEqual(['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'])
    const band = (b: string) => board.filter((c) => c.band === b).map((c) => c.cat)
    expect(band('hold')).toEqual(['FG%', '3PM', 'TO', 'PTS'])
    expect(band('go')).toEqual(['REB', 'BLK'])
    expect(band('let_go')).toEqual(['FT%', 'AST', 'STL'])
  })
  it('signs our margin so + is good, with TO lower-wins', () => {
    const at = (cat: string) => board.find((c) => c.cat === cat)!
    expect(at('FG%').margin).toBe('+.079')
    expect(at('FG%').totals).toBe('.562 · .483')
    expect(at('TO').margin).toBe('+15')
    expect(at('REB').margin).toBe('−13')
    expect(at('BLK').margin).toBe('±0')
    expect(at('BLK').theirWon).toBe(0)
  })
})

describe('matchHeadline and gamePlan', () => {
  const board = matchBoard(data, them)
  it('says the plan and the score if it lands', () => {
    expect(matchHeadline(board)).toEqual({
      plan: 'Hold the four we lead,',
      go: 'flip REB and BLK.',
      result: "That's 6–3 if both land.",
    })
  })
  it('gives three plays: chase the flips, keep TO clean, stop paying for the rest', () => {
    const plays = gamePlan(board)
    expect(plays.map((p) => p.title)).toEqual([
      'Start a big with games left',
      'Keep TO clean',
      "Don't chase FT%, AST and STL",
    ])
    expect(plays[1].body).toContain('a category they never win')
    expect(plays[2].body).toBe('FT% is theirs most weeks. Every add there is one not spent on REB and BLK.')
  })
  it('speaks in plain category names before any stats exist', () => {
    const early = matchBoard(
      {
        ...data,
        matchup: {
          ...data.matchup!,
          calls: data.matchup!.calls.map((c) => ({
            ...c,
            mine: null,
            theirs: null,
            status: 'not_started' as const,
          })),
        },
      },
      them,
    )
    expect(early[0].margin).toBe('–')
    expect(matchHeadline(early).plan).toBe('Hold FG%, 3PM, TO and PTS,')
  })
})

describe('helpers', () => {
  it('reads edges and weeks', () => {
    expect(edge({ cat: 'TO', mine: 10, theirs: 14 })).toBe(4)
    expect(signed('FT%', -0.0142)).toBe('−.014')
    expect(weeksIn(4, 5)).toBe('4 weeks in 5')
    expect(weeksIn(0, 5)).toBe('never')
    expect(weeksIn(5, 5)).toBe('every week')
  })
})
