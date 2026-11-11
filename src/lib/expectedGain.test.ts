import { describe, expect, it } from 'vitest'
import { expectedGain, expectedGainSpoken, expectedGainText } from './expectedGain'

describe('expectedGain', () => {
  it('is the gain in playoff-odds points times the chance of a yes', () => {
    expect(expectedGain(0.34, 0.47, 0.54)).toBeCloseTo(2.38)
    expect(expectedGain(0.09, 0.47, 0.5)).toBeCloseTo(0.27)
  })

  it('prints one signed decimal', () => {
    expect(expectedGainText(2.38)).toBe('+2.4')
    expect(expectedGainText(0.27)).toBe('+0.3')
    expect(expectedGainText(-0.62)).toBe('−0.6')
  })

  it('uses words when the number rounds to nothing', () => {
    expect(expectedGainText(0.04)).toBe('under +0.1')
    expect(expectedGainText(0)).toBe('under +0.1')
    expect(expectedGainText(-0.02)).toBe('just under 0')
  })

  it('names the unit for screen readers', () => {
    expect(expectedGainSpoken(2.38)).toBe('plus 2.4 playoff odds points')
    expect(expectedGainSpoken(0.04)).toBe('under plus 0.1 playoff odds points')
  })
})
