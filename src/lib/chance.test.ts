import { describe, expect, it } from 'vitest'
import { oneIn, oneInN } from './chance'

describe('oneIn', () => {
  it('reads the accept chance as 1 in N, N being 1/p rounded', () => {
    expect(oneIn(0.11)).toBe('1 in 9')
    expect(oneIn(0.07)).toBe('1 in 14')
    expect(oneIn(0.2)).toBe('1 in 5')
    expect(oneIn(0.02)).toBe('1 in 50')
  })

  it('stops at 1 in 2 at the top and 1 in 100 at the bottom', () => {
    expect(oneInN(0.5)).toBe(2)
    expect(oneInN(0.9)).toBe(2)
    expect(oneInN(0.004)).toBe(100)
    expect(oneInN(0)).toBe(100)
  })
})
