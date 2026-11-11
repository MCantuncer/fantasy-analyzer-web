import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerRef } from '../api/client'
import { Untouchable, UntouchableWorking } from './Untouchable'

const player = (id: number, name: string, value: number) =>
  ({ id, name, positions: ['SF'], pro_team: 'BOS', perceived_value: value, injury_status: 'ACTIVE' }) as PlayerRef

const roster = [player(1, 'Davion Mitchell', 4), player(2, 'Jayson Tatum', 60), player(3, 'Kyshawn George', 19)]

afterEach(cleanup)

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

  it('says the moves below are the old ones while they are worked out again', () => {
    render(<UntouchableWorking names={['Kyshawn George', 'Jayson Tatum', 'Jarrett Allen']} />)
    expect(screen.getByRole('status')).toHaveTextContent('Working out your moves without Kyshawn George and 2 more')
    expect(screen.getByText('Until then, the moves below are the old ones.')).toBeInTheDocument()
  })
})
