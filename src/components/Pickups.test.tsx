import { fireEvent, render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PickupIdea } from '../api/client'
import { Pickups } from './Pickups'

const ref = (id: number, name: string) =>
  ({ id, name, positions: ['SF'], percent_owned: 40, injury_status: 'ACTIVE' }) as PickupIdea['add']

const pickup = {
  add: ref(1, 'Miles Bridges'),
  drop: ref(2, 'Aaron Wiggins'),
  open_spot_by_trade: false,
  availability: 'WAIVERS',
  playoff_pct_before: 0.14,
  playoff_pct_after: 0.2,
  category_changes: {},
} as unknown as PickupIdea

describe('Pickups waiver priority', () => {
  it('shows your place in the waiver order in leagues without FAAB', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={null} waiverPriority={2} teams={12} />)
    const view = within(container)
    expect(view.getByText('Waiver priority 2nd of 12')).toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { expanded: false }))
    expect(view.getByText(/A claim uses your waiver priority \(2nd\)/)).toBeInTheDocument()
  })

  it('shows FAAB instead when the league bids', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={98} waiverPriority={null} teams={10} />)
    const view = within(container)
    expect(view.getByText('$98 FAAB left')).toBeInTheDocument()
    expect(view.queryByText(/Waiver priority/)).toBeNull()
  })
})
