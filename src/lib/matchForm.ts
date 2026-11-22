import { teamName } from './nbaTeams'

// The match card's Form view (Can 2026-11-22): both teams' recent games before they meet, who is
// heating up or cooling off, and each game's MVP. Everything here is pure, read from POST
// /api/match-form. Preseason games never reach it: the server leaves them out.

/** One player's line in a game: the game's MVP, or a side's best. */
export interface FormStar {
  player_id: number
  name: string
  team: string
  game_score: number
  minutes: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tpm: number
  to: number
  fgm: number
  fga: number
  ftm: number
  fta: number
}

export type GameKind = 'regular' | 'cup' | 'play_in' | 'playoff'

export interface FormGame {
  game_id: number
  date: string | null // US game date, YYYY-MM-DD
  start: string
  home: boolean
  neutral: boolean // e.g. the Mexico City game: neither home nor road
  kind: GameKind | null // null when ESPN couldn't say
  note: string | null // ESPN's note: "NBA Cup - Group Play"
  opponent: string
  opponent_name: string
  points: number
  opponent_points: number
  won: boolean
  mvp: FormStar | null // best Game Score on the winning side
  best: FormStar | null // this team's best
  opp_best?: FormStar | null // the other side's best
}

export interface TeamForm {
  abbrev: string
  name: string
  wins: number
  losses: number
  games: FormGame[] // newest first
}

export interface MatchNext {
  game_id: number
  start: string
  neutral: boolean
  kind: GameKind | null
  note: string | null
}

export interface MatchForm {
  away: TeamForm
  home: TeamForm
  next: MatchNext | null
}

export type Side = 'away' | 'home'
export type FormHeat = 'hot' | 'cold' | 'steady'

/** How many recent games the verdict reads. */
export const FORM_GAMES = 5

const MINUS = '−'

/** "+3", "−7", "0"; with digits, "+3.0". Never "−0". */
export function signedMargin(x: number, digits = 0): string {
  const s = Math.abs(x).toFixed(digits)
  if (Number(s) === 0) return s
  return `${x > 0 ? '+' : MINUS}${s}`
}

export function marginOf(g: FormGame): number {
  return g.points - g.opponent_points
}

/** The games at tonight's venue (the home team's home games, the visitor's road games) when `on`;
 *  neutral-site games are neither. Otherwise every game. Order is kept. */
export function inVenue(games: FormGame[], side: Side, on: boolean): FormGame[] {
  if (!on) return games
  return games.filter((g) => !g.neutral && g.home === (side === 'home'))
}

/** The current run: ("won", 3) for three wins in a row. Null before the first game. */
export function streakOf(games: FormGame[]): { won: boolean; n: number } | null {
  if (!games.length) return null
  const won = games[0].won
  let n = 0
  for (const g of games) {
    if (g.won !== won) break
    n++
  }
  return { won, n }
}

export interface FormRead {
  heat: FormHeat
  n: number // games read (at most FORM_GAMES)
  wins: number
  losses: number
  per: number // average margin over those games
  streak: { won: boolean; n: number } | null
  since: string | null // date of the oldest game read
}

/** The verdict on the last five games in view (newest first):
 *  Heating Up: won 4 of the last 5 or the last 3, and outscored opponents over those 5.
 *  Cooling Off: lost 4 of the last 5 or the last 3, and was outscored over those 5.
 *  Otherwise, or with fewer than 5 games, Steady. */
export function formRead(games: FormGame[]): FormRead {
  const last = games.slice(0, FORM_GAMES)
  const wins = last.filter((g) => g.won).length
  const losses = last.length - wins
  const total = last.reduce((s, g) => s + marginOf(g), 0)
  const per = last.length ? total / last.length : 0
  const streak = streakOf(games)
  let heat: FormHeat = 'steady'
  if (last.length === FORM_GAMES) {
    const hotRun = wins >= 4 || (streak?.won === true && streak.n >= 3)
    const coldRun = losses >= 4 || (streak?.won === false && streak.n >= 3)
    if (hotRun && total > 0) heat = 'hot'
    else if (coldRun && total < 0) heat = 'cold'
  }
  return { heat, n: last.length, wins, losses, per, streak, since: last.at(-1)?.date ?? null }
}

export const HEAT_WORDS: Record<FormHeat, string> = {
  hot: 'heating up',
  cold: 'cooling off',
  steady: 'steady',
}

export const HEAT_LABEL: Record<FormHeat, string> = {
  hot: 'Heating Up',
  cold: 'Cooling Off',
  steady: 'Steady',
}

/** The rule as the card writes it under the verdicts. */
export const HEAT_RULE =
  'Heating Up: won 4 of the last 5 or the last 3, and outscored opponents over those 5. Cooling Off: the mirror. Otherwise Steady.'

/** What the verdict rests on, after the team's name and state: "lost 3 straight", "won 4 of the
 *  last 5 at home", "only 2 games on the road so far". `where` is "" for every game. */
export function verdictReason(read: FormRead, where: '' | 'at home' | 'on the road'): string {
  const at = where ? ` ${where}` : ''
  if (read.n < FORM_GAMES) {
    const games = read.n === 1 ? 'game' : 'games'
    return read.n === 0 ? `no games${at} yet` : `only ${read.n} ${games}${at} so far`
  }
  const s = read.streak
  if (s && s.n >= 3) return `${s.won ? 'won' : 'lost'} ${s.n} straight${at}`
  const most = read.wins >= read.losses
  return `${most ? 'won' : 'lost'} ${most ? read.wins : read.losses} of the last ${read.n}${at}`
}

/** A margin bar's length: `max` px at the cap (20 points), and whether it was cut there. */
export function barHeight(margin: number, max: number, cap = 20): { h: number; capped: boolean } {
  const m = Math.abs(margin)
  return { h: (Math.min(m, cap) / cap) * max, capped: m > cap }
}

/** The game the Game Ball opens on: their last meeting this season, else the latest game. */
export function defaultGame(games: FormGame[], other: string): FormGame | null {
  return games.find((g) => g.opponent === other) ?? games[0] ?? null
}

/** The losing side's best player in a game (the MVP is always on the winning side). */
export function losersBest(g: FormGame): FormStar | null {
  return g.won ? (g.opp_best ?? null) : g.best
}

export interface TypeTag {
  label: string // "Regular Season", "NBA Cup", "Play-In", "Playoff"
  detail: string | null // "Group Play", "Quarterfinal", "Mexico City Game"
  variant: 'quiet' | 'cup' | 'post'
}

/** The tag a game wears. No kind, no tag. */
export function typeTag(kind: GameKind | null, note: string | null): TypeTag | null {
  if (kind == null) return null
  const tail = note?.includes(' - ') ? note.split(' - ').slice(1).join(' - ').trim() : null
  if (kind === 'cup') return { label: 'NBA Cup', detail: tail, variant: 'cup' }
  if (kind === 'play_in') return { label: 'Play-In', detail: tail, variant: 'post' }
  if (kind === 'playoff') return { label: 'Playoff', detail: note ? note.split(' - ').join(' · ') : null, variant: 'post' }
  // A regular-season game with its own note ("NBA Mexico City Game") keeps it as the detail.
  const special = note ? note.replace(/^NBA\s+/, '') : null
  return { label: 'Regular Season', detail: special, variant: 'quiet' }
}

/** "Knicks'" / "Heat's". */
export function possessive(nick: string): string {
  return nick.endsWith('s') ? `${nick}'` : `${nick}'s`
}

/** "Knicks" from "NY"; the abbreviation when the club is unknown. */
export function nick(abbrev: string): string {
  const n = teamName(abbrev)
  return n === abbrev ? abbrev : n.split(' ').slice(-1)[0]
}

/** "Oct 30" from a US game date (YYYY-MM-DD). */
export function shortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
