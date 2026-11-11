import type { CategoryDetail, OfferCheck } from '../api/client'
import { CATEGORY_ORDER } from './statOrder'

/** A trade the manager is checking: who it's with, who goes each way, and how it came about. */
export type CheckMode = 'received' | 'sending'

export interface CheckDeal {
  partner: number | null
  give: number[]
  get: number[]
  mode: CheckMode
  /** The player the manager chose to cut, when the deal brings in more players than it sends. */
  cut: number | null
}

/** The most players a side can hold, as the API allows. */
export const MAX_SIDE = 3

export const EMPTY_DEAL: CheckDeal = {
  partner: null,
  give: [],
  get: [],
  mode: 'received',
  cut: null,
}

const ids = (s: string | undefined) =>
  (s ?? '')
    .split('-')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_SIDE)

/**
 * The deal as one URL value, so a check can be shared or reopened: `t9.g1-2.r3-4.s.c5`.
 * t = their team, g = players you give, r = players you receive, s = you're sending it, c = your cut.
 * Only ids go in the URL.
 */
export function encodeDeal(d: CheckDeal): string {
  if (d.partner == null) return ''
  const parts = [`t${d.partner}`]
  if (d.give.length) parts.push(`g${d.give.join('-')}`)
  if (d.get.length) parts.push(`r${d.get.join('-')}`)
  if (d.mode === 'sending') parts.push('s')
  if (d.cut != null) parts.push(`c${d.cut}`)
  return parts.join('.')
}

export function decodeDeal(value: string | null | undefined): CheckDeal | null {
  if (!value) return null
  const out: CheckDeal = { ...EMPTY_DEAL, give: [], get: [] }
  for (const part of value.split('.')) {
    const key = part[0]
    const rest = part.slice(1)
    if (key === 't' && Number(rest) > 0) out.partner = Number(rest)
    else if (key === 'g') out.give = ids(rest)
    else if (key === 'r') out.get = ids(rest)
    else if (key === 's' && !rest) out.mode = 'sending'
    else if (key === 'c' && Number(rest) > 0) out.cut = Number(rest)
  }
  return out.partner == null ? null : out
}

/** How many players you'd cut to fit the deal: the extra players you get. */
export function cutsNeeded(d: Pick<CheckDeal, 'give' | 'get'>): number {
  return Math.max(d.get.length - d.give.length, 0)
}

export function canCheck(d: CheckDeal): boolean {
  return d.partner != null && d.give.length > 0 && d.get.length > 0
}

/** Add or remove a player on one side, keeping to MAX_SIDE. A changed shape drops a cut that may no longer apply. */
export function togglePlayer(d: CheckDeal, side: 'give' | 'get', id: number): CheckDeal {
  const list = d[side]
  const next = list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_SIDE ? [...list, id] : list
  if (next === list) return d
  return { ...d, [side]: next, cut: null }
}

/** Whole-point change between two rounded percentages, so 53 -> 34 always reads -19. */
export function pointChange(before: number, after: number): number {
  return Math.round(after * 100) - Math.round(before * 100)
}

/** The engine's categories in the site's fixed order. */
export function inCategoryOrder(detail: CategoryDetail[]): CategoryDetail[] {
  const rank = (c: string) => {
    const i = (CATEGORY_ORDER as readonly string[]).indexOf(c)
    return i < 0 ? CATEGORY_ORDER.length : i
  }
  return [...detail].sort((a, b) => rank(a.category) - rank(b.category))
}

export const CALL: Record<OfferCheck['call'], { label: string; tone: 'good' | 'close' | 'bad' }> = {
  take: { label: 'Take it', tone: 'good' },
  close: { label: 'Close call', tone: 'close' },
  pass: { label: 'Pass', tone: 'bad' },
}

export const PARTNER_CALL: Record<OfferCheck['partner_call'], string> = {
  gain: 'Better for them',
  even: 'Even for them',
  lose: 'Worse for them',
}

/** The engine's reason without its first sentence, which the odds already show. */
export function reasonTail(reason: string): string {
  const i = reason.indexOf('. ')
  return i < 0 ? '' : reason.slice(i + 2).trim()
}

const word = (n: number) => (n > 0 ? `up ${n}` : n < 0 ? `down ${-n}` : 'no change')

/** What a screen reader hears first: both calls and both teams' odds. */
export function checkSummary(c: OfferCheck): string {
  const i = c.idea
  const mine = pointChange(i.playoff_pct_before, i.playoff_pct_after)
  const parts = [
    `${CALL[c.call].label}.`,
    `Your playoff odds ${Math.round(i.playoff_pct_before * 100)} to ${Math.round(i.playoff_pct_after * 100)} percent, ${word(mine)}.`,
  ]
  if (i.partner_playoff_pct_before != null && i.partner_playoff_pct_after != null) {
    const theirs = pointChange(i.partner_playoff_pct_before, i.partner_playoff_pct_after)
    parts.push(
      `${c.partner_team_name} ${Math.round(i.partner_playoff_pct_before * 100)} to ${Math.round(
        i.partner_playoff_pct_after * 100,
      )}, ${word(theirs)}, ${PARTNER_CALL[c.partner_call].toLowerCase()}, ${
        c.paper_win ? 'wins' : 'loses'
      } on paper, $${Math.round(i.value_they_get)} for $${Math.round(i.value_they_give)}.`,
    )
  }
  if (c.direction === 'sending') parts.push(`Chance they say yes: ${ACCEPTANCE_WORD[i.acceptance_label]}.`)
  return parts.join(' ')
}

export const ACCEPTANCE_WORD: Record<OfferCheck['idea']['acceptance_label'], string> = {
  likely: 'likely',
  possible: 'possible',
  long_shot: 'long shot',
}

/** The checks that came back clear, by title, for "the rest came back clear". */
export function clearChecks(c: OfferCheck): string[] {
  return (c.checks ?? []).filter((v) => v.status !== 'confirmed').map((v) => v.title)
}

/** The URL parameter that holds the deal, so a check can be shared or reopened. */
export const CHECK_PARAM = 'check'

/** "Jaren Jackson Jr." -> "Jackson Jr.": the surname, keeping a suffix with it. */
export function surname(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  const last = parts[parts.length - 1]
  return /^(Jr\.?|Sr\.?|II|III|IV)$/.test(last) && parts.length > 2 ? `${parts[parts.length - 2]} ${last}` : last
}

/** "2027-03-01".."2027-03-07" -> "Mar 1–7" (or "Mar 29–Apr 4"). */
export function weekSpan(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00Z`)
  const b = new Date(`${end}T00:00:00Z`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ''
  const month = (d: Date) => d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const right = month(a) === month(b) ? `${b.getUTCDate()}` : `${month(b)} ${b.getUTCDate()}`
  return `${month(a)} ${a.getUTCDate()}–${right}`
}
