import type { NewsPlayer, NewsStory } from '../api/client'

export type NewsFilter = 'all' | 'injuries' | 'moves' | 'roles' | 'rumors'
export type NewsScope = 'nba' | 'league' | 'mine'

export const FILTERS: { id: NewsFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'injuries', label: 'Injuries' },
  { id: 'moves', label: 'Trades & signings' },
  { id: 'roles', label: 'Role changes' },
  { id: 'rumors', label: 'Rumors' },
]

const KINDS: Record<NewsFilter, NewsStory['kind'][] | null> = {
  all: null,
  injuries: ['injury', 'return'],
  moves: ['trade', 'signing', 'waive'],
  roles: ['role'],
  rumors: ['rumor'],
}

export const KIND_LABEL: Record<NewsStory['kind'], string> = {
  injury: 'Injury',
  return: 'Return',
  trade: 'Trade',
  rumor: 'Rumor',
  signing: 'Signing',
  waive: 'Released',
  role: 'Role change',
  other: 'League',
}

export const STATUS_LABEL: Record<NewsStory['status'], string> = {
  confirmed: 'Confirmed',
  reported: 'Reported',
  held: 'Not published',
  didnt_happen: "Didn't happen",
}

export function inFilter(story: NewsStory, filter: NewsFilter): boolean {
  const kinds = KINDS[filter]
  return kinds === null || kinds.includes(story.kind)
}

/** "In my league" keeps stories about a rostered player; "My roster" only yours. */
export function inScope(story: NewsStory, scope: NewsScope, myTeamId: number | null): boolean {
  if (scope === 'nba') return true
  if (scope === 'mine') return myTeamId !== null && story.players.some((p) => p.owner_team_id === myTeamId)
  return story.players.some((p) => p.owner_team_id != null)
}

export function countBy(stories: NewsStory[], filter: NewsFilter): number {
  return stories.filter((s) => inFilter(s, filter)).length
}

/** How many independent places said it: outlets and ESPN's data, not social sites. */
export function sourceCount(story: NewsStory): number {
  return new Set(story.sources.filter((s) => s.kind !== 'tip').map((s) => s.source_id)).size
}

export function statusText(story: NewsStory): string {
  if (story.status === 'reported') return '1 source · Reported'
  if (story.status === 'confirmed') {
    const n = sourceCount(story)
    return n > 1 ? `Confirmed · ${n} sources` : 'Confirmed'
  }
  return STATUS_LABEL[story.status]
}

export function ago(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/** Local calendar day of a story's latest source, for "Today" / "Yesterday" headings. */
export function dayHeading(iso: string, now: Date): string {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(now) - start(d)) / 86_400_000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function groupByDay(stories: NewsStory[], now: Date): { day: string; stories: NewsStory[] }[] {
  const out: { day: string; stories: NewsStory[] }[] = []
  for (const s of stories) {
    const day = dayHeading(s.updated_at, now)
    const last = out[out.length - 1]
    if (last && last.day === day) last.stories.push(s)
    else out.push({ day, stories: [s] })
  }
  return out
}

export type Ownership = 'mine' | 'rival' | 'free' | 'none'

export function ownership(p: { owner_team_id?: number | null }, myTeamId: number | null, inLeague: boolean): Ownership {
  if (!inLeague) return 'none'
  if (p.owner_team_id == null) return 'free'
  return p.owner_team_id === myTeamId ? 'mine' : 'rival'
}

const STATUS: Record<string, string> = {
  DAY_TO_DAY: 'DTD',
  QUESTIONABLE: 'Q',
  DOUBTFUL: 'D',
  OUT: 'Out',
  INJURY_RESERVE: 'IR',
  SUSPENSION: 'Susp',
}

export function shortStatus(p: Pick<NewsPlayer, 'injury_status'>): string | null {
  return STATUS[p.injury_status] ?? null
}
