import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerBadge, PlayerRef } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { BadgeNotes, InjuryTag, PlayerBadges } from './PlayerBadges'

const keystone = { kind: 'keystone', category: 'BLK', reason: 'His owner leans on him for blocks.' } as PlayerBadge
const hot = { kind: 'hot', reason: 'Playing well above his line.' } as PlayerBadge

describe('PlayerBadges', () => {
  afterEach(cleanup)

  it('spells each badge out as a chip, with the reason for screen readers', () => {
    const { container } = render(<PlayerBadges badges={[keystone, hot]} />)
    const chips = [...container.querySelectorAll('.pb-chip')]
    expect(chips.map((c) => c.firstChild?.textContent)).toEqual(['Keystone BLK', 'Hot'])
    expect(chips[0]).toHaveTextContent('Keystone BLK: His owner leans on him for blocks.')
    expect(container.querySelector('svg')).toBeNull()
  })

  it('shows the reason on tap without clicking the row', () => {
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <PlayerBadges badges={[keystone]} />
      </div>,
    )
    fireEvent.click(screen.getByText('Keystone BLK'))
    expect(onRow).not.toHaveBeenCalled()
    expect(screen.getByRole('tooltip')).toHaveTextContent('His owner leans on him for blocks.')
  })

  it('closes the bubble with Escape', () => {
    render(<PlayerBadges badges={[hot]} />)
    fireEvent.click(screen.getByText('Hot'))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('renders nothing without badges', () => {
    const { container } = render(<PlayerBadges badges={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('InjuryTag', () => {
  it('shortens the status and hides for healthy players', () => {
    const { rerender, container } = render(<InjuryTag status="DAY_TO_DAY" />)
    expect(screen.getByText('DTD')).toBeInTheDocument()
    rerender(<InjuryTag status="ACTIVE" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('BadgeNotes', () => {
  afterEach(() => {
    cleanup()
    setPlayerCardHost(null)
  })

  it("opens the player's card from his name, with a small face", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const p = { id: 5, name: 'Evan Mobley', pro_team: 'CLE', badges: [keystone] } as unknown as PlayerRef
    const { container } = render(<BadgeNotes players={[p]} />)
    expect(container.querySelector('li')).toHaveTextContent('Keystone · BLK Evan Mobley: His owner leans on him for blocks.')
    expect(container.querySelector('.pin button.pc-link-face .head')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Evan Mobley' }))
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }))
  })
})
