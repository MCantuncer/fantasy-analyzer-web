import { describe, expect, it } from 'vitest'
import { draftRound, longValue, premiumValue, shortValue, valueSentence } from './tradeValue'

const ROUNDS = [50, 32, 20, 12, 7, 5, 4, 3, 2, 2, 0, 0, 0]

describe('trade value', () => {
  it('shows dollars in auction leagues', () => {
    expect(shortValue(23.6, null)).toBe('$24')
    expect(valueSentence(30, 28, null)).toBe('They get $30 of value for $28')
    expect(premiumValue(6.2, 40, null)).toBe('$6')
  })

  it('maps a value to the round a player like that goes in', () => {
    expect(draftRound(60, ROUNDS)).toBe(1)
    expect(draftRound(50, ROUNDS)).toBe(1)
    expect(draftRound(49, ROUNDS)).toBe(2)
    expect(draftRound(2, ROUNDS)).toBe(9)
  })

  it('never prices a round with no value: those are late or waiver level', () => {
    expect(shortValue(1, ROUNDS)).toBe('Late')
    expect(shortValue(0.2, ROUNDS)).toBe('Waiver')
    expect(longValue(0, ROUNDS)).toBe('waiver-level value')
  })

  it('writes snake values as rounds', () => {
    expect(shortValue(25, ROUNDS)).toBe('Rd 3')
    expect(valueSentence(33, 21, ROUNDS)).toBe("They get a 2nd-round pick's worth for a 3rd-round pick's worth")
    expect(premiumValue(3, 20, ROUNDS)).toBe('15%')
  })
})
