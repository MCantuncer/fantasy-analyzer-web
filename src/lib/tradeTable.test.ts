import { describe, expect, it } from 'vitest'
import type { CategoryOutlook, SeasonRow, ShopDeal, ShopReport, TeamBuild } from '../api/client'
import {
  dashRecord,
  dealMatches,
  lastName,
  oddsToday,
  shopMarket,
  strongIn,
  teamLows,
  wantedCategories,
} from './tradeTable'

const row = (team_id: number, playoff_pct: number) => ({ team_id, playoff_pct }) as SeasonRow
const cat = (category: string, win_pct: number, tag: CategoryOutlook['tag']) =>
  ({ category, win_pct, tag, league_rank: 5, weekly_projection: 0 }) as CategoryOutlook
const build = (team_id: number, ranks: Record<string, number>, strong: string[] = [], weak: string[] = []) =>
  ({ team_id, team_name: `T${team_id}`, ranks, strong, weak, expected_cats_won: 4 }) as TeamBuild

describe('oddsToday', () => {
  it('gives your odds and where they rank', () => {
    expect(oddsToday([row(1, 0.9), row(3, 0.54), row(2, 0.6), row(4, 0.2)], 3)).toEqual({ pct: 0.54, rank: 3, teams: 4 })
  })

  it('is null for a team not in the table', () => {
    expect(oddsToday([row(1, 0.9)], 3)).toBeNull()
  })
})

describe('wantedCategories', () => {
  it('keeps the swing categories, closest to even first, and marks only the closest as Close', () => {
    const wants = wantedCategories([
      cat('REB', 0.636, 'swing'),
      cat('BLK', 0.72, 'locked'),
      cat('AST', 0.397, 'swing'),
      cat('PTS', 0.27, 'lost'),
    ])
    expect(wants).toEqual([
      { category: 'AST', winPct: 0.397, close: true },
      { category: 'REB', winPct: 0.636, close: false },
    ])
  })

  it('leaves Close off when even the closest is far from even', () => {
    expect(wantedCategories([cat('REB', 0.8, 'swing')])[0].close).toBe(false)
  })

  it('takes at most three', () => {
    const many = ['A', 'B', 'C', 'D'].map((c, i) => cat(c, 0.4 + i * 0.01, 'swing'))
    expect(wantedCategories(many)).toHaveLength(3)
  })
})

describe('strongIn', () => {
  it('lists the other teams strong in a category, best rank first', () => {
    const builds = [build(3, { AST: 1 }, ['AST']), build(5, { AST: 3 }, ['AST']), build(7, { AST: 2 }, ['AST']), build(8, { AST: 9 })]
    expect(strongIn(builds, 'AST', 3).map((b) => b.team_id)).toEqual([7, 5])
  })
})

describe('teamLows', () => {
  it('takes the worst ranks outside the likely punts', () => {
    const b = build(1, { REB: 10, STL: 8, AST: 7, FG: 6, PTS: 2 }, [], ['REB'])
    expect(teamLows(b, 10)).toEqual(['STL', 'AST', 'FG'])
  })

  it('gives at least two, even for a team with no low ranks', () => {
    expect(teamLows(build(1, { A: 1, B: 3, C: 2 }), 10)).toEqual(['B', 'C'])
  })
})

describe('names and records', () => {
  it('writes records with real dashes', () => {
    expect(dashRecord('15-21-0')).toBe('15–21–0')
  })

  it('takes the last name, skipping a suffix', () => {
    expect(lastName('Jarrett Allen')).toBe('Allen')
    expect(lastName('Jaren Jackson Jr.')).toBe('Jackson')
  })
})

describe('shopMarket', () => {
  const p = (id: number) => ({ id, name: `P${id}` })
  const d = (team: number, give: number[], get: number[], uses_all = false) =>
    ({ partner_team_id: team, give: give.map(p), get: get.map(p), uses_all }) as unknown as ShopDeal
  const a1 = d(1, [3], [91])
  const b1 = d(2, [3, 4], [92], true)
  const a2 = d(1, [4], [93])
  const late = d(6, [4], [94])
  const team = (team_id: number, deals_found: number, best: ShopDeal | null = null) => ({
    team_id,
    team_name: `T${team_id}`,
    record: '1-1-0',
    deals_found,
    best,
  })
  const data = {
    deals: [a1, b1, a2],
    teams: [team(1, 4, a1), team(2, 1, b1), team(6, 2, late), team(7, 3), team(8, 0), team(9, 0)],
  } as unknown as ShopReport

  it('groups deals by team in the order of their best deal, and keeps a best deal that missed the list', () => {
    const m = shopMarket(data)
    expect(m.deals).toEqual([a1, a2, b1, late])
  })

  it('splits the rest into teams with no lift and teams with nothing', () => {
    const m = shopMarket(data)
    expect(m.noLift.map((t) => t.team_id)).toEqual([7])
    expect(m.none.map((t) => t.team_id)).toEqual([8, 9])
  })

  it('filters by all, every picked player, or one player', () => {
    expect([a1, b1, a2].filter((x) => dealMatches(x, 'all'))).toHaveLength(3)
    expect([a1, b1, a2].filter((x) => dealMatches(x, 'every'))).toEqual([b1])
    expect([a1, b1, a2].filter((x) => dealMatches(x, 4))).toEqual([b1, a2])
  })
})
