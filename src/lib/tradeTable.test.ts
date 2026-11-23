import { describe, expect, it } from 'vitest'
import type { CategoryOutlook, SeasonRow, TeamBuild } from '../api/client'
import { dashRecord, lastName, oddsToday, strongIn, teamLows, wantedCategories } from './tradeTable'

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
