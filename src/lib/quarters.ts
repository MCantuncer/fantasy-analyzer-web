// Points by quarter in the pre-game box ("Stave", Can 2026-11-23): each side's Our call cut into four
// quarters by the API (app/quarters.py), with the pieces that moved each one. Pure functions only.
// - The lean of a quarter is what the favourite piece and the team's own habit add to the league split,
//   rounded to the one decimal we show. Under 0.5 a team is even: a smaller lean is a fraction of the
//   noise (half of quarters land within 4 points of our number), so it gets no words and no fill.
// - No betting words; one number per quarter.
import type { PregameBox, PregameQuarters, PregameSide } from '../api/client'
import { place } from './pregame'
import type { Side } from './pregame'

export const QUARTERS = ['1st', '2nd', '3rd', '4th'] as const
/** A lean (points vs a typical quarter) gets words and a club fill from here. */
export const LEAN_WORDS = 0.5
/** ...and plain words ("starts fast") from here. */
export const LEAN_STRONG = 1
/** Pieces of this size or more get a pill in How we got the quarters. */
export const PILL = 0.3
/** How far a team's quarter lands from our number (five seasons, 2021-22 to 2025-26). */
export const HALF_WITHIN = 4
export const MOST_WITHIN = 7.5

export const r1 = (x: number) => Math.round(x * 10) / 10

const UP: [string, string][] = [
  ['starts fast', 'starts a little quicker'],
  ['is strong in the 2nd', 'is a little stronger in the 2nd'],
  ['is strong after halftime', 'is a little stronger after halftime'],
  ['finishes strong', 'finishes a little stronger'],
]
const DOWN: [string, string][] = [
  ['starts slow', 'starts a little slower'],
  ['dips in the 2nd', 'dips a little in the 2nd'],
  ['dips after halftime', 'dips a little after halftime'],
  ['fades late', 'fades a little late'],
]

export interface Lean {
  /** Each quarter's lean, one decimal: favourite + own habit. */
  quarters: number[]
  /** The quarter that leans most, and by how much. */
  at: number
  value: number
  even: boolean
  /** "starts a little quicker" (empty when even). */
  phrase: string
  /** The favourite piece outweighs the habit in that quarter. */
  byRole: boolean
}

export function leanOf(q: PregameQuarters): Lean {
  const quarters = q.favourite.map((f, i) => r1(f + q.shape[i]))
  let at = 0
  quarters.forEach((v, i) => {
    if (Math.abs(v) > Math.abs(quarters[at])) at = i
  })
  const value = quarters[at]
  const even = Math.abs(value) < LEAN_WORDS
  const phrase = even ? '' : (value > 0 ? UP : DOWN)[at][Math.abs(value) >= LEAN_STRONG ? 0 : 1]
  return { quarters, at, value, even, phrase, byRole: Math.abs(q.favourite[at]) > Math.abs(q.shape[at]) }
}

const words = (s: string) => s.trim().split(/\s+/).length
const favourite = (b: PregameBox): Side => (b.home.call >= b.away.call ? 'home' : 'away')

/** The section's one line, 14 words or fewer: who leans where, or that nobody does. */
export function quarterHeadline(b: PregameBox): string {
  const fav = favourite(b)
  const leans = (['away', 'home'] as const)
    .filter((s) => b[s].quarters)
    .map((s) => ({ s, l: leanOf(b[s].quarters!) }))
    .filter((x) => !x.l.even)
    .sort((x, y) => Math.abs(y.l.value) - Math.abs(x.l.value))
  if (!leans.length) return 'No real lean either side. Both dip in the 4th, like every team.'
  const [first] = leans
  const tag = first.l.byRole ? (first.s === fav ? ', as favourites do' : ', as underdogs do') : ''
  const rest =
    leans.length > 1
      ? `${place(b[leans[1].s])} ${leans[1].l.phrase}.`
      : `${place(b[first.s === 'away' ? 'home' : 'away'])} stays even.`
  const full = `${place(b[first.s])} ${first.l.phrase}${tag}; ${rest}`
  return words(full) > 14 ? `${place(b[first.s])} ${first.l.phrase}; ${rest}` : full
}

/** The label under a team's name: "Starts a little quicker" / "Even all night". */
export function leanLabel(l: Lean): string {
  if (l.even) return 'Even all night'
  const p = l.phrase.replace(/^is /, '')
  return p[0].toUpperCase() + p.slice(1)
}

/** "+0.5 vs a typical 1st", "Within 0.3 of a typical quarter", "Same split as every team". */
export function leanSize(l: Lean): { lead: string; num: string; tail: string } {
  if (!l.even) return { lead: '', num: signed(l.value), tail: ` vs a typical ${QUARTERS[l.at]}` }
  const most = Math.max(...l.quarters.map(Math.abs))
  if (most < 0.05) return { lead: 'Same split as every team', num: '', tail: '' }
  return { lead: 'Within ', num: most.toFixed(1), tail: ' of a typical quarter' }
}

const MINUS = '−'
/** "+0.5", "−0.6"; "·" for nothing. */
export function signed(x: number): string {
  if (Math.abs(x) < 0.05) return '·'
  return `${x > 0 ? '+' : MINUS}${Math.abs(x).toFixed(1)}`
}
/** "27.9", "−0.4" without a plus. */
export function plain(x: number): string {
  if (Math.abs(x) < 0.05) return '0.0'
  return `${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(1)}`
}

export interface Piece {
  league: number
  favourite: number
  habit: number
  raw: number
  points: number
}

/** Each quarter's pieces at one decimal, the league split taking the rounding so each column adds up
    to the number shown above it. */
export function pieces(q: PregameQuarters): Piece[] {
  return q.raw.map((raw, i) => {
    const favourite = r1(q.favourite[i])
    const habit = r1(q.shape[i])
    const shown = r1(raw)
    let league = r1(q.league[i])
    const total = r1(league + favourite + habit)
    if (Math.abs(total - shown) > 0.01) league = r1(league + (shown - total))
    return { league, favourite, habit, raw: shown, points: q.points[i] }
  })
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** "Phoenix is the favourite..." for the Favourite or underdog row. */
export function roleLine(b: PregameBox, s: Side): string {
  if (b.chance < 0.6) return 'A close call, so this barely moves.'
  const name = place(b[s])
  return s === favourite(b)
    ? `${name} is the favourite. Favourites start a little faster and fade late.`
    : `${name} is the underdog. Underdogs start a little slower and close better.`
}

const possessive = (s: string) => (s.endsWith('s') ? `${s}’` : `${s}’s`)

export function habitLine(side: PregameSide, other: PregameSide): string {
  return `${possessive(place(side))} own quarters and what ${place(other)} allows.`
}

/** Where a team's habit comes from. */
export function habitSource(games: number): string {
  return games > 0
    ? `From last season and ${games} game${games === 1 ? '' : 's'} this season.`
    : 'From last season; this season joins as games are played.'
}

/** The side to open How we got the quarters on: the one that leans more. */
export function leaningSide(b: PregameBox): Side {
  const v = (s: Side) => (b[s].quarters ? Math.abs(leanOf(b[s].quarters!).value) : 0)
  return v('away') > v('home') ? 'away' : 'home'
}

/** One sentence a screen reader hears in place of the drawing. */
export function quarterSentence(b: PregameBox): string {
  const one = (s: Side) => {
    const q = b[s].quarters!
    const l = leanOf(q)
    return `${place(b[s])}, ${l.even ? 'even all night' : l.phrase}: ${q.points.map((p, i) => `${QUARTERS[i]} ${p}`).join('; ')}.`
  }
  return `Our number for each quarter. ${one('away')} ${one('home')}`
}
