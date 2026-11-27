import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Me } from '../api/client'
import { MyLeagues } from './MyLeagues'

afterEach(cleanup)

const ME: Me = {
  id: 1,
  email: 'can@example.com',
  has_google: false,
  leagues: [],
  notices: [],
  admin: false,
  plan: 'free',
  gifted: false,
  payment_due: false,
}

function renderLeagues(me: Me) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MyLeagues me={me} creds={null} onCreds={vi.fn()} onOpen={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe('MyLeagues', () => {
  it('puts the add field first on an empty account', () => {
    const { container } = renderLeagues(ME)
    const field = screen.getByLabelText('Add your ESPN league')
    expect(field).toHaveAttribute('placeholder', 'League ID or fantasy.espn.com link')
    expect(screen.getByRole('button', { name: 'Add league' })).toBeInTheDocument()
    expect(field).toHaveAccessibleDescription(
      'Public leagues open right away. Private ones ask for two ESPN cookies next.',
    )
    // The field comes straight after the title: no explanation paragraph, no list.
    expect(container.querySelector('.ml-title')!.nextElementSibling).toHaveClass('ml-add')
    expect(container.querySelector('.ml-list')).toBeNull()
    expect(container.querySelector('.card')).toBeNull()
  })

  it('lists leagues as rows with a status line and a menu, then the add field', () => {
    const { container } = renderLeagues({
      ...ME,
      leagues: [
        { league_id: 1, season: 2027, name: 'Chill Primera Division', team_id: 3 },
        { league_id: 2, season: 2027, name: 'Office League', team_id: null },
      ],
    })
    const rows = container.querySelectorAll('.ml-item')
    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: /Chill Primera Division/ })).toHaveTextContent(
      'Verified manager · 2026–27',
    )
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: /Office League/ })).toHaveTextContent(
      'Following · verify your team to see your moves',
    )
    expect(container.querySelector('[aria-label="More for Office League"]')?.textContent).toBe('More')
    expect(screen.getAllByRole('button', { name: 'Remove from my leagues', hidden: true })).toHaveLength(2)
    expect(screen.getByLabelText('Add a league')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.getByText('Private leagues ask for two ESPN cookies next.')).toBeInTheDocument()
    expect(container.querySelector('.tag')).toBeNull()
  })
})
