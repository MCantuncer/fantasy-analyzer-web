import type { UsageDay } from '../api/client'

export interface UsageSummary {
  visitorsToday: number
  /** Average daily visitors over the days in range (each day counts its own visitors). */
  dailyAverage: number
  newAccounts: number
  analyses: number
  /** Page views over the range, most viewed first. */
  pages: { page: string; views: number }[]
}

const PAGE_NAMES: Record<string, string> = {
  moves: 'Moves',
  park: 'Trade Park',
  'trade-for': 'Trade For',
  team: 'My Team',
  league: 'League',
  overview: 'League (before verifying)',
  feed: 'Moves Feed',
  scores: 'Scores',
  news: 'NBA News',
  chat: 'League Chat',
  film: 'Film Room',
  verify: 'Verify team',
  'my-leagues': 'My leagues',
  'sign-in': 'Sign in',
}

export function pageLabel(page: string): string {
  return PAGE_NAMES[page] ?? page
}

/** Today in UTC, as the API keys its days. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function summarize(days: UsageDay[], rangeDays: number, now: Date): UsageSummary {
  const today = days.find((d) => d.day === utcDay(now))
  const views = new Map<string, number>()
  let visitors = 0
  let newAccounts = 0
  let analyses = 0
  for (const d of days) {
    visitors += d.visitors
    newAccounts += d.new_accounts
    analyses += d.events.analysis ?? 0
    for (const [page, n] of Object.entries(d.views)) views.set(page, (views.get(page) ?? 0) + n)
  }
  return {
    visitorsToday: today?.visitors ?? 0,
    dailyAverage: rangeDays > 0 ? visitors / rangeDays : 0,
    newAccounts,
    analyses,
    pages: [...views.entries()].map(([page, n]) => ({ page, views: n })).sort((a, b) => b.views - a.views),
  }
}

export function totalViews(day: UsageDay): number {
  return Object.values(day.views).reduce((a, b) => a + b, 0)
}

/** "Wed 11 Nov" for an API day (YYYY-MM-DD, UTC). */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
