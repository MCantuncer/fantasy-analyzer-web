import type { PickupIdea } from '../api/client'

export type MoveTiming = NonNullable<PickupIdea['timing']>
export type MoveDay = MoveTiming['days'][number]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** A YYYY-MM-DD date as a day of the week, read on its own calendar (no time zone shift). */
function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export const shortDay = (iso: string) => WEEKDAYS[weekday(iso)]
export const longDay = (iso: string) => WEEKDAYS_LONG[weekday(iso)]

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** The first day of the matchup's days left: today. */
const today = (t: MoveTiming) => t.days[0]?.date ?? t.earliest_on

/** "Make it tomorrow", "Make this Sunday" or "Make it next week", for a move that should wait. */
export function waitLabel(t: MoveTiming): string {
  if (t.next_week) return 'Make it next week'
  if (daysBetween(today(t), t.make_on) === 1) return 'Make it tomorrow'
  return `Make this ${longDay(t.make_on)}`
}

/** "if made Sunday", for labelling odds that assume the wait. */
export function ifMade(t: MoveTiming): string {
  if (t.next_week) return 'if made next week'
  if (daysBetween(today(t), t.make_on) === 1) return 'if made tomorrow'
  return `if made ${longDay(t.make_on)}`
}

/** Days before the move that the dropped player still plays for you. */
export function keptDays(t: MoveTiming): MoveDay[] {
  return t.days.filter((d) => d.drop_plays && (t.next_week || d.date < t.make_on))
}

/** Who has the roster spot each day left, with the move made on its best day. */
export function spotDays(t: MoveTiming): { day: MoveDay; who: 'drop' | 'add' | null; before: boolean }[] {
  return t.days.map((day) => {
    const before = t.next_week || day.date < t.make_on
    const plays = before ? day.drop_plays : day.add_plays
    return { day, who: plays ? (before ? 'drop' : 'add') : null, before }
  })
}

/** Games the spot gets with the move on its best day, and if it were made now. */
export function spotGames(t: MoveTiming): { best: number; now: number } {
  const best = spotDays(t).filter((s) => s.who).length
  return { best, now: best - t.drop_games_kept + t.add_games_missed }
}

export const lastName = (name: string) => name.split(' ').slice(1).join(' ') || name
