import { useSyncExternalStore } from 'react'
import type { GameNote, GameStats, PlayerCard, PlayerCardExtras, PlayerGame, PlayerMove } from '../api/client'

/** Enough to open a player's card: the name shows while the rest loads. */
export interface CardPlayer {
  id: number
  name: string
}

export interface PlayerCardApi {
  open: (player: CardPlayer) => void
  /** Starts loading his card before the tap lands (hover, press), so it opens with data. */
  prefetch: (player: CardPlayer) => void
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

/** One line for a move of him in this league, e.g. "Claimed off waivers by Aspavas"; the bid shows as a badge. */
export function moveText(m: PlayerMove, teams: Map<number, string>, myTeamId: number | null): string {
  const to = team(m.to_team_id, teams, myTeamId)
  const from = team(m.from_team_id, teams, myTeamId)
  switch (m.kind) {
    case 'draft':
      // An auction price shows as the badge beside the line.
      return m.pick && !m.bid ? `Drafted by ${to}, pick ${m.pick}` : `Drafted by ${to}`
    case 'add':
      if (m.via === 'waiver') return `Claimed off waivers by ${to}`
      return `Picked up by ${to}`
    case 'drop':
      return `Dropped by ${from}`
    case 'trade':
      return `Traded from ${from} to ${to}`
  }
}

/** Who else moved with him: "Kyle Kuzma dropped", or the rest of a trade. */
export function moveOthers(m: Pick<PlayerMove, 'kind' | 'others' | 'from_team_id'>): string {
  const others = (m.others ?? []).filter((o) => o.name)
  if (!others.length) return ''
  if (m.kind === 'trade') {
    const back = others.filter((o) => o.to_team_id === m.from_team_id).map((o) => o.name)
    const along = others.filter((o) => o.to_team_id !== m.from_team_id).map((o) => o.name)
    return [back.length ? `for ${back.join(', ')}` : '', along.length ? `with ${along.join(', ')}` : '']
      .filter(Boolean)
      .join(' · ')
  }
  const drops = others.filter((o) => o.kind === 'drop').map((o) => o.name)
  const adds = others.filter((o) => o.kind === 'add').map((o) => o.name)
  return [drops.length ? `${drops.join(', ')} dropped` : '', adds.length ? `${adds.join(', ')} added` : '']
    .filter(Boolean)
    .join(' · ')
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

export interface Deal {
  give: CardPlayer[]
  get: CardPlayer[]
  my_drop?: CardPlayer | null
  my_add?: CardPlayer | null
  their_drop?: CardPlayer | null
}

/** Everyone a deal moves, for the player-card chips: what you give and get, then the drops and adds. */
export function dealPlayers(t: Deal): CardPlayer[] {
  return dealGroups(t).flatMap((g) => g.players)
}

export interface DealGroup {
  label: string
  players: CardPlayer[]
}

/** A deal's players by role (give, get, then roster moves), leaving out empty roles. */
export function dealGroups(t: Deal): DealGroup[] {
  const one = (p: CardPlayer | null | undefined) => (p ? [p] : [])
  return [
    { label: 'Give', players: t.give },
    { label: 'Get', players: t.get },
    { label: 'You drop', players: one(t.my_drop) },
    { label: 'You add', players: one(t.my_add) },
    { label: 'They drop', players: one(t.their_drop) },
  ].filter((g) => g.players.length > 0)
}

export type CatKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tpm' | 'to'

export const CATS: { key: CatKey; label: string }[] = [
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'tpm', label: '3PM' },
  { key: 'to', label: 'TO' },
]

// How far a single game must be from his average to count as a big or quiet night, per category,
// in that category's units. About one game-to-game spread for a rotation player.
const GAME_SPREAD: Record<CatKey, number> = { pts: 7, reb: 3, ast: 2.2, stl: 1, blk: 1, tpm: 2, to: 1.5 }

/**
 * A game's number against his average: 0 is a normal night, up to 1 a big one, and -1 a quiet one.
 * Turnovers count the other way. Only one colour shows it (the accent glow), so a quiet night just fades.
 */
export function spotlight(cat: CatKey, value: number, avg: number): number {
  const better = cat === 'to' ? avg - value : value - avg
  const z = better / GAME_SPREAD[cat]
  if (z >= 0.75) return Math.min(1, z / 1.5)
  if (z <= -0.75) return -1
  return 0
}

export interface FormTile {
  key: string
  label: string
  value: string
  /** Last 5 minus season, signed; null without a comparison. */
  delta: number | null
  /** The change helps him (turnovers going down count as better). */
  better: boolean
  note?: string
}

/** The nine categories over his last five games, each against his season average. */
export function formTiles(
  last5: GameStats,
  season: GameStats | null,
  fgSeason: number | null,
  ftSeason: number | null,
): FormTile[] {
  const tiles: FormTile[] = CATS.map(({ key, label }) => {
    const d = season ? last5[key] - season[key] : null
    return { key, label, value: last5[key].toFixed(1), delta: d, better: d != null && (key === 'to' ? d < 0 : d > 0) }
  })
  const pctTile = (key: string, label: string, made: number, att: number, base: number | null): FormTile => {
    if (att <= 0) return { key, label, value: '–', delta: null, better: false, note: 'no attempts' }
    const v = (made / att) * 100
    const d = base != null ? v - base * 100 : null
    return {
      key,
      label,
      value: v.toFixed(1),
      delta: d,
      better: d != null && d > 0,
      note: `${made.toFixed(1)}/${att.toFixed(1)} a game`,
    }
  }
  tiles.push(pctTile('fg', 'FG%', last5.fgm, last5.fga, fgSeason))
  tiles.push(pctTile('ft', 'FT%', last5.ftm, last5.fta, ftSeason))
  return tiles
}

/**
 * The card with the extras filled in once they arrive: his news, the names of who moved with him,
 * and each finished game's final score and garbage-time line.
 */
export function withExtras(card: PlayerCard, extras: PlayerCardExtras | undefined): PlayerCard {
  if (!extras) return card
  const names = extras.names
  const notes = extras.games ?? {}
  return {
    ...card,
    news: extras.news,
    games: card.games.map((g) => {
      const note = notes[String(g.game_id)]
      return note ? ({ ...g, ...note } as PlayerGame & GameNight) : g
    }),
    moves: card.moves.map((m) => ({
      ...m,
      others: (m.others ?? []).map((o) => (o.name ? o : { ...o, name: names[String(o.player_id)] ?? '' })),
    })),
  }
}

/**
 * A game's final score and his garbage-time line. They come with the card's extras (`withExtras`
 * puts them on the game), so everything below reads them through `nightOf`.
 */
export type GameNight = GameNote

const nightOf = (g: PlayerGame): GameNight => g as PlayerGame & GameNight

/** His team's final score first, or null before the game is over or when the server has none. */
export function finalScore(g: PlayerGame): { team: number; opp: number } | null {
  return nightOf(g).score ?? null
}

/** The final score in words, for screen readers and hover: "Won 137 to 97". */
export function scoreWords(g: PlayerGame): string | null {
  const sc = finalScore(g)
  if (!sc) return null
  const verb = g.won == null ? 'Final' : g.won ? 'Won' : 'Lost'
  return `${verb} ${sc.team} to ${sc.opp}`
}

export interface GarbageNight {
  /** His stats in garbage time. */
  stats: GameStats
  /** His garbage-time minutes, never more than the minutes in his line. */
  minutes: number
  /** Share of his minutes, 0 to 1. */
  share: number
}

const GT_COUNTS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm', 'to', 'fga', 'fta'] as const

/**
 * His garbage time in one game, when it's worth a line in the log: any stat or shot in it, or two
 * minutes or more. A minute of mop-up with an empty line says nothing, so it stays off.
 */
export function garbageTime(g: PlayerGame): GarbageNight | null {
  const gt = nightOf(g).garbage
  if (!gt || gt.minutes <= 0) return null
  if (!GT_COUNTS.some((k) => gt[k] > 0) && gt.minutes < 2) return null
  const minutes = g.stats.minutes > 0 ? Math.min(gt.minutes, g.stats.minutes) : gt.minutes
  const share = g.stats.minutes > 0 ? minutes / g.stats.minutes : 1
  return { stats: gt, minutes, share }
}

/** "all" when (nearly) his whole night came after the game was decided, otherwise "60%". */
export function shareLabel(share: number): string {
  return share >= 0.95 ? 'all' : `${Math.round(share * 100)}%`
}

/** Minutes to one decimal, whole minutes without it: "7.8", "3". */
export function minutesText(m: number): string {
  return Math.abs(m - Math.round(m)) < 0.05 ? String(Math.round(m)) : m.toFixed(1)
}

/** Why a game got there, in one line: "Won by 40, so the starters sat." */
export function decidedWhy(g: PlayerGame): string | null {
  const sc = finalScore(g)
  if (!sc || sc.team === sc.opp) return null
  const m = sc.team - sc.opp
  return `${m > 0 ? 'Won' : 'Lost'} by ${Math.abs(m)}, so the starters sat.`
}

export interface GarbageTally {
  /** Games with a garbage-time line, of the games he played. */
  games: number
  played: number
  pts: number
  allPts: number
}

/** How much of this stretch came after the game was decided. */
export function garbageTally(played: PlayerGame[]): GarbageTally {
  let games = 0
  let pts = 0
  let allPts = 0
  for (const g of played) {
    allPts += g.stats.pts
    const gt = garbageTime(g)
    if (gt) {
      games += 1
      pts += gt.stats.pts
    }
  }
  return { games, played: played.length, pts, allPts }
}

/** The tally as a sentence: "20 of his 47 pts in these 10 games came after the game was decided". */
export function tallyText(t: GarbageTally): string {
  const games = t.played === 1 ? 'this game' : `these ${t.played} games`
  return `${t.pts} of his ${t.allPts} pts in ${games} came after the game was decided`
}
