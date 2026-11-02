import { fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerRef } from '../api/client'
import { RoundValuesContext } from '../lib/tradeValue'
import { Roster } from './Roster'

const player = {
  id: 1,
  name: 'Jalen Green',
  positions: ['SG'],
  injury_status: 'ACTIVE',
  percent_owned: 90,
  value: 1.2,
  perceived_value: 25,
  tier: 'tradeable',
  injury_prone: false,
  badges: [],
  owner_premium: 0,
} as PlayerRef

describe('Roster trade value', () => {
  it('shows auction dollars by default', () => {
    const { container } = render(<Roster roster={[player]} keep={[]} onToggleKeep={() => {}} />)
    expect(within(container).getByText('$25')).toBeInTheDocument()
  })

  it('shows the draft round in snake leagues', () => {
    const { container } = render(
      <RoundValuesContext.Provider value={[50, 32, 20, 12]}>
        <Roster roster={[player]} keep={[]} onToggleKeep={() => {}} />
      </RoundValuesContext.Provider>,
    )
    expect(within(container).getByText('Rd 3')).toBeInTheDocument()
    expect(within(container).queryByText('$25')).toBeNull()
  })
})

describe('Roster on phones', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows a list with a Keep toggle instead of the table', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 640px)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const toggled: number[] = []
    const { container } = render(<Roster roster={[player]} keep={[]} onToggleKeep={(id) => toggled.push(id)} />)
    expect(container.querySelector('table')).toBeNull()
    expect(within(container).getByText('$25')).toBeInTheDocument()
    expect(within(container).getByText('+1.2 cat')).toBeInTheDocument()
    const keep = within(container).getByRole('button', { name: 'Keep Jalen Green' })
    expect(keep).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(keep)
    expect(toggled).toEqual([1])
  })
})
