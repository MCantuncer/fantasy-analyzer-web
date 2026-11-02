import { useSyncExternalStore } from 'react'
import type { GameStats, PlayerCard, PlayerGame, PlayerMove } from '../api/client'

/** Enough to open a player's card: the name shows while the rest loads. */
export interface CardPlayer {
  id: number
  name: string
}

export interface PlayerCardApi {
  open: (player: CardPlayer) => void
}

// The one mounted PlayerCardHost registers here while a league is open. A module store rather
// than a context keeps App.tsx free of a provider wrapping every page.
let host: PlayerCardApi | null = null
const listeners = new Set<() => void>()

export function setPlayerCardHost(next: PlayerCardApi | null) {
  host = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Opens a player's card, or null outside a league, where names stay plain text. */
export function usePlayerCard(): PlayerCardApi | null {
  return useSyncExternalStore(
    subscribe,
    () => host,
    () => null,
  )
}

export type Tone = 'good' | 'warn' | 'bad'

const STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Healthy', tone: 'good' },
  NORMAL: { label: 'Healthy', tone: 'good' },
  PROBABLE: { label: 'Probable', tone: 'warn' },
  QUESTIONABLE: { label: 'Questionable', tone: 'warn' },
  DAY_TO_DAY: { label: 'Day-to-day', tone: 'warn' },
  DOUBTFUL: { label: 'Doubtful', tone: 'bad' },
  OUT: { label: 'Out', tone: 'bad' },
  INJURY_RESERVE: { label: 'Out (IR)', tone: 'bad' },
  SUSPENSION: { label: 'Suspended', tone: 'bad' },
}

export function healthStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: status.replace(/_/g, ' ').toLowerCase(), tone: 'warn' }
}

/** "You", or the team's name. */
function team(id: number, teams: Map<number, string>, myTeamId: number | null): string {
  if (myTeamId !== null && id === myTeamId) return 'you'
  return teams.get(id) ?? `Team ${id}`
}

/** One line for a move of him in this league, e.g. "Claimed off waivers by Aspavas for $5". */
export function moveText(m: PlayerMove, teams: Map<number, string>, myTeamId: number | null): string {
  const to = team(m.to_team_id, teams, myTeamId)
  const from = team(m.from_team_id, teams, myTeamId)
  switch (m.kind) {
    case 'draft':
      if (m.bid) return `Drafted by ${to} for $${m.bid}`
      return m.pick ? `Drafted by ${to}, pick ${m.pick}` : `Drafted by ${to}`
    case 'add':
      if (m.via === 'waiver')
        return m.bid ? `Claimed off waivers by ${to} for $${m.bid}` : `Claimed off waivers by ${to}`
      return `Picked up by ${to}`
    case 'drop':
      return `Dropped by ${from}`
    case 'trade':
      return `Traded from ${from} to ${to}`
  }
}

export function moveTone(m: PlayerMove): 'good' | 'bad' | 'accent' {
  return m.kind === 'drop' ? 'bad' : m.kind === 'trade' ? 'accent' : 'good'
}

/** Who has him in this league. */
export function ownerText(
  card: Pick<PlayerCard, 'owner_team_id' | 'on_waivers'>,
  teams: Map<number, string>,
  myTeamId: number | null,
): string {
  if (card.owner_team_id == null) return card.on_waivers ? 'On waivers' : 'Free agent'
  if (card.owner_team_id === myTeamId) return 'On your team'
  return `On ${teams.get(card.owner_team_id) ?? `Team ${card.owner_team_id}`}`
}

const COUNTING = ['minutes', 'pts', 'reb', 'ast', 'stl', 'blk', 'tpm', 'to', 'fgm', 'fga', 'ftm', 'fta'] as const

/** Per-game average of these games, or null when there are none. */
export function average(games: PlayerGame[]): GameStats | null {
  if (!games.length) return null
  const out = Object.fromEntries(COUNTING.map((k) => [k, 0])) as unknown as GameStats
  for (const g of games) for (const k of COUNTING) out[k] += g.stats[k]
  for (const k of COUNTING) out[k] /= games.length
  return out
}

/** "48.6%", or a dash without attempts. */
export function shootingPct(made: number, attempts: number): string {
  return attempts > 0 ? `${((made / attempts) * 100).toFixed(1)}%` : '–'
}

/** The NBA's own date for a game: tip-offs are US evenings, which are the next morning in Europe. */
export function gameDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

/** "@BOS" away, "BOS" at home, as box scores print it. */
export function opponent(g: Pick<PlayerGame, 'opponent' | 'home'>): string {
  if (!g.opponent) return '–'
  return g.home === false ? `@${g.opponent}` : g.opponent
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Deal {
  give: CardPlayer[]
  get: CardPlayer[]
  my_drop?: CardPlayer | null
  my_add?: CardPlayer | null
  their_drop?: CardPlayer | null
}

/** Everyone a deal moves, for the player-card chips: what you give and get, then the drops and adds. */
export function dealPlayers(t: Deal): CardPlayer[] {
  return [...t.give, ...t.get, t.my_drop, t.my_add, t.their_drop].filter((p): p is CardPlayer => p != null)
}
