// Value rungs: the book's "n+" rungs read against our chance. The maths the page draws from, kept
// apart from the components so it can be tested. Comparison only: nothing here feeds the model.
//
// price = 1 ÷ odds: the chance the odds need to break even.
// value = ours × odds − 1: what one unit returns on average if our chance is right.
// A rung beats its price when our chance is above the price, which is the same as value > 0.

import { MIN_ODD, odds } from './iddaaCompare'
import type { Closer, CompareRung } from './iddaaCompare'

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
