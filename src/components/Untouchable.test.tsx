import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerRef } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { railName } from '../lib/untouchable'
import { Untouchable, UntouchableLine, UntouchableWorking } from './Untouchable'

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
    render(<Untouchable roster={roster} keep={[]} onToggleKeep={() => {}} onEveryone={onEveryone} />)
    const tiles = screen.getAllByRole('button', { pressed: false })
    expect(tiles.map((b) => b.getAttribute('aria-label'))).toEqual(['Jayson Tatum', 'Kyshawn George', 'Davion Mitchell'])
    fireEvent.click(screen.getByRole('button', { name: 'Everyone is available' }))
    expect(onEveryone).toHaveBeenCalledOnce()
    // No filler under the question: no "Tap anyone…", no "Change it any time in My Team".
    expect(screen.queryByText(/My Team/)).toBeNull()
  })

  it('says how many trades wait for the answer', () => {
    const { container, rerender } = render(
      <Untouchable roster={roster} keep={[]} onToggleKeep={() => {}} onEveryone={() => {}} waiting={7} />,
    )
    expect(container.querySelector('.unt-wait')).toHaveTextContent('7 trades wait for your answer')
    rerender(<Untouchable roster={roster} keep={[]} onToggleKeep={() => {}} onEveryone={() => {}} waiting={0} />)
    expect(container.querySelector('.unt-wait')).toBeNull()
  })

  it('names each face by the last name, or the first when the last is too long', () => {
    expect(railName('Kyshawn George')).toBe('George')
    expect(railName('Giannis Antetokounmpo')).toBe('Giannis')
    expect(railName('Julian Champagnie')).toBe('Champagnie')
  })

  it('keeps a tapped player and steps "Everyone is available" aside', () => {
    const onToggleKeep = vi.fn()
    render(<Untouchable roster={roster} keep={[3]} onToggleKeep={onToggleKeep} onEveryone={() => {}} />)
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
      <Untouchable roster={roster} keep={[3, 2]} onToggleKeep={() => {}} onEveryone={() => {}} />,
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

describe('UntouchableLine', () => {
  it('says Nobody, and Change opens the face rail in place', () => {
    const onToggleKeep = vi.fn()
    const { container } = render(<UntouchableLine roster={roster} keep={[]} onToggleKeep={onToggleKeep} />)
    expect(container.querySelector('.unt-answer-line')).toHaveTextContent('UntouchableNobodyChange')
    const change = screen.getByRole('button', { name: 'Change' })
    expect(change).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('group')).toBeNull()
    fireEvent.click(change)
    expect(change).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Kyshawn George' }))
    expect(onToggleKeep).toHaveBeenCalledWith(3)
  })

  it('names the kept players, best first, each opening his card with a face', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = render(<UntouchableLine roster={roster} keep={[3, 2]} onToggleKeep={() => {}} />)
    const value = container.querySelector('.unt-answer-v') as HTMLElement
    expect(value).toHaveTextContent('Tatum, George')
    expect(value.querySelectorAll('.head')).toHaveLength(2)
    fireEvent.click(value.querySelector('button.pc-link:not(.pc-link-face)') as HTMLElement)
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }))
  })
})
