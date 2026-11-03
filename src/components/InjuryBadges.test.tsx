import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerRef } from '../api/client'
import { InjuryBadges } from './InjuryBadges'

const player = (name: string, injury_status: string, extra: Partial<PlayerRef> = {}) =>
  ({ id: name.length, name, injury_status, ...extra }) as PlayerRef

describe('InjuryBadges', () => {
  it('flags only players who are not fully healthy', () => {
    render(<InjuryBadges players={[player('Yves Missi', 'DAY_TO_DAY'), player('Bam Adebayo', 'ACTIVE')]} />)
    expect(screen.getByText('Missi: Day-to-day')).toBeInTheDocument()
    expect(screen.queryByText(/Adebayo/)).toBeNull()
  })

  it('renders nothing for a healthy deal', () => {
    const { container } = render(<InjuryBadges players={[player('Bam Adebayo', 'ACTIVE')]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a durability score that explains itself when tapped, without clicking the row', () => {
    const lavine = player('Zach LaVine', 'ACTIVE', { injury_prone: true, games_share: 0.62 })
    const onRow = vi.fn()
    const { container } = render(
      <div onClick={onRow}>
        <InjuryBadges players={[lavine, player('Bam Adebayo', 'ACTIVE')]} />
      </div>,
    )
    const chip = within(container).getByRole('button', { name: /LaVine: Durability 62 out of 100/ })
    expect(chip).toHaveTextContent('62')
    expect(chip).not.toHaveTextContent('Durability')
    expect(chip).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(chip)
    expect(onRow).not.toHaveBeenCalled()
    const pop = screen.getByRole('dialog', { name: 'Durability score for Zach LaVine' })
    expect(pop).toHaveTextContent('62/100 durability')
    expect(pop).toHaveTextContent('A typical starter plays 73')
    expect(chip).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens from the keyboard too', () => {
    const lavine = player('Zach LaVine', 'ACTIVE', { injury_prone: true, games_share: 0.62 })
    const { container } = render(<InjuryBadges players={[lavine]} />)
    fireEvent.keyDown(within(container).getByRole('button', { name: /Durability 62/ }), { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows only the injury for a prone player who is already out', () => {
    const embiid = player('Joel Embiid', 'OUT', { injury_prone: true, games_share: 0.5 })
    const { container } = render(<InjuryBadges players={[embiid]} />)
    expect(within(container).getByText('Out')).toBeInTheDocument()
    expect(within(container).queryByText(/Durability/)).toBeNull()
  })
})
