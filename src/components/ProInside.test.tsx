import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Me } from '../api/client'
import { EstimatesTeaser, IddaaCompare } from './IddaaCompare'
import { ProProvider } from './Pro'

const FREE: Me = {
  id: 1,
  email: 'fan@example.com',
  has_google: false,
  leagues: [],
  notices: [],
  admin: false,
  plan: 'free',
  features: [],
  gifted: false,
  payment_due: false,
}

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProProvider me={FREE} signedIn theme="dark" onNeedAccount={vi.fn()}>
        {ui}
      </ProProvider>
    </QueryClientProvider>,
  )
}

describe('Our Estimates for Free', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows the page behind the lock, one way in, and asks nothing of the API', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    wrap(<IddaaCompare onBack={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Every pick, before tip-off' })).toBeTruthy()
    expect(screen.getByText('Then $39 a year, or $4.99 a month. Cancel any time.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start 7-day free trial' })).toBeTruthy()
    // the example game is decoration: hidden from screen readers, no buttons inside
    expect(screen.getByText('Match result').closest('[aria-hidden="true"][inert]')).toBeTruthy()
    expect(fetch.mock.calls.some(([u]) => String(u).includes('/api/book-compare'))).toBe(false)
  })

  it('keeps the My leagues entry, marked Pro, without loading the night', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    wrap(<EstimatesTeaser onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Our Estimates, Pro feature. Picks and Sportsbook vs' })).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})
