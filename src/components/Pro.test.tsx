import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Me } from '../api/client'
import { useFeature } from '../lib/pro'
import { ProLock, ProProvider } from './Pro'
import { ProPlan } from './ProPlan'

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

function mockBilling(enabled: boolean, onPost: (path: string, body: unknown) => Response = () => new Response('{}')) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input), 'http://x').pathname
    if (path === '/api/billing/config') {
      return new Response(JSON.stringify(enabled ? { enabled, client_token: 'tok', environment: 'sandbox' } : { enabled }))
    }
    return onPost(path, init?.body ? JSON.parse(String(init.body)) : null)
  })
}

function Spot() {
  return useFeature('next_game') ? <p>27 PTS</p> : <ProLock words="His line for tonight" />
}

function wrap(me: Me | undefined, ui: React.ReactNode, signedIn = true, onNeedAccount = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProProvider me={me} signedIn={signedIn} theme="dark" onNeedAccount={onNeedAccount}>
        {ui}
      </ProProvider>
    </QueryClientProvider>,
  )
}

describe('Pro spots', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('shows the real spot while the API serves it, and one lock when it does not', () => {
    mockBilling(true)
    wrap({ ...FREE, features: ['next_game'] }, <Spot />)
    expect(screen.getByText('27 PTS')).toBeTruthy()
    cleanup()
    wrap(FREE, <Spot />)
    expect(screen.getByRole('button', { name: 'His line for tonight is a Pro feature. See Pro plans' })).toBeTruthy()
  })

  it('opens the upgrade sheet from a lock: Yearly first, then Monthly', async () => {
    mockBilling(true)
    wrap(FREE, <Spot />)
    fireEvent.click(screen.getByRole('button', { name: /See Pro plans/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Free runs your league. Pro adds the games.' })
    expect(sheet.textContent).toContain('Then $39 a year. Cancel any time.')
    expect(screen.getByRole('radio', { name: /Yearly/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: 'Monthly' }))
    expect(sheet.textContent).toContain('Then $4.99 a month. Cancel any time.')
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Start 7-day free trial' }) as HTMLButtonElement).disabled).toBe(false),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks a visitor for an account before the sheet', () => {
    mockBilling(true)
    const onNeedAccount = vi.fn()
    wrap(undefined, <ProLock words="His line for tonight" />, false, onNeedAccount)
    fireEvent.click(screen.getByRole('button', { name: /See Pro plans/ }))
    expect(onNeedAccount).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('locks the sample league for visitors once plans are on', () => {
    mockBilling(true)
    const client = new QueryClient()
    const visitor = (locked: boolean) => (
      <QueryClientProvider client={client}>
        <ProProvider me={undefined} signedIn={false} visitorLocked={locked} theme="dark" onNeedAccount={vi.fn()}>
          <Spot />
        </ProProvider>
      </QueryClientProvider>
    )
    const { rerender } = render(visitor(false))
    expect(screen.getByText('27 PTS')).toBeTruthy()
    rerender(visitor(true))
    expect(screen.getByRole('button', { name: /See Pro plans/ })).toBeTruthy()
  })

  it('lets an admin preview the site as Free', async () => {
    mockBilling(false)
    wrap({ ...FREE, admin: true, plan: 'pro', features: ['next_game'] }, [<ProPlan key="p" onPick={vi.fn()} />, <Spot key="s" />])
    expect(screen.getByText('27 PTS')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'Free preview' }))
    expect(screen.queryByText('27 PTS')).toBeNull()
    expect(screen.getByText('Locks show as a Free account sees them.')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'Free preview' }))
    expect(screen.getByText('27 PTS')).toBeTruthy()
  })
})

describe('Account plan section', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('stays hidden for Free until checkout is open', async () => {
    mockBilling(false)
    wrap(FREE, <ProPlan onPick={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText('Your plan')).toBeNull())
    cleanup()
    mockBilling(true)
    wrap(FREE, <ProPlan onPick={vi.fn()} />)
    expect(await screen.findByText('Your plan')).toBeTruthy()
  })

  it('says each Pro state in a sentence', () => {
    mockBilling(true)
    const pro = { ...FREE, plan: 'pro' as const }
    const ends = new Date(Date.now() + 4 * 86_400_000 - 60_000).toISOString()
    wrap({ ...pro, trial_ends: ends, interval: 'year' }, <ProPlan onPick={vi.fn()} />)
    expect(screen.getByText(/Trial ends in 4 days, on .*\. Then \$39 a year\./)).toBeTruthy()
    cleanup()
    wrap({ ...pro, ends_at: '2026-12-22T12:00:00Z' }, <ProPlan onPick={vi.fn()} />)
    expect(screen.getByText(/You cancelled; nothing more is charged\. After 22 Dec/)).toBeTruthy()
    cleanup()
    wrap({ ...pro, gifted: true, ends_at: '2026-12-22T12:00:00Z' }, <ProPlan onPick={vi.fn()} />)
    expect(screen.getByText('Pro until 22 Dec, a gift. Nothing to pay. No card on file.')).toBeTruthy()
    cleanup()
    wrap({ ...pro, payment_due: true, interval: 'month' }, <ProPlan onPick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Update card' })).toBeTruthy()
  })

  it('opens Paddle billing from Manage billing', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    mockBilling(true, (path) =>
      path === '/api/billing/portal' ? new Response(JSON.stringify({ url: 'https://portal.example/x' })) : new Response('{}'),
    )
    wrap({ ...FREE, plan: 'pro', renews_at: '2026-12-22T12:00:00Z', interval: 'year' }, <ProPlan onPick={vi.fn()} />)
    expect(screen.getByText('Renews on 22 Dec.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Manage billing' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://portal.example/x'))
  })
})
