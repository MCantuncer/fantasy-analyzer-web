import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerRef } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { Untouchable, UntouchableWorking } from './Untouchable'

const player = (id: number, name: string, value: number) =>
  ({ id, name, positions: ['SF'], pro_team: 'BOS', perceived_value: value, injury_status: 'ACTIVE' }) as PlayerRef

const roster = [player(1, 'Davion Mitchell', 4), player(2, 'Jayson Tatum', 60), player(3, 'Kyshawn George', 19)]

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

describe('Untouchable', () => {
  it('shows the roster best first and takes one tap to say everyone is available', () => {
    const onEveryone = vi.fn()
    render(<Untouchable roster={roster} keep={[]} onToggleKeep={() => {}} onEveryone={onEveryone} onMyTeam={() => {}} />)
    const tiles = screen.getAllByRole('button', { pressed: false })
    expect(tiles.map((b) => b.getAttribute('aria-label'))).toEqual(['Jayson Tatum', 'Kyshawn George', 'Davion Mitchell'])
    fireEvent.click(screen.getByRole('button', { name: 'Everyone is available' }))
    expect(onEveryone).toHaveBeenCalledOnce()
  })

  it('keeps a tapped player and steps "Everyone is available" aside', () => {
    const onToggleKeep = vi.fn()
    render(<Untouchable roster={roster} keep={[3]} onToggleKeep={onToggleKeep} onEveryone={() => {}} onMyTeam={() => {}} />)
    expect(screen.getByRole('button', { name: 'Kyshawn George' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Everyone is available' })).toBeNull()
    expect(screen.getByText(/Takes 1 to 3 minutes/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Jayson Tatum' }))
    expect(onToggleKeep).toHaveBeenCalledWith(2)
  })

  it('lists the kept players under the faces, each name opening his card', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = render(
      <Untouchable roster={roster} keep={[3, 2]} onToggleKeep={() => {}} onEveryone={() => {}} onMyTeam={() => {}} />,
    )
    const line = container.querySelector('.unt-kept') as HTMLElement
    expect(line).toHaveTextContent('Kept: Jayson Tatum, Kyshawn George')
    expect(line.querySelectorAll('.head')).toHaveLength(2)
    // The tile stays the Keep switch; the name below it opens the card.
    fireEvent.click(line.querySelector('button.pc-link:not(.pc-link-face)') as HTMLElement)
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }))
  })

  it('links the names it is working without', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    render(<UntouchableWorking players={[roster[2], roster[1]]} />)
    expect(screen.getByRole('status')).toHaveTextContent('Working out your moves without Kyshawn George and Jayson Tatum')
    fireEvent.click(screen.getByRole('button', { name: 'Kyshawn George' }))
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
  })

  it('says the moves below are the old ones while they are worked out again', () => {
    render(<UntouchableWorking players={[roster[2], roster[1], player(4, 'Jarrett Allen', 30)]} />)
    expect(screen.getByRole('status')).toHaveTextContent('Working out your moves without Kyshawn George and 2 more')
    expect(screen.getByText('Until then, the moves below are the old ones.')).toBeInTheDocument()
  })
})
