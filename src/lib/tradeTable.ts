import type { CategoryOutlook, SeasonRow, ShopDeal, ShopReport, ShopTeam, TeamBuild } from '../api/client'
import { tradeKey } from './format'

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

/** Trade Park's "Every team": the deals that hold up, the teams with no lift, the teams with nothing. */
export interface ShopMarket {
  /** Every deal that holds up, grouped by team: teams in the order of their best deal, best first within each. */
  deals: ShopDeal[]
  /** Teams where packages pass the checks but none raises your playoff odds. */
  noLift: ShopTeam[]
  /** Teams with no package that works for both. */
  none: ShopTeam[]
}

/**
 * Groups a shop result by partner team. A team's best deal that missed the overall list still
 * gets its row, so every team with a deal can be put on the table.
 */
export function shopMarket(data: ShopReport): ShopMarket {
  const seen = new Set<string>()
  const byTeam = new Map<number, ShopDeal[]>()
  const add = (d: ShopDeal) => {
    const key = tradeKey(d)
    if (seen.has(key)) return
    seen.add(key)
    const list = byTeam.get(d.partner_team_id)
    if (list) list.push(d)
    else byTeam.set(d.partner_team_id, [d])
  }
  data.deals.forEach(add)
  for (const t of data.teams) if (t.best) add(t.best)
  const rest = data.teams.filter((t) => !byTeam.has(t.team_id))
  return {
    deals: [...byTeam.values()].flat(),
    noLift: rest.filter((t) => t.deals_found > 0),
    none: rest.filter((t) => t.deals_found === 0),
  }
}

/** Every team's filter: all deals, the ones that send every picked player, or the ones that send one player. */
export type DealFilter = 'all' | 'every' | number

export function dealMatches(d: Pick<ShopDeal, 'give' | 'uses_all'>, f: DealFilter): boolean {
  return f === 'all' ? true : f === 'every' ? d.uses_all : d.give.some((p) => p.id === f)
}
