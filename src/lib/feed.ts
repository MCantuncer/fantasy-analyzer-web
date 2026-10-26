import type { FeedItem, FeedTeam } from '../api/client'

export const REACTIONS = [
  { key: 'steal', label: 'Steal' },
  { key: 'smart', label: 'Smart' },
  { key: 'overpay', label: 'Overpay' },
  { key: 'lol', label: 'LOL' },
] as const

export const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'trade', label: 'Trades' },
  { id: 'waiver', label: 'Waivers' },
  { id: 'free_agent', label: 'Free agents' },
  { id: 'post', label: 'Chat' },
  { id: 'mine', label: 'My team' },
] as const

export type Filter = (typeof FILTERS)[number]['id']

export function matches(item: FeedItem, filter: Filter, myTeamId: number | null): boolean {
  if (filter === 'all') return true
  if (filter === 'mine')
    return myTeamId !== null && (item.team_id === myTeamId || (item.team_ids ?? []).includes(myTeamId))
  return item.kind === filter
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function groupByDay(items: FeedItem[], now: Date = new Date()): { label: string; items: FeedItem[] }[] {
  const groups: { label: string; items: FeedItem[] }[] = []
  for (const item of items) {
    const label = dayLabel(item.at, now)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export function teamName(teams: FeedTeam[], id: number): string {
  return teams.find((t) => t.id === id)?.name ?? `Team ${id}`
}

export function teamAbbrev(teams: FeedTeam[], id: number): string {
  return teams.find((t) => t.id === id)?.abbrev || teamName(teams, id).slice(0, 3).toUpperCase()
}

/** What the waiver claim beat, e.g. "Won over 1 other bid (Eryaman Lakers, $1)." Nothing when it was uncontested. */
/** The claims a waiver pickup beat: bids in FAAB leagues, waiver priority otherwise. */
export function bidLine(item: FeedItem, teams: FeedTeam[], budget?: number | null): string | null {
  if (item.kind !== 'waiver') return null
  const lost = item.losing_bids ?? []
  if (lost.length === 0) return null
  if (!budget) {
    return lost.length === 1
      ? `Won over 1 other claim (${teamName(teams, lost[0].team_id)}) on waiver priority.`
      : `Won over ${lost.length} other claims on waiver priority.`
  }
  if (lost.length === 1) return `Won over 1 other bid (${teamName(teams, lost[0].team_id)}, $${lost[0].bid}).`
  return `Won over ${lost.length} other bids, the highest $${lost[0].bid}.`
}

/** Calls out the claiming team only when it has spent more FAAB than anyone else. */
export function faabLine(item: FeedItem, teams: FeedTeam[], budget: number | null | undefined): string | null {
  if (item.kind !== 'waiver' || !budget) return null
  const team = teams.find((t) => t.id === item.team_id)
  if (team?.faab_spent == null) return null
  const most = Math.max(...teams.map((t) => t.faab_spent ?? 0))
  const lead =
    team.faab_spent > 0 && team.faab_spent === most && teams.filter((t) => t.faab_spent === most).length === 1
  return lead ? `${team.name} has spent $${team.faab_spent} of $${budget}, the most in the league.` : null
}

/** A trade as "who gets what", one side per receiving team. */
export function tradeSides(item: FeedItem): { teamId: number; gets: FeedItem['moves'] }[] {
  const sides: { teamId: number; gets: FeedItem['moves'] }[] = []
  for (const m of item.moves ?? []) {
    const side = sides.find((s) => s.teamId === m.to_team_id)
    if (side) side.gets!.push(m)
    else sides.push({ teamId: m.to_team_id, gets: [m] })
  }
  return sides
}

export function postId(item: FeedItem): number | null {
  return item.kind === 'post' ? Number(item.id.split(':')[1]) : null
}

/** "Who won it?" votes per team, from won:<team id> reactions. */
export function wonVotes(item: FeedItem): { counts: Record<number, number>; total: number; mine: number | null } {
  const counts: Record<number, number> = {}
  let total = 0
  for (const [key, n] of Object.entries(item.reactions?.counts ?? {})) {
    if (!key.startsWith('won:')) continue
    counts[Number(key.slice(4))] = n
    total += n
  }
  const mineKey = (item.reactions?.mine ?? []).find((k) => k.startsWith('won:'))
  return { counts, total, mine: mineKey ? Number(mineKey.slice(4)) : null }
}
