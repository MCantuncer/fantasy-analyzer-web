import { describe, expect, it } from 'vitest'
import type { CategoryDetail, OfferCheck } from '../api/client'
import {
  EMPTY_DEAL,
  type CheckDeal,
  canCheck,
  checkSummary,
  cutsNeeded,
  decodeDeal,
  encodeDeal,
  inCategoryOrder,
  pointChange,
  reasonTail,
  togglePlayer,
} from './tradeCheck'

describe('deal in the URL', () => {
  it('round-trips a full deal', () => {
    const deal = {
      partner: 9,
      give: [1, 2],
      get: [3],
      mode: 'sending' as const,
      cut: null,
    }
    expect(encodeDeal(deal)).toBe('t9.g1-2.r3.s')
    expect(decodeDeal('t9.g1-2.r3.s')).toEqual(deal)
    const withCut = {
      ...deal,
      give: [1],
      get: [3, 4],
      mode: 'received' as const,
      cut: 7,
    }
    expect(decodeDeal(encodeDeal(withCut))).toEqual(withCut)
  })

  it('ignores junk and keeps three a side', () => {
    expect(decodeDeal('')).toBeNull()
    expect(decodeDeal('g1-2')).toBeNull() // no team
    expect(decodeDeal('t4.gx-5-6-7-8.zz')).toEqual({
      ...EMPTY_DEAL,
      partner: 4,
      give: [5, 6, 7],
    })
    expect(encodeDeal(EMPTY_DEAL)).toBe('')
  })
})

describe('picking', () => {
  it('toggles, caps at three and drops a cut when the shape changes', () => {
    let d: CheckDeal = { ...EMPTY_DEAL, partner: 2, cut: 9 }
    d = togglePlayer(d, 'give', 1)
    expect(d.give).toEqual([1])
    expect(d.cut).toBeNull()
    d = togglePlayer(togglePlayer(togglePlayer(d, 'give', 2), 'give', 3), 'give', 4)
    expect(d.give).toEqual([1, 2, 3])
    expect(togglePlayer(d, 'give', 2).give).toEqual([1, 3])
    expect(canCheck(d)).toBe(false)
    d = togglePlayer(d, 'get', 8)
    expect(canCheck(d)).toBe(true)
    expect(cutsNeeded({ give: [1], get: [2, 3] })).toBe(1)
    expect(cutsNeeded({ give: [1, 2], get: [3] })).toBe(0)
  })
})

describe('numbers', () => {
  it('changes are the difference of the rounded ends', () => {
    expect(pointChange(0.531, 0.344)).toBe(-19)
    expect(pointChange(0.429, 0.468)).toBe(4)
    expect(pointChange(0.5, 0.5049)).toBe(0)
  })

  it('sorts categories into the fixed order', () => {
    const rows = ['PTS', 'TO', 'FG%', 'REB', 'AST', 'FT%', 'BLK', '3PM', 'STL'].map(
      (category) => ({ category }) as CategoryDetail,
    )
    expect(inCategoryOrder(rows).map((r) => r.category)).toEqual([
      'FG%',
      'FT%',
      '3PM',
      'REB',
      'AST',
      'STL',
      'BLK',
      'TO',
      'PTS',
    ])
  })

  it('drops the first sentence of the reason', () => {
    expect(reasonTail('Your playoff odds go up 4 points. Stronger in AST and STL.')).toBe('Stronger in AST and STL.')
    expect(reasonTail('Your playoff odds go up 4 points.')).toBe('')
  })

  it('reads both teams for screen readers', () => {
    const check = {
      call: 'take',
      partner_call: 'lose',
      partner_team_name: 'Aliaga Hermanos',
      paper_win: false,
      direction: 'received',
      idea: {
        playoff_pct_before: 0.429,
        playoff_pct_after: 0.468,
        partner_playoff_pct_before: 0.719,
        partner_playoff_pct_after: 0.697,
        value_they_get: 10.5,
        value_they_give: 25.9,
        acceptance_label: 'long_shot',
      },
    } as unknown as OfferCheck
    expect(checkSummary(check)).toBe(
      'Take it. Your playoff odds 43 to 47 percent, up 4. Aliaga Hermanos 72 to 70, down 2, worse for them, loses on paper, $11 for $26.',
    )
    expect(checkSummary({ ...check, direction: 'sending' })).toContain('Chance they say yes: long shot.')
  })
})
