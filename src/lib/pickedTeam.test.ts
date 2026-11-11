import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadPickedTeam, storePickedTeam, usePickedTeam } from './pickedTeam'

beforeEach(() => localStorage.clear())

describe('picked team', () => {
  it('is remembered per league and season, and forgotten on null', () => {
    storePickedTeam(7, 2027, 3)
    expect(loadPickedTeam(7, 2027)).toBe(3)
    expect(loadPickedTeam(7, 2026)).toBeNull()
    expect(loadPickedTeam(8, 2027)).toBeNull()
    storePickedTeam(7, 2027, null)
    expect(loadPickedTeam(7, 2027)).toBeNull()
  })

  it('ignores anything that is not a team id', () => {
    localStorage.setItem('picked-team:7:2027', 'abc')
    expect(loadPickedTeam(7, 2027)).toBeNull()
  })

  it('follows the league on screen and saves what is picked', () => {
    storePickedTeam(7, 2027, 3)
    const { result, rerender } = renderHook(({ league }: { league?: number }) => usePickedTeam(league, 2027), {
      initialProps: { league: undefined as number | undefined },
    })
    expect(result.current[0]).toBeNull() // no league yet
    rerender({ league: 7 })
    expect(result.current[0]).toBe(3)
    act(() => result.current[1](5))
    expect(result.current[0]).toBe(5)
    expect(loadPickedTeam(7, 2027)).toBe(5)
    rerender({ league: 8 })
    expect(result.current[0]).toBeNull()
    rerender({ league: 7 })
    expect(result.current[0]).toBe(5)
  })
})
