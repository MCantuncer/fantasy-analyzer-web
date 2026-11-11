import { describe, expect, it } from 'vitest'
import { keptNames } from './untouchable'

describe('keptNames', () => {
  it('names one or two keepers in full', () => {
    expect(keptNames(['Kyshawn George'])).toBe('Kyshawn George')
    expect(keptNames(['Kyshawn George', 'Jayson Tatum'])).toBe('Kyshawn George and Jayson Tatum')
  })

  it('counts the rest from three keepers on, so the line never grows', () => {
    expect(keptNames(['Kyshawn George', 'Jayson Tatum', 'Jarrett Allen'])).toBe('Kyshawn George and 2 more')
  })
})
