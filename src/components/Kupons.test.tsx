import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Line } from '../lib/iddaaCompare'
import { setPlayerCardHost } from '../lib/playerCard'
import { PickName } from './Kupons'

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

const line = (playerId: number | null) => ({ name: 'Ausar Thompson', playerId }) as Line

describe('a Kupon pick name', () => {
  it("opens the player's card", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    render(<PickName line={line(4433)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ausar Thompson: player details' }))
    expect(open).toHaveBeenCalledWith({ id: 4433, name: 'Ausar Thompson' })
  })

  it('is plain text with no card to open', () => {
    act(() => setPlayerCardHost({ open: vi.fn(), prefetch: () => {} }))
    render(<PickName line={line(null)} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Ausar Thompson')).toBeTruthy()
  })
})
