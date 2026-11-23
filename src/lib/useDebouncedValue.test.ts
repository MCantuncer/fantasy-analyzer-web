import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts with the first value', () => {
    const { result } = renderHook(() => useDebouncedValue([1], 700))
    expect(result.current).toEqual([1])
  })

  it('moves only once the value has settled for the wait', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 700), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    act(() => vi.advanceTimersByTime(699))
    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('ab')
  })

  it('restarts the wait on every change, so a burst settles into one value', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 700), { initialProps: { v: 1 } })
    rerender({ v: 2 })
    act(() => vi.advanceTimersByTime(500))
    rerender({ v: 3 })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe(1)
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe(3)
  })
})
