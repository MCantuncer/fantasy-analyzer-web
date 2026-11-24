import { describe, expect, it } from 'vitest'
import {
  gotText,
  isEdge,
  needs,
  oursText,
  quarterCount,
  quarterGrid,
  quarterLabel,
  sideLabel,
  valueText,
} from './quarterBets'
import { MIL_PHI, quarterBets } from './quarterBets.fixture'

describe('quarter bets', () => {
  const [q1t, q1w, q4w, h1m, h1h] = quarterBets(true)

  it('names each bet the way the book lists it', () => {
    expect(quarterLabel(q1w, MIL_PHI)).toEqual({ when: '1st quarter', what: 'winner' })
    expect(quarterLabel(h1h, MIL_PHI)).toEqual({ when: '1st half', what: 'PHI points' })
    expect(sideLabel(q1t, 'under', MIL_PHI)).toBe('Under 56.5')
    expect(sideLabel(q1w, 'home', MIL_PHI)).toBe('PHI')
    expect(sideLabel(h1m, 'home', MIL_PHI)).toBe('PHI −3.5')
    expect(sideLabel(h1m, 'away', MIL_PHI)).toBe('MIL +3.5')
  })

  it('says our number and what happened in words', () => {
    expect(oursText(q1w, MIL_PHI)).toBe('PHI by 4.0')
    expect(oursText(q1t, MIL_PHI)).toBe('56.0')
    expect(gotText(q1w, MIL_PHI)).toBe('Got PHI by 13')
    expect(gotText(q4w, MIL_PHI)).toBe('Got MIL by 2')
    expect(gotText(q1t, MIL_PHI)).toBe('Got 53')
    expect(gotText(quarterBets(false)[0], MIL_PHI)).toBeNull()
  })

  it('marks an edge only when our chance beats what the price needs', () => {
    expect(needs(1.6)).toBeCloseTo(0.625)
    expect(isEdge(q1w)).toBe(true)
    expect(isEdge(q1t)).toBe(false)
    expect(isEdge(q4w)).toBe(false)
    expect(valueText(0.056)).toBe('+0.06')
    expect(valueText(-0.109)).toBe('−0.11')
  })

  it('lays the bets out by quarter, with holes where the book has none', () => {
    const grid = quarterGrid(quarterBets(true))
    expect(grid.winner.map((b) => b?.period ?? null)).toEqual([1, null, null, 4])
    expect(grid.total.map((b) => b?.period ?? null)).toEqual([1, null, null, null])
    expect(grid.half.map((b) => b?.market ?? null)).toEqual(['h1_margin', null, null, 'h1_home'])
  })

  it('counts bets we lean on, edges and wins', () => {
    expect(quarterCount(quarterBets(true))).toEqual({ bets: 4, edges: 2, settled: 4, won: 4 })
    expect(quarterCount(quarterBets(false))).toEqual({ bets: 4, edges: 2, settled: 0, won: 0 })
  })
})
