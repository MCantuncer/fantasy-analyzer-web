import { describe, expect, it } from 'vitest'
import { ratioPct, shotPct } from './shooting'

describe('shotPct', () => {
  it('prints three decimals without the leading zero', () => {
    expect(shotPct(7, 15)).toBe('.467')
    expect(shotPct(8, 15)).toBe('.533')
    expect(shotPct(0, 4)).toBe('.000')
  })
  it('prints a perfect night as 1.000', () => {
    expect(shotPct(6, 6)).toBe('1.000')
  })
  it('dashes when there were no attempts', () => {
    expect(shotPct(0, 0)).toBe('–')
  })
})

describe('ratioPct', () => {
  it('formats a stored ratio', () => {
    expect(ratioPct(0.4862)).toBe('.486')
    expect(ratioPct(1)).toBe('1.000')
    expect(ratioPct(null)).toBe('–')
  })
})
