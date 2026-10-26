import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

  it('marks healthy injury-prone players with their expected games', () => {
    const lavine = player('Zach LaVine', 'ACTIVE', { injury_prone: true, games_share: 0.62 })
    const { container } = render(<InjuryBadges players={[lavine, player('Bam Adebayo', 'ACTIVE')]} />)
    const chip = within(container).getByText('LaVine: Injury-prone · ~51 of 82 games')
    expect(chip).toHaveClass('badge-warn')
    expect(chip).toHaveAttribute('title', expect.stringContaining('fewer games'))
  })

  it('shows only the injury for a prone player who is already out', () => {
    const embiid = player('Joel Embiid', 'OUT', { injury_prone: true, games_share: 0.5 })
    const { container } = render(<InjuryBadges players={[embiid]} />)
    expect(within(container).getByText('Out')).toBeInTheDocument()
    expect(within(container).queryByText(/Injury-prone/)).toBeNull()
  })
})
