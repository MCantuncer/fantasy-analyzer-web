import { describe, expect, it } from 'vitest'
import { rowEndOf, tabOrigin } from './frontRow'

const ids = [10, 11, 12, 13, 14, 15, 16, 17, 18]

describe('rowEndOf', () => {
  it('finds the last game in the row, so the box goes right after that row', () => {
    expect(rowEndOf(ids, 10, 4)).toBe(13)
    expect(rowEndOf(ids, 13, 4)).toBe(13)
    expect(rowEndOf(ids, 15, 4)).toBe(17)
    expect(rowEndOf(ids, 11, 2)).toBe(11)
  })

  it('stops at the last game in a short last row', () => {
    expect(rowEndOf(ids, 18, 4)).toBe(18)
    expect(rowEndOf(ids, 18, 3)).toBe(18)
  })

  it('puts it after the whole strip when there are no columns (phones)', () => {
    expect(rowEndOf(ids, 12, 0)).toBe(18)
  })

  it('has no place for a game that is not shown', () => {
    expect(rowEndOf(ids, 99, 4)).toBeNull()
  })
})

describe('tabOrigin', () => {
  it('grows edge cards inward and middle cards from their centre', () => {
    expect(tabOrigin(ids, 10, 4)).toBe('0% 100%')
    expect(tabOrigin(ids, 11, 4)).toBe('50% 100%')
    expect(tabOrigin(ids, 13, 4)).toBe('100% 100%')
    expect(tabOrigin(ids, 14, 4)).toBe('0% 100%')
  })

  it('grows from the left on the phone strip', () => {
    expect(tabOrigin(ids, 15, 0)).toBe('0% 100%')
  })
})
