import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import type { TradeIdea } from '../api/client'
import { Trades } from './Trades'

const ref = (id: number, name: string) =>
  ({ id, name, positions: ['SF'], percent_owned: 40, injury_status: 'ACTIVE' }) as TradeIdea['give'][number]

const idea = {
  partner_team_id: 7,
  partner_team_name: 'Aliaga Hermanos',
  give: [ref(1, 'Davion Mitchell')],
  get: [ref(2, 'Jaylen Brown')],
  playoff_pct_before: 0.51,
  playoff_pct_after: 0.55,
  partner_playoff_pct_before: 0.89,
  partner_playoff_pct_after: 0.88,
  acceptance: 0.33,
  acceptance_label: 'possible',
  value_they_get: 15,
  value_they_give: 13,
  reasons: [],
  facts: [],
  warnings: [],
  category_changes: {},
} as unknown as TradeIdea

const show = (ui: ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

describe('Trades', () => {
  it('opens on Worth a Try when no trade helps both teams', () => {
    const { container } = show(<Trades fair={[]} edge={[idea]} />)
    const view = within(container)
    expect(view.getByRole('button', { name: 'Worth a Try · 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(view.getByText(/They win on paper/)).toBeInTheDocument()
  })

  it('opens on Fair when a trade helps both teams', () => {
    const { container } = show(<Trades fair={[idea]} edge={[idea]} />)
    expect(within(container).getByRole('button', { name: 'Fair · 1' })).toHaveAttribute('aria-pressed', 'true')
  })
})
