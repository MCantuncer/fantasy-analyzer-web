// Value rungs: the book's "n+" rungs read against our chance. The maths the page draws from, kept
// apart from the components so it can be tested. Comparison only: nothing here feeds the model.
//
// price = 1 ÷ odds: the chance the odds need to break even.
// value = ours × odds − 1: what one unit returns on average if our chance is right.
// A rung beats its price when our chance is above the price, which is the same as value > 0.

import { MIN_ODD, PLAYER_STATS, STAT_UNIT, odds, statOf } from './iddaaCompare'
import type { Closer, CompareRung, CompareTally, Line, Stat } from './iddaaCompare'

const MINUS = '−'

/** The chance the odds need to break even. */
export function price(odd: number): number {
  return 1 / odd
}

/** Average return of one unit at these odds if our chance is right. */
export function valueOf(ours: number, odd: number): number {
  return ours * odd - 1
}

/** A chance as a percent: whole points, one decimal under 10% when it has one (9.6%, 62%). */
export function pctText(p: number): string {
  const x = p * 100
  const r = Math.round(x * 10) / 10
  return `${r < 10 && !Number.isInteger(r) ? r.toFixed(1) : Math.round(x)}%`
}

/** A signed amount with two decimals: +0.30, −0.81, 0.00. */
export function signed2(v: number): string {
  const r = Math.round(v * 100) / 100
  return `${r > 0 ? '+' : r < 0 ? MINUS : ''}${Math.abs(r).toFixed(2)}`
}

/** Whose chance sat nearer the result on one rung: the higher chance when it landed, the lower when
 *  it missed. Null before the result or without our chance. */
export function rungWinner(r: CompareRung): Closer | null {
  if (r.hit == null || r.ours == null) return null
  if (Math.abs(r.ours - r.book) < 1e-9) return 'tie'
  return r.hit === r.ours > r.book ? 'ours' : 'book'
}

/** Rung by rung: on how many each side was nearer, of the rungs judged. */
export function rungCount(rungs: CompareRung[]): { ours: number; book: number; level: number; n: number } {
  const c = { ours: 0, book: 0, level: 0, n: 0 }
  for (const r of rungs) {
    const w = rungWinner(r)
    if (!w) continue
    c.n++
    if (w === 'ours') c.ours++
    else if (w === 'book') c.book++
    else c.level++
  }
  return c
}

/** Brier score over the settled rungs: the mean of (chance − result)², 0 perfect, 0.25 a coin flip. */
export function brier(rungs: CompareRung[], side: 'ours' | 'book'): number | null {
  let s = 0
  let n = 0
  for (const r of rungs) {
    const p = side === 'ours' ? r.ours : r.book
    if (r.hit == null || p == null) continue
    s += (p - (r.hit ? 1 : 0)) ** 2
    n++
  }
  return n ? s / n : null
}

/** "7 of 7" style counts for the rung_closer tag: the side that read it better, or both when level. */
export function closerCount(rungs: CompareRung[], who: Closer): string {
  const c = rungCount(rungs)
  if (!c.n) return ''
  if (who === 'tie') return c.ours === c.book ? `${c.ours} of ${c.n} each` : `${c.ours} and ${c.book} of ${c.n}`
  return `${who === 'ours' ? c.ours : c.book} of ${c.n}`
}

/** Where the "Had N" rule goes in a ladder listed from the highest rung down: before the first rung
 *  he reached. 0 puts it on top (every rung landed), the length puts it under the last (none did). */
export function hadAt(desc: { n: number }[], actual: number): number {
  const i = desc.findIndex((r) => r.n <= actual)
  return i < 0 ? desc.length : i
}

/** The rungs that beat their price: our chance gives value over 0, at odds over 1.33. */
export function isValue(r: CompareRung): boolean {
  return r.ours != null && r.value != null && r.value > 0 && r.odd > MIN_ODD
}

/** "7+ assists at 2.11: ours 62%, needs 47%, book 39%, value +0.30, landed" for screen readers. */
export function rungLabel(r: CompareRung, unit: string): string {
  const res = r.hit == null ? '' : r.hit ? ', landed' : ', missed'
  const ours = r.ours == null ? 'none' : pctText(r.ours)
  const value = r.value == null ? '' : `, value ${signed2(r.value)}`
  return `${r.n}+ ${unit} at ${odds(r.odd)}: ours ${ours}, needs ${pctText(price(r.odd))}, book ${pctText(r.book)}${value}${res}`
}

/** The note under an opened ladder, written from its rungs only: what he had and how the rungs went,
 *  who was nearer rung by rung, and which rungs (if any) beat their price. */
export function ladderNote(
  rungs: CompareRung[],
  actual: number | null,
  closer: Closer | null,
): { lead: string; rest: string; value: string } {
  const asc = [...rungs].filter((r) => r.odd > MIN_ODD).sort((a, b) => a.n - b.n)
  const c = rungCount(asc)
  let lead = ''
  let rest = ''
  if (actual != null && c.n > 0) {
    const judged = asc.filter((r) => r.hit != null)
    const landed = judged.filter((r) => r.hit).length
    const how =
      landed === judged.length
        ? 'every rung landed'
        : landed === 0
          ? 'no rung landed'
          : `${landed} of ${judged.length} rungs landed`
    lead = `Had ${fmtNum(actual)}: ${how}`
    if (landed === judged.length) rest = ', so on each rung the side that gave the higher chance was nearer.'
    else if (landed === 0) rest = ', so on each rung the side that gave the lower chance was nearer.'
    else rest = '.'
    const all = (k: number) => (k === c.n ? `all ${c.n}` : `${k} of ${c.n}`)
    if (closer === 'ours') rest += ` Ours was nearer on ${all(c.ours)}.`
    else if (closer === 'book') rest += ` The book was nearer on ${all(c.book)}.`
    else if (closer === 'tie') rest += ` Level: ${closerCount(asc, 'tie')}.`
  }
  const picks = asc.filter(isValue)
  let value = ''
  const withValue = asc.filter((r) => r.value != null)
  if (picks.length === 0 && withValue.length) {
    const lo = withValue[0]
    const hi = withValue[withValue.length - 1]
    value =
      lo === hi
        ? `No rung beat its price: ${signed2(lo.value ?? 0)} at ${lo.n}+.`
        : `No rung beat its price: from ${signed2(lo.value ?? 0)} at ${lo.n}+ to ${signed2(hi.value ?? 0)} at ${hi.n}+.`
  } else if (picks.length > 0 && picks.length <= 2) {
    const say = (r: CompareRung) =>
      `${r.n}+ at ${odds(r.odd)} (ours ${pctText(r.ours ?? 0)}, needs ${pctText(price(r.odd))})`
    value = `${picks.length === 1 ? '1 rung beat its price' : '2 rungs beat their price'}: ${picks.map(say).join(' and ')}.`
  } else if (picks.length > 2) {
    const best = [...picks].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
    value = `${picks.length} rungs beat their price; the best is ${best.n}+ at ${odds(best.odd)}, value ${signed2(best.value ?? 0)}.`
  }
  return { lead, rest, value }
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

// ---------------------------------------------------------------------------------------------
// The night's value rungs (the Value Rungs section)

/** One value rung of the night with the row it belongs to. */
export interface Pick {
  line: Line
  rung: CompareRung
  ours: number
  value: number
  price: number
}

/** Every rung the night priced (odds over 1.33, with our chance), for the Tape. */
export interface TapeItem {
  odd: number
  value: number
  pick: Pick | null
}

/** The night's value picks: rungs with value over 0 at odds over 1.33, biggest value first. */
export function picksOf(lines: Line[]): Pick[] {
  const out: Pick[] = []
  for (const l of lines) {
    if (l.kind !== 'player') continue
    for (const r of l.rungs) {
      if (!isValue(r)) continue
      out.push({ line: l, rung: r, ours: r.ours ?? 0, value: r.value ?? 0, price: price(r.odd) })
    }
  }
  return out.sort((a, b) => b.value - a.value)
}

/** All the night's priced rungs, value picks marked, in odds order. */
export function tapeOf(lines: Line[]): TapeItem[] {
  const picks = new Map(picksOf(lines).map((p) => [p.rung, p]))
  const out: TapeItem[] = []
  for (const l of lines) {
    if (l.kind !== 'player') continue
    for (const r of l.rungs) {
      if (r.value == null || r.odd <= MIN_ODD) continue
      out.push({ odd: r.odd, value: r.value, pick: picks.get(r) ?? null })
    }
  }
  return out.sort((a, b) => a.odd - b.odd)
}

/** The Tape's odds bands; the first starts at the 1.33 floor. */
export const TAPE_BANDS: { name: string; lo: number; hi: number }[] = [
  { name: '1.33–1.6', lo: MIN_ODD, hi: 1.6 },
  { name: '1.6–2.5', lo: 1.6, hi: 2.5 },
  { name: '2.5–5', lo: 2.5, hi: 5 },
  { name: '5–12', lo: 5, hi: 12 },
  { name: '12+', lo: 12, hi: Infinity },
]

/** The Tape's bands with their rungs and average value; empty bands drop out. Each band's width is
 *  half its share of the rungs and half an equal share, so the 12+ shelf stays readable. */
export function tapeBands(items: TapeItem[]) {
  const bands = TAPE_BANDS.map((b) => {
    const its = items.filter((i) => i.odd >= b.lo && i.odd < b.hi)
    return { ...b, items: its, avg: its.length ? its.reduce((s, i) => s + i.value, 0) / its.length : 0, share: 0 }
  }).filter((b) => b.items.length > 0)
  const total = bands.reduce((s, b) => s + b.items.length, 0)
  for (const b of bands) b.share = 0.5 * (b.items.length / total) + 0.5 / bands.length
  return bands
}

/** The night's typical rung: the mean value over every priced rung. */
export function typical(items: TapeItem[]): number | null {
  return items.length ? items.reduce((s, i) => s + i.value, 0) / items.length : null
}

/** "6 in 10 land · 4 lose", or under 15% "About 1 in 10 lands · 9.6%": counts, never a verdict. */
export function landWords(p: number): { pre: string; strong: string; post: string } {
  if (p < 0.15) {
    const n = Math.max(7, Math.round(1 / Math.max(p, 0.001)))
    return { pre: 'About ', strong: `1 in ${n}`, post: ` lands · ${pctText(p)}` }
  }
  const k = Math.round(p * 10)
  if (k >= 10) return { pre: '', strong: 'Nearly all', post: ` land · ${pctText(p)}` }
  return { pre: '', strong: `${k} in 10`, post: ` land · ${10 - k} lose` }
}

/** The fixed 10-pip strip: how full each pip is, the last one partly, so 9.6% and 14% differ. */
export function pipFills(p: number): number[] {
  return Array.from({ length: 10 }, (_, i) => Math.max(0, Math.min(1, p * 10 - i)))
}

/** The night's sums. Net counts one unit on each settled pick at the book's odds. */
export function nightSum(picks: Pick[]) {
  const settled = picks.filter((p) => p.rung.hit != null)
  const hits = settled.filter((p) => p.rung.hit)
  const net = settled.reduce((s, p) => s + (p.rung.hit ? p.rung.odd - 1 : -1), 0)
  const top = [...hits].sort((a, b) => b.rung.odd - a.rung.odd)[0] ?? null
  const players = new Set(picks.map((p) => who(p))).size
  return {
    n: picks.length,
    settled: settled.length,
    hits: hits.length,
    said: picks.reduce((s, p) => s + p.ours, 0),
    marked: picks.reduce((s, p) => s + p.value, 0),
    net,
    top,
    withoutTop: top ? net - (top.rung.odd - 1) : null,
    players,
  }
}

/** A pick's player, across his stats. */
export const who = (p: Pick) => (p.line.playerId ? `id:${p.line.playerId}` : `n:${p.line.name}`)

export interface PickGroup {
  key: string
  title: string
  sub: string
  picks: Pick[]
  line: Line | null // the player, for By Player groups
}

/** By Player: players with two or more value rungs (most first), then the singles folded together. */
export function byPlayer(picks: Pick[]): PickGroup[] {
  const m = new Map<string, Pick[]>()
  for (const p of picks) m.set(who(p), [...(m.get(who(p)) ?? []), p])
  const sorted = (ps: Pick[]) => [...ps].sort((a, b) => b.value - a.value)
  const multi: PickGroup[] = [...m.entries()]
    .filter(([, ps]) => ps.length > 1)
    .sort((a, b) => b[1].length - a[1].length || b[1][0].value - a[1][0].value)
    .map(([key, ps]) => ({ key, title: ps[0].line.name, sub: ps[0].line.gameLabel, picks: sorted(ps), line: ps[0].line }))
  const singles = sorted([...m.values()].filter((ps) => ps.length === 1).map((ps) => ps[0]))
  if (singles.length) {
    const games = new Set(singles.map((p) => p.line.game.game_id)).size
    multi.push({
      key: 'singles',
      title: `${singles.length} more, one rung each`,
      sub: `${games} ${games === 1 ? 'game' : 'games'}`,
      picks: singles,
      line: null,
    })
  }
  return multi
}

/** By Hit Chance: Usually lands (60%+), Coin flip (35–60%), Long shots (under 35%), likeliest first. */
export function byChance(picks: Pick[]): PickGroup[] {
  const G = [
    { key: 'usual', title: 'Usually lands', sub: '60%+', f: (p: number) => p >= 0.6 },
    { key: 'coin', title: 'Coin flip', sub: '35–60%', f: (p: number) => p >= 0.35 && p < 0.6 },
    { key: 'long', title: 'Long shots', sub: 'under 35%', f: (p: number) => p < 0.35 },
  ]
  return G.map((g) => ({
    key: g.key,
    title: g.title,
    sub: g.sub,
    picks: picks.filter((p) => g.f(p.ours)).sort((a, b) => b.ours - a.ours),
    line: null,
  })).filter((g) => g.picks.length > 0)
}

/** Margin note 1, concentration: one player holds 3 or more of the night's value rungs and at least
 *  a quarter of them, so they land or miss together. */
export function concentration(picks: Pick[]): { key: string; name: string; count: number; n: number; players: number; text: string } | null {
  if (!picks.length) return null
  const m = new Map<string, Pick[]>()
  for (const p of picks) m.set(who(p), [...(m.get(who(p)) ?? []), p])
  const [key, top] = [...m.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  if (top.length < 3 || top.length / picks.length < 0.25) return null
  const name = top[0].line.name
  return {
    key,
    name,
    count: top.length,
    n: picks.length,
    players: m.size,
    text: `${top.length} of the ${picks.length} are ${name}: they land or miss together. Read them as one call, not ${top.length}.`,
  }
}

/** Margin note 2, "What +0.45 means", from the night's biggest value: how often it lands and what 100
 *  like it would bring back at those odds. */
export function bigValueNote(picks: Pick[]) {
  const p = [...picks].sort((a, b) => b.value - a.value)[0]
  if (!p) return null
  const r = p.rung
  const last = p.line.name.split(' ').slice(-1)[0]
  const k = Math.round(p.ours * 10)
  const often = p.ours < 0.15 ? `1 time in ${Math.round(1 / p.ours)}` : `${k} times in 10`
  const tail = p.ours < 0.5 ? 'Most single nights it loses.' : `It still misses about ${10 - k} times in 10.`
  return {
    pick: p,
    title: `What ${signed2(p.value)} means`,
    text: `${last} ${r.n}+ ${STAT_UNIT[p.line.stat]} at ${r.odd.toFixed(1)} lands about ${often}. ${tail}`,
    per100: Math.round(p.ours * 1000) / 10,
    back: Math.round(p.ours * 100 * r.odd),
  }
}

/** Short stat names for rung labels and results: "AST 7+", "had 9 ast". */
export const STAT_SHORT: Record<Stat, string> = {
  '3PM': '3PM',
  REB: 'REB',
  AST: 'AST',
  STL: 'STL',
  BLK: 'BLK',
  PTS: 'PTS',
  WIN: '',
  MAR: '',
  TOT: '',
  TEAM: '',
}

export function rungName(stat: Stat, n: number): string {
  return stat === '3PM' ? `${n}+ 3PM` : `${STAT_SHORT[stat]} ${n}+`
}

/** What he had in a stat, short: "9 ast", "2 3pm"; empty before the result. */
export function hadOf(l: Line): string {
  if (l.actual == null) return ''
  return `${Number.isInteger(l.actual) ? l.actual : l.actual.toFixed(1)} ${STAT_SHORT[l.stat].toLowerCase()}`
}

/** Where a pick's result stands: landed or missed with what he had, playing, or still to tip. */
export function resultOf(p: Pick): { kind: 'landed' | 'missed' | 'out' | 'live' | 'pending'; had: string } {
  const l = p.line
  const had = l.actual == null ? '' : `had ${hadOf(l)}`
  if (p.rung.hit === true) return { kind: 'landed', had }
  if (p.rung.hit === false) return { kind: 'missed', had }
  if (l.game.status === 'final') return { kind: 'out', had: l.played === false ? "didn't play" : '' }
  return { kind: l.tipped ? 'live' : 'pending', had: '' }
}

/** A viewer's own choice kept in this browser (the finds view, the Tape folded). Storage can be
 *  missing or blocked (private windows, previews), so every read and write is guarded and the page
 *  works without it. */
export function loadChoice<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key)
    return allowed.find((a) => a === v) ?? null
  } catch {
    return null
  }
}

export function saveChoice(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage blocked: the choice lasts for this page view
  }
}

// ---------------------------------------------------------------------------------------------
// The Scorecard: who read the rungs better, stat by stat (Brier scores from the server's tally)

/** Brier gaps under this show as Level: at one night's rung counts the difference is noise. To tune
 *  once per-rung variance is available. */
export const LEVEL_GAP = 0.004

/** Which side's chances scored better (lower), or level when the gap is under LEVEL_GAP. */
export function readBetter(ours: number | null | undefined, book: number | null | undefined): Closer | null {
  if (ours == null || book == null) return null
  const gap = Math.round(Math.abs(ours - book) * 1e6) / 1e6
  if (gap < LEVEL_GAP) return 'tie'
  return ours < book ? 'ours' : 'book'
}

export interface ScoreRow {
  stat: Stat | 'ALL'
  rungs: number
  ours: number | null
  book: number | null
  read: Closer | null
  split: { ours: number; level: number; book: number }
}

/** One row per player stat (the site's order) and an All row weighted by rungs. The split counts the
 *  player rows by whose rung chances read them better (the same tag the rows carry). */
export function scoreRows(tally: CompareTally[], lines: Line[]): ScoreRow[] {
  const rows: ScoreRow[] = []
  let w = 0
  let so = 0
  let sb = 0
  const all = { ours: 0, level: 0, book: 0 }
  for (const stat of PLAYER_STATS) {
    const t = tally.find((x) => statOf(x.stat) === stat)
    const ls = lines.filter((l) => l.kind === 'player' && l.stat === stat && l.rungs.length > 0)
    const split = { ours: 0, level: 0, book: 0 }
    for (const l of ls) {
      if (l.rungCloser === 'ours') split.ours++
      else if (l.rungCloser === 'book') split.book++
      else if (l.rungCloser === 'tie') split.level++
    }
    all.ours += split.ours
    all.level += split.level
    all.book += split.book
    const rungs = t?.rungs ?? 0
    const ours = rungs ? (t?.ours_rung_score ?? null) : null
    const book = rungs ? (t?.book_rung_score ?? null) : null
    if (!t && !ls.length) continue
    if (ours != null && book != null) {
      w += rungs
      so += ours * rungs
      sb += book * rungs
    }
    rows.push({ stat, rungs, ours, book, read: readBetter(ours, book), split })
  }
  const ours = w ? so / w : null
  const book = w ? sb / w : null
  rows.push({ stat: 'ALL', rungs: w, ours, book, read: readBetter(ours, book), split: all })
  return rows
}
