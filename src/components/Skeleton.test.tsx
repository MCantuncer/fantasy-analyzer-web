import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GIVE_UP_SECONDS, ScoresSkeleton } from './Skeleton'

describe('slow load pill', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('counts while the server wakes up, then says it is down instead of counting on', () => {
    render(<ScoresSkeleton />)
    expect(screen.queryByText(/Waking up the server/)).toBeNull()

    act(() => vi.advanceTimersByTime(7_000))
    expect(screen.getByText(/Waking up the server/)).toBeTruthy()

    act(() => vi.advanceTimersByTime(GIVE_UP_SECONDS * 1000))
    expect(screen.queryByText(/Waking up the server/)).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain("The server isn't answering right now")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
