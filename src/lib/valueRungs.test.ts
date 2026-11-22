import { describe, expect, it } from 'vitest'
import type { CompareRung } from './iddaaCompare'
import { MIN_ODD } from './iddaaCompare'
import {
  brier,
  closerCount,
  hadAt,
  isValue,
  ladderNote,
  pctText,
  price,
  rungCount,
  rungLabel,
  rungWinner,
  signed2,
  valueOf,
} from './valueRungs'

const rung = (n: number, odd: number, ours: number | null, hit: boolean | null, book = 0.82 / odd): CompareRung => ({
  n,
  odd,
  book,
  ours,
  value: ours == null ? null : ours * odd - 1,
  hit,
})

// Tyler Herro, 21 Nov: had 50 against our 19.5 and the book's 22 (the design's example).
const HERRO = [
  rung(20, 1.36, 0.48, true),
  rung(22, 1.63, 0.37, true),
  rung(25, 2.26, 0.23, true),
  rung(28, 3.4, 0.12, true),
  rung(30, 4.53, 0.08, true),
  rung(35, 10.19, 0.025, true),
  rung(40, 27.17, 0.007, true),
]

describe('price and value', () => {
  it('price is the chance the odds need: 1 ÷ odds', () => {
    expect(price(2.11)).toBeCloseTo(0.4739, 4)
    expect(price(15.1)).toBeCloseTo(0.0662, 4)
  })
  it('value is ours × odds − 1, and beats the price exactly when ours is above it', () => {
    expect(valueOf(0.616, 2.11)).toBeCloseTo(0.2998, 4) // Spencer AST 7+: +0.30
    expect(valueOf(0.096, 15.1)).toBeCloseTo(0.4496, 4) // Clingan BLK 5+: +0.45
    expect(valueOf(price(3), 3)).toBeCloseTo(0, 10)
    expect(valueOf(0.3, 3) > 0).toBe(0.3 > price(3))
  })
  it('a value rung needs value over 0 at odds over 1.33', () => {
    expect(MIN_ODD).toBe(1.33)
    expect(isValue(rung(5, 1.29, 0.84, null))).toBe(false)
    expect(isValue(rung(5, 1.33, 0.84, null))).toBe(false)
    expect(isValue(rung(6, 1.63, 0.72, null))).toBe(true)
    expect(isValue(rung(6, 1.63, 0.5, null))).toBe(false)
    expect(isValue(rung(6, 1.63, null, null))).toBe(false)
  })
})

describe('formats', () => {
  it('percent keeps one decimal only under 10%', () => {
    expect(pctText(0.096)).toBe('9.6%')
    expect(pctText(0.06622)).toBe('6.6%')
    expect(pctText(0.05)).toBe('5%')
    expect(pctText(0.616)).toBe('62%')
  })
  it('signed values carry the sign', () => {
    expect(signed2(0.2998)).toBe('+0.30')
    expect(signed2(-0.81)).toBe('−0.81')
    expect(signed2(0)).toBe('0.00')
  })
  it('a rung reads in full for screen readers', () => {
    expect(rungLabel(rung(7, 2.11, 0.616, true, 0.39), 'assists')).toBe(
      '7+ assists at 2.11: ours 62%, needs 47%, book 39%, value +0.30, landed',
    )
  })
})

describe('rung by rung', () => {
  it('the higher chance is nearer when the rung lands, the lower when it misses', () => {
    expect(rungWinner(rung(20, 1.36, 0.48, true, 0.6))).toBe('book')
    expect(rungWinner(rung(20, 1.36, 0.48, false, 0.6))).toBe('ours')
    expect(rungWinner(rung(20, 1.36, 0.6, true, 0.6))).toBe('tie')
    expect(rungWinner(rung(20, 1.36, 0.48, null))).toBeNull()
    expect(rungWinner(rung(20, 1.36, null, true))).toBeNull()
  })
  it('counts and tags: Book 7 of 7 for Herro', () => {
    expect(rungCount(HERRO)).toEqual({ ours: 0, book: 7, level: 0, n: 7 })
    expect(closerCount(HERRO, 'book')).toBe('7 of 7')
    const split = [rung(1, 2, 0.6, true, 0.5), rung(2, 3, 0.2, false, 0.3), rung(3, 4, 0.3, true, 0.4), rung(4, 5, 0.3, false, 0.2)]
    expect(closerCount(split, 'tie')).toBe('2 of 4 each')
    expect(closerCount([rung(1, 2, 0.5, null)], 'ours')).toBe('')
  })
  it('Brier: mean squared distance from what happened, settled rungs only', () => {
    expect(brier([rung(1, 2, 0.5, true), rung(2, 3, 0.2, false)], 'ours')).toBeCloseTo((0.25 + 0.04) / 2, 10)
    expect(brier([rung(1, 2, 0.5, null)], 'ours')).toBeNull()
    expect(brier(HERRO, 'ours')! > brier(HERRO, 'book')!).toBe(true)
  })
})

describe('the Had N rule', () => {
  const desc = [{ n: 13 }, { n: 12 }, { n: 10 }, { n: 9 }, { n: 8 }]
  it('sits above the first rung he reached', () => {
    expect(hadAt(desc, 9)).toBe(3)
    expect(hadAt(desc, 11)).toBe(2)
  })
  it('goes on top when every rung landed and under the last when none did', () => {
    expect(hadAt(desc, 50)).toBe(0)
    expect(hadAt(desc, 2)).toBe(desc.length)
  })
})

describe('the ladder note, from the rungs only', () => {
  it('settled, every rung landed, no value', () => {
    const n = ladderNote(HERRO, 50, 'book')
    expect(n.lead).toBe('Had 50: every rung landed')
    expect(n.rest).toBe(', so on each rung the side that gave the higher chance was nearer. The book was nearer on all 7.')
    expect(n.value).toBe('No rung beat its price: from −0.35 at 20+ to −0.81 at 40+.')
  })
  it('pre-game, one or two value rungs are named with ours and the price', () => {
    const n = ladderNote([rung(7, 2.55, 0.44, null), rung(8, 3.45, 0.31, null), rung(9, 4.8, 0.15, null)], null, null)
    expect(n.lead).toBe('')
    expect(n.value).toBe('2 rungs beat their price: 7+ at 2.55 (ours 44%, needs 39%) and 8+ at 3.45 (ours 31%, needs 29%).')
  })
  it('more than two value rungs name the best one', () => {
    const n = ladderNote([rung(6, 1.63, 0.72, true), rung(7, 2.11, 0.616, true), rung(8, 2.91, 0.45, true), rung(10, 6.04, 0.19, false)], 9, 'ours')
    expect(n.lead).toBe('Had 9: 3 of 4 rungs landed')
    expect(n.value).toBe('4 rungs beat their price; the best is 8+ at 2.91, value +0.31.')
  })
  it('leaves out rungs at odds of 1.33 or lower', () => {
    const n = ladderNote([rung(5, 1.29, 0.84, true), rung(6, 1.63, 0.5, true)], 9, 'book')
    expect(n.lead).toBe('Had 9: every rung landed')
    expect(n.value).toBe('No rung beat its price: −0.19 at 6+.')
  })
})
