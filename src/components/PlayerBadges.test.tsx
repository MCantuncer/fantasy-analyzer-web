import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerBadge } from '../api/client'
import { InjuryTag, PlayerBadges } from './PlayerBadges'

const keystone = { kind: 'keystone', category: 'BLK', reason: 'His owner leans on him for blocks.' } as PlayerBadge
const hot = { kind: 'hot', reason: 'Playing well above his line.' } as PlayerBadge

describe('PlayerBadges', () => {
  it('draws icons that name themselves for screen readers', () => {
    render(<PlayerBadges badges={[keystone, hot]} />)
    expect(screen.getByRole('img', { name: 'Keystone · BLK: His owner leans on him for blocks.' })).toHaveTextContent('BLK')
    expect(screen.getByRole('img', { name: /^Hot:/ })).toBeInTheDocument()
    expect(screen.queryByText('Hot')).toBeNull()
  })

  it('shows the word and reason on tap without clicking the row', () => {
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <PlayerBadges badges={[keystone]} />
      </div>,
    )
    fireEvent.click(screen.getAllByRole('img', { name: /^Keystone/ }).at(-1)!)
    expect(onRow).not.toHaveBeenCalled()
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Keystone · BLK')
    expect(tip).toHaveTextContent('leans on him for blocks')
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
