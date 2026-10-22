import { describe, expect, it } from 'vitest'
import { names, ptsDiff, signedInt } from './format'

describe('format', () => {
  it('diffs the rounded percentages so the delta matches what is shown', () => {
    expect(ptsDiff(0.102, 0.179)).toBe(8)
    expect(ptsDiff(0.2, 0.15)).toBe(-5)
  })

  it('signs whole numbers with a real minus sign', () => {
    expect(signedInt(8)).toBe('+8')
    expect(signedInt(-3)).toBe('−3')
    expect(signedInt(0)).toBe('±0')
  })

  it('joins player names', () => {
    expect(names([{ name: 'Josh Giddey' }, { name: 'Dyson Daniels' }])).toBe('Josh Giddey + Dyson Daniels')
  })
})
