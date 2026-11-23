import type { CategoryOutlook, SeasonRow, TeamBuild } from '../api/client'

/** Your playoff odds today and where they rank in the league (1 = best), from the season table. */
export interface OddsToday {
  pct: number
  rank: number
  teams: number
}

export function oddsToday(season: SeasonRow[], teamId: number): OddsToday | null {
  const mine = season.find((r) => r.team_id === teamId)
  if (!mine) return null
  const rank = 1 + season.filter((r) => r.team_id !== teamId && r.playoff_pct > mine.playoff_pct).length
  return { pct: mine.playoff_pct, rank, teams: season.length }
}

/** A category your build wants back: its weekly win chance, and whether it is the close one. */
export interface Want {
  category: string
  winPct: number
  close: boolean
}

// The closest want gets the "Close" label when it is within this much of an even week.
const CLOSE_WITHIN = 0.15

/**
 * The categories a deal should aim at: the swing ones (neither locked nor lost), closest to an
 * even week first, at most ``n``. Only the closest carries "Close", and only when it really is.
 */
export function wantedCategories(categories: CategoryOutlook[], n = 3): Want[] {
  return categories
    .filter((c) => c.tag === 'swing')
    .sort((a, b) => Math.abs(a.win_pct - 0.5) - Math.abs(b.win_pct - 0.5))
    .slice(0, n)
    .map((c, i) => ({
      category: c.category,
      winPct: c.win_pct,
      close: i === 0 && Math.abs(c.win_pct - 0.5) <= CLOSE_WITHIN,
    }))
}

/** The other teams strong in a category, best first. */
export function strongIn(builds: TeamBuild[], category: string, myTeamId: number): TeamBuild[] {
  return builds
    .filter((b) => b.team_id !== myTeamId && b.strong.includes(category))
    .sort((a, b) => (a.ranks[category] ?? 99) - (b.ranks[category] ?? 99))
}

/**
 * Where a team is low: its worst ranks, leaving out the categories it is far behind in (its
 * likely punts, in ``weak``). Two or three of them, worst first.
 */
export function teamLows(build: TeamBuild, teams: number): string[] {
  const ranked = Object.entries(build.ranks)
    .filter(([cat]) => !build.weak.includes(cat))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const bottom = ranked.filter(([, rank]) => rank > teams / 2).slice(0, 3)
  return (bottom.length >= 2 ? bottom : ranked.slice(0, 2)).map(([cat]) => cat)
}

/** "15-21-0" as "15–21–0", with real dashes. */
export function dashRecord(record: string): string {
  return record.replace(/-/g, '–')
}

/** "Jarrett Allen" -> "Allen", "Jaren Jackson Jr." -> "Jackson". */
export function lastName(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 && /^(Jr\.?|Sr\.?|II|III|IV)$/.test(parts[parts.length - 1])
    ? parts[parts.length - 2]
    : parts[parts.length - 1]
}
