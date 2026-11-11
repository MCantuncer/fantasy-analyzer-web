import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SiteHealth } from './SiteHealth'

const today = new Date().toISOString().slice(0, 10)
const usage = {
  accounts: 12,
  verified_teams: 4,
  followed_leagues: 3,
  days: [
    { day: today, visitors: 6, signed_in: 5, new_accounts: 1, views: { moves: 9, scores: 4 }, events: { analysis: 2 } },
  ],
}
const reports = [
  {
    id: 1,
    source: 'api',
    title: 'KeyError in app.main.x',
    message: 'boom',
    stack: 'Traceback',
    route: 'POST /api/analyze/job',
    build: 'abc',
    user_agent: '',
    count: 7,
    first_seen: '2026-11-10T10:00:00Z',
    last_seen: '2026-11-11T10:00:00Z',
    resolved: false,
  },
  {
    id: 2,
    source: 'web',
    title: 'RangeError: Invalid time value',
    message: '',
    stack: '',
    route: '/?tab=scores',
    build: 'def',
    user_agent: '',
    count: 1,
    first_seen: '2026-11-06T10:00:00Z',
    last_seen: '2026-11-06T10:00:00Z',
    resolved: true,
  },
]

const calls: string[] = []
beforeEach(() => {
  calls.length = 0
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push(`${url} ${init.body}`)
    const body = url.endsWith('/api/admin/usage')
      ? usage
      : url.endsWith('/api/admin/errors')
        ? { reports }
        : { ok: true }
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  })
})
afterEach(() => vi.unstubAllGlobals())

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SiteHealth onBack={() => {}} />
    </QueryClientProvider>,
  )
}

it('shows the numbers, open errors, and marks one fixed', async () => {
  renderPage()
  expect(await screen.findByText('Visitors today')).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByText('Moves')).toBeInTheDocument()
  expect(screen.getByText('KeyError in app.main.x')).toBeInTheDocument()
  expect(screen.queryByText('RangeError: Invalid time value')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'All (2)' }))
  expect(screen.getByText('RangeError: Invalid time value')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Mark fixed' }))
  await waitFor(() => expect(calls.some((c) => c === '/api/admin/errors/resolve {"id":1}')).toBe(true))
})
