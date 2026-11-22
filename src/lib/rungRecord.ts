// The Running Record of the value rungs: everything here is read from POST /api/book-compare/record
// (and, for night names, the night list the page already has). Comparison only.
import { MIN_ODD, nightTab } from './iddaaCompare'
import type { RecordBucket, RecordNight, RecordPicks } from './iddaaCompare'
import { signed2 } from './valueRungs'

/** Under this many nights the record is an early read, and says so. */
export const EARLY_NIGHTS = 14

export interface RecordBand {
  name: string
  from: number
  to: number | null
  picks: number
  hits: number
  /** Our average chance on the band's picks. */
  said: number
  net: number
}

/** The odds band's name, e.g. "1.33–1.6" or "12+". */
export function bandName(from: number, to: number | null): string {
  const f = (v: number) => String(Math.round(v * 100) / 100)
  return to == null ? `${f(from)}+` : `${f(from)}–${f(to)}`
}

/** The record's odds bands, shortest odds first: the server's "all" rows, or the stat rows summed
 *  when it sends none. */
export function bandsOf(picks: RecordPicks[]): RecordBand[] {
  const all = picks.filter((p) => p.stat === 'all')
  const rows = all.length ? all : picks
  const by = new Map<string, RecordBand>()
  for (const p of rows) {
    const key = `${p.odds_from}|${p.odds_to ?? ''}`
    const b = by.get(key) ?? { name: bandName(p.odds_from, p.odds_to), from: p.odds_from, to: p.odds_to, picks: 0, hits: 0, said: 0, net: 0 }
    // said is an average: carry it as a pick-weighted sum and divide at the end
    b.said += p.said * p.picks
    b.picks += p.picks
    b.hits += p.hits
    b.net += p.net
    by.set(key, b)
  }
  return [...by.values()]
    .map((b) => ({ ...b, said: b.picks ? b.said / b.picks : 0, net: Math.round(b.net * 100) / 100 }))
    .sort((a, b) => a.from - b.from)
}

export interface RecordTotals {
  picks: number
  hits: number
  /** How many our chances said would land (the sum of the chances). */
  said: number
  net: number
  /** Net per unit staked so far, or null with no picks. */
  perUnit: number | null
}

export function totalsOf(bands: RecordBand[]): RecordTotals {
  const picks = bands.reduce((s, b) => s + b.picks, 0)
  const net = Math.round(bands.reduce((s, b) => s + b.net, 0) * 100) / 100
  return {
    picks,
    hits: bands.reduce((s, b) => s + b.hits, 0),
    said: bands.reduce((s, b) => s + b.said * b.picks, 0),
    net,
    perUnit: picks ? net / picks : null,
  }
}

/** How often, in words a reader can hold: "1 in 8" under 15%, else "4 in 10". */
export function oftenText(v: number): string {
  if (!(v > 0)) return 'none'
  if (v < 0.15) return `1 in ${Math.round(1 / v)}`
  return `${Math.min(10, Math.round(v * 10))} in 10`
}

/** Units, signed with a true minus: "+12.34", "−3.10". */
export const unitsText = signed2

/** The date of an NBA day: scoring periods are one per calendar day, so any known (day, date) pair
 *  places the rest. */
export function dateOfDay(day: number, known: { day: number; date?: string | null }[]): string | null {
  const exact = known.find((k) => k.day === day && k.date)
  if (exact?.date) return exact.date
  const anchor = known.filter((k) => k.date).sort((a, b) => Math.abs(a.day - day) - Math.abs(b.day - day))[0]
  if (!anchor?.date) return null
  const t = new Date(`${anchor.date}T12:00:00Z`)
  if (Number.isNaN(t.getTime())) return null
  t.setUTCDate(t.getUTCDate() + (day - anchor.day))
  return t.toISOString().slice(0, 10)
}

export interface LedgerNight {
  day: number | null
  /** "Sat 21", or "Day 33" when no date is known. */
  label: string
  date: string | null
  /** night: picks were counted; empty: ladders but no pick; none: the ladders didn't load. */
  kind: 'night' | 'empty' | 'none'
  picks: number
  hits: number
  net: number
  marked: number
  players: number
  top: number | null
  /** The running balance after this night. */
  balance: number
}

/** The series as a ledger, oldest first, settled nights only. A day the page knows had games but
 *  that the record skips is a night whose ladders didn't load: it stays in the ledger, uncounted. */
export function ledgerOf(series: RecordNight[] | undefined, known: { day: number; date?: string | null; games: number }[] = []): LedgerNight[] {
  const settled = (series ?? []).filter((n) => n.settled)
  if (!settled.length) return []
  const days = settled.map((n) => n.day).filter((d): d is number => d != null)
  const lo = Math.min(...days)
  const hi = Math.max(...days)
  const missing = known.filter((k) => k.games > 0 && k.day > lo && k.day < hi && !days.includes(k.day)).map((k) => k.day)
  type Row = { day: number | null; n: RecordNight | null }
  const rows: Row[] = [...settled.map((n) => ({ day: n.day, n })), ...missing.map((d) => ({ day: d, n: null }))]
  rows.sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
  let bal = 0
  return rows.map(({ day, n }) => {
    const date = day == null ? null : dateOfDay(day, known)
    const label = date ? nightTab(date) : day == null ? 'Night' : `Day ${day}`
    if (!n) return { day, label, date, kind: 'none', picks: 0, hits: 0, net: 0, marked: 0, players: 0, top: null, balance: round2(bal) }
    bal += n.net
    return {
      day,
      label,
      date,
      kind: n.picks > 0 ? 'night' : 'empty',
      picks: n.picks,
      hits: n.hits,
      net: n.net,
      marked: n.marked,
      players: n.players,
      top: n.top_hit,
      balance: round2(bal),
    }
  })
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** The balance without the night's single biggest landed pick (one unit at its odds paid odds − 1),
 *  and those odds. Null when nothing landed. */
export function withoutBiggest(ledger: LedgerNight[], net: number): { net: number; odds: number } | null {
  const top = Math.max(0, ...ledger.map((n) => n.top ?? 0))
  if (!(top > MIN_ODD)) return null
  return { net: round2(net - (top - 1)), odds: top }
}

/** The longest run of three or more nights in a row that lost (nights without ladders or picks break
 *  it): first and last index in the ledger and what it cost. */
export function losingRun(ledger: LedgerNight[]): { from: number; to: number; net: number } | null {
  let best: { from: number; to: number } | null = null
  let start: number | null = null
  ledger.forEach((n, i) => {
    if (n.kind === 'night' && n.net < 0) {
      if (start == null) start = i
      if (!best || i - start > best.to - best.from) best = { from: start, to: i }
    } else start = null
  })
  if (!best) return null
  const { from, to } = best as { from: number; to: number }
  if (to - from < 2) return null
  return { from, to, net: round2(ledger.slice(from, to + 1).reduce((s, n) => s + n.net, 0)) }
}

export interface CalRow {
  label: string
  from: number
  to: number
  /** What the two sides said on average in this bucket (0–1), weighted by rungs. */
  said: number
  ours: { said: number; happened: number; rungs: number } | null
  book: { said: number; happened: number; rungs: number } | null
}

/** Said vs happened: the two sides' buckets paired by chance range, lowest first. */
export function calRows(buckets: RecordBucket[]): CalRow[] {
  const by = new Map<string, CalRow>()
  for (const b of buckets) {
    const key = `${b.chance_from}|${b.chance_to}`
    const row = by.get(key) ?? { label: calLabel(b.chance_from, b.chance_to), from: b.chance_from, to: b.chance_to, said: 0, ours: null, book: null }
    row[b.side] = { said: b.said, happened: b.happened, rungs: b.rungs }
    by.set(key, row)
  }
  return [...by.values()]
    .map((r) => {
      const n = (r.ours?.rungs ?? 0) + (r.book?.rungs ?? 0)
      const said = n ? ((r.ours?.said ?? 0) * (r.ours?.rungs ?? 0) + (r.book?.said ?? 0) * (r.book?.rungs ?? 0)) / n : (r.from + r.to) / 2
      return { ...r, said }
    })
    .sort((a, b) => a.from - b.from)
}

function calLabel(from: number, to: number): string {
  const p = (v: number) => Math.round(v * 100)
  return to >= 1 ? `${p(from)}%+` : `${p(from)}–${p(to)}%`
}

/** One line on what the buckets show, written from them only: a side whose rungs came in short of
 *  what it said in every bucket, and whether ours sit near the tick. */
export function calNote(rows: CalRow[]): string | null {
  const filled = rows.filter((r) => r.ours && r.book && r.ours.rungs >= 30 && r.book.rungs >= 30)
  if (filled.length < 3) return null
  const short = (s: 'ours' | 'book') => filled.every((r) => (r[s]?.happened ?? 0) < (r[s]?.said ?? 0) - 0.01)
  const off = (s: 'ours' | 'book') => filled.reduce((a, r) => a + Math.abs((r[s]?.happened ?? 0) - (r[s]?.said ?? 0)), 0) / filled.length
  const parts: string[] = []
  if (short('book')) parts.push('The book’s overs came in less often than it said in every bucket.')
  if (short('ours')) parts.push('Ours came in less often than we said in every bucket.')
  const o = Math.round(off('ours') * 100)
  const b = Math.round(off('book') * 100)
  const pts = (v: number) => `${v} point${v === 1 ? '' : 's'}`
  if (o < b) parts.push(`Ours sit nearer the tick so far: off by ${pts(o)} on average, the book’s by ${b}.`)
  else if (b < o) parts.push(`The book’s sit nearer the tick so far: off by ${pts(b)} on average, ours by ${o}.`)
  return parts.length ? parts.join(' ') : null
}
