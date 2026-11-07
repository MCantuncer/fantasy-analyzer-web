import { describe, expect, it } from 'vitest'
import type { TradeOfTheDay, TradeSide } from '../api/client'
import { gainTiles, shareText } from './tradeOfTheDay'

function side(team_name: string, sends: string[], before: number, after: number): TradeSide {
  return {
    team_id: team_name.length,
    team_name,
    abbrev: team_name.slice(0, 3).toUpperCase(),
    sends: sends.map((name, i) => ({
      id: i,
      name,
      pro_team: '',
      positions: ['PG'],
      injury_status: 'ACTIVE',
      percent_owned: 90,
      value: 1,
      perceived_value: 10,
      tier: 'tradeable' as const,
      injury_prone: false,
      owner_premium: 0,
    })),
    cats_gain: 0.1,
    category_changes: {},
    punts: [],
    acceptance: 0.5,
    acceptance_label: 'possible',
    pitch: '',
    reasons: [],
    playoff_pct_before: before,
    playoff_pct_after: after,
  }
}

describe('trade of the day', () => {
  it('puts every category gain in one list, biggest first, with its rank and per-game change', () => {
    const s = {
      ...side('Boomers', ['A'], 0.7, 0.71),
      category_changes: { STL: 0.19, 'FG%': 0.09, TO: 0.05, PTS: 0.01, '3PM': -0.07 },
      pitch_needs: [{ category: 'STL', league_rank: 9, per_game: 1.7 }],
      gains: [
        { category: 'STL', league_rank: 9, per_game: 1.7 },
        { category: 'FG%', league_rank: 3, per_game: null },
        { category: 'TO', league_rank: 6, per_game: 0.6 },
      ],
    }
    expect(gainTiles(s)).toEqual([
      { category: 'STL', pts: 19, rank: 9, perGame: 1.7 },
      { category: 'FG%', pts: 9, rank: 3, perGame: null },
      { category: 'TO', pts: 5, rank: 6, perGame: 0.6 },
    ])
  })

  it('still shows the gains of an older pick without ranks for them', () => {
    const s = { ...side('Boomers', ['A'], 0.7, 0.71), category_changes: { AST: 0.3, REB: 0.07 } }
    expect(gainTiles(s)).toEqual([
      { category: 'AST', pts: 30, rank: null, perGame: null },
      { category: 'REB', pts: 7, rank: null, perGame: null },
    ])
  })

  it('writes a group-chat post with both sides and the link', () => {
    const pick = {
      status: 'ready',
      date: '2026-10-23',
      league_id: 1,
      season: 2027,
      sides: [
        side('Wolves', ['Bam Adebayo'], 0.9, 0.94),
        side('Hermanos', ['Josh Giddey', 'Dyson Daniels'], 0.02, 0.06),
      ],
    } as TradeOfTheDay
    const text = shareText(pick, 'Chill League', 'https://example.com/?league=1')
    expect(text).toContain('Wolves send Bam Adebayo to Hermanos for Josh Giddey + Dyson Daniels.')
    expect(text).toContain('Hermanos: playoff odds 2% → 6% (+4)')
    expect(text.endsWith('https://example.com/?league=1')).toBe(true)
  })
})
