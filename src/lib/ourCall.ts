import type { Game } from '../api/client'

/** Our call for a game: the score we expected each side to score, locked at tip-off, and how sure
 * we were of the winner (the API's GameCall; analysis/gamescore.py). */
export type Call = NonNullable<Game['call']>

/** How sure, by the whole percent shown: green sure, softer green likely, amber a lean, grey a coin flip. */
export type Band = 'sure' | 'likely' | 'lean' | 'flip'

/** The win chance as the whole percent on the card. */
export function percent(call: Call): number {
  return Math.round(call.chance * 100)
}

export function band(pct: number): Band {
  return pct >= 80 ? 'sure' : pct >= 65 ? 'likely' : pct >= 55 ? 'lean' : 'flip'
}

/** The side we picked to win (a call is never tied). */
export function pick(call: Call): 'away' | 'home' {
  return call.home > call.away ? 'home' : 'away'
}

export interface Verdict {
  /** We picked the winner. */
  called: boolean
  /** The larger of the two single-team misses, from the whole numbers on the card. */
  off: number
  /** Each side's miss. */
  misses: [away: number, home: number]
}

/** How the call did, once the game is final; null before, or without a call or scores. */
export function verdict(game: Game): Verdict | null {
  const c = game.call
  const a = game.away.score
  const h = game.home.score
  if (!c || game.status !== 'final' || a == null || h == null || a === h) return null
  const misses: [number, number] = [Math.abs(a - c.away), Math.abs(h - c.home)]
  return {
    called: Math.sign(c.home - c.away) === Math.sign(h - a),
    off: Math.max(...misses),
    misses,
  }
}

export interface Tally {
  /** Finals with a call. */
  finals: number
  /** Of those, the winner called. */
  right: number
  /** Mean single-team miss over those finals, whole points. */
  avg: number
  /** Every game with a call is final. */
  done: boolean
}

/** The day's calls so far; null until a final with a call lands. */
export function tally(games: Game[]): Tally | null {
  const called = games.filter((g) => g.call)
  const verdicts = called.map(verdict).filter((v): v is Verdict => v != null)
  if (!verdicts.length) return null
  const misses = verdicts.flatMap((v) => v.misses)
  return {
    finals: verdicts.length,
    right: verdicts.filter((v) => v.called).length,
    avg: Math.round(misses.reduce((s, m) => s + m, 0) / misses.length),
    done: verdicts.length === called.length,
  }
}

/** "Right about 6 times in 10" for a hit, "wrong about 4 times in 10" for a miss. */
export function timesInTen(pct: number, called: boolean): number {
  const right = Math.round(pct / 10)
  return called ? right : 10 - right
}

// Shorter club names on the cards; the box score keeps the full ones.
const SHORT: Record<string, string> = {
  'Trail Blazers': 'Blazers',
  Timberwolves: 'Wolves',
  '76ers': 'Sixers',
  Cavaliers: 'Cavs',
  Mavericks: 'Mavs',
}

export function shortNick(nick: string): string {
  return SHORT[nick] ?? nick
}

/* Two small memories in this browser, both best effort (private windows can refuse storage):
   finals already seen, so the tick or cross draws once; and the nights the key line was shown. */
const SEEN = 'court.calls.seen'
const NIGHTS = 'court.calls.nights'
const KEY_NIGHTS = 3

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

function writeList(key: string, list: string[], keep: number) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(-keep)))
  } catch {
    /* storage refused: the page still works, it just repeats itself */
  }
}

/** True the first time this browser sees this game as final (then remembers it). */
export function firstFinal(gameId: number): boolean {
  const seen = readList(SEEN)
  if (seen.includes(String(gameId))) return false
  writeList(SEEN, [...seen, String(gameId)], 400)
  return true
}

/** The key line shows on the first few nights with calls (then only when a final lands). */
export function showKey(date: string): boolean {
  const nights = readList(NIGHTS)
  if (nights.includes(date)) return nights.indexOf(date) < KEY_NIGHTS
  if (nights.length >= KEY_NIGHTS) return false
  writeList(NIGHTS, [...nights, date], KEY_NIGHTS)
  return true
}
