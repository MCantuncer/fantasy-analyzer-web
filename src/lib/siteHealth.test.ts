import { describe, expect, it } from 'vitest'
import type { UsageDay } from '../api/client'
import { dayLabel, pageLabel, summarize, totalViews, utcDay } from './siteHealth'

const day = (
  d: string,
  visitors: number,
  views: Record<string, number>,
  events: Record<string, number> = {},
  newAccounts = 0,
): UsageDay => ({
  day: d,
  visitors,
  signed_in: 0,
  new_accounts: newAccounts,
  views,
  events,
})

describe('summarize', () => {
  const now = new Date('2026-11-11T15:00:00Z')
  const days = [
    day('2026-11-11', 4, { moves: 3, scores: 1 }, { analysis: 2 }, 1),
    day('2026-11-10', 10, { scores: 6 }, { analysis: 1, signup: 2 }, 2),
  ]

  it('adds up the range', () => {
    const s = summarize(days, 7, now)
    expect(s.visitorsToday).toBe(4)
    expect(s.dailyAverage).toBe(2)
    expect(s.newAccounts).toBe(3)
    expect(s.analyses).toBe(3)
    expect(s.pages).toEqual([
      { page: 'scores', views: 7 },
      { page: 'moves', views: 3 },
    ])
  })

  it('is zero with nothing counted', () => {
    expect(summarize([], 30, now)).toMatchObject({ visitorsToday: 0, dailyAverage: 0, pages: [] })
  })
})

describe('labels', () => {
  it('names pages and days', () => {
    expect(pageLabel('trade-for')).toBe('Trade For')
    expect(pageLabel('something-new')).toBe('something-new')
    expect(dayLabel('2026-11-11')).toBe('Wed 11 Nov')
    expect(utcDay(new Date('2026-11-11T23:30:00-05:00'))).toBe('2026-11-12')
    expect(totalViews(day('2026-11-11', 0, { a: 2, b: 3 }))).toBe(5)
  })
})
