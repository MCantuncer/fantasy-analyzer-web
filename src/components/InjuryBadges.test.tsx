import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PlayerRef } from '../api/client'
import { InjuryBadges } from './InjuryBadges'

const player = (name: string, injury_status: string) => ({ id: name.length, name, injury_status }) as PlayerRef

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
})
