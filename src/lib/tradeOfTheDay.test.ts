import { describe, expect, it } from 'vitest'
import type { TradeOfTheDay, TradeSide } from '../api/client'
import { shareText, topGains } from './tradeOfTheDay'

function side(team_name: string, sends: string[], before: number, after: number): TradeSide {
  return {
    team_id: team_name.length,
    team_name,
    abbrev: team_name.slice(0, 3).toUpperCase(),
    sends: sends.map((name, i) => ({
      id: i,
      name,
      positions: ['PG'],
      injury_status: 'ACTIVE',
      percent_owned: 90,
      value: 1,
      perceived_value: 10,
      tier: 'tradeable' as const,
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
  it('keeps the biggest category gains only', () => {
    expect(topGains({ AST: 0.3, STL: 0.1, FG: 0.01, TO: -0.2, PTS: 0.05, REB: 0.07 })).toEqual([
      { category: 'AST', pts: 30 },
      { category: 'STL', pts: 10 },
      { category: 'REB', pts: 7 },
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
