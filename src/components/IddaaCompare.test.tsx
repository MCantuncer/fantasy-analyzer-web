import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Me } from '../api/client'
import type { BookCompare, CompareGame } from '../lib/iddaaCompare'
import { IddaaCompare } from './IddaaCompare'
import { ProProvider } from './Pro'

const PRO: Me = {
  id: 1,
  email: 'can@example.com',
  has_google: false,
  leagues: [],
  notices: [],
  admin: true,
  plan: 'pro',
  features: ['estimates'],
  gifted: false,
  payment_due: false,
}

const game = (id: number, status: CompareGame['status'], tip: string): CompareGame => ({
  game_id: id,
  away: 'IND',
  home: 'NY',
  tip,
  checked: '',
  status,
  away_score: null,
  home_score: null,
  markets: [],
  players: [],
})

function night(games: CompareGame[]): BookCompare {
  return {
    season: 2027,
    day: 34,
    date: '2026-11-22',
    days: [33, 34],
    nights: [
      { day: 33, date: '2026-11-21', games: 6 },
      { day: 34, date: '2026-11-22', games: 7 },
    ],
    bands: { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 },
    look: { checked: '2026-11-22T21:33:00Z', ok: true, error: null, games: 4, matched: 4 },
    games,
    tally: [],
  }
}

function mount(data: BookCompare, onHealth?: () => void) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    String(url).includes('/api/book-compare/record')
      ? new Response('{}', { status: 404 })
      : new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }),
  )
  const onBack = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ProProvider me={PRO} signedIn theme="dark" onNeedAccount={vi.fn()}>
        <IddaaCompare onBack={onBack} onHealth={onHealth} />
      </ProProvider>
    </QueryClientProvider>,
  )
  return { onBack }
}

describe('Our Estimates head', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has Back, the title, How to read and Site health, and no intro paragraph', async () => {
    const onHealth = vi.fn()
    const { onBack } = mount(night([]), onHealth)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Site health' }))
    expect(onHealth).toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1, name: 'Our Estimates' })).toBeTruthy()
    expect(screen.queryByText(/never feeds our model/)).toBeNull()
    // One How to read per layout (wide in row 1, phone in row 2); CSS shows one of them.
    const how = screen.getAllByRole('button', { name: 'How to read' })
    expect(how).toHaveLength(2)
    await screen.findByRole('tablist', { name: 'Night' })
    fireEvent.click(how[0])
    expect(screen.getByRole('dialog', { name: 'How to read' }).textContent).toContain('never feeds our model')
  })

  it('leaves Site health out for non-admins', () => {
    mount(night([]))
    expect(screen.queryByRole('button', { name: 'Site health' })).toBeNull()
  })

  it('puts the nights and one meta line in the second row, and the last look in the foot', async () => {
    mount(
      night([
        game(1, 'final', '2026-11-22T19:00:00Z'),
        game(2, 'scheduled', '2026-11-22T22:30:00Z'),
        game(3, 'scheduled', '2026-11-22T22:00:00Z'),
      ]),
    )
    const tabs = await screen.findByRole('tablist', { name: 'Night' })
    const head = tabs.closest('.ic-head') as HTMLElement
    expect(within(tabs).getAllByRole('tab').map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true'])
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toContain('Tonight')
    const meta = head.querySelector('.ic-meta') as HTMLElement
    expect(meta.textContent).toMatch(/^2 of 3 games to come/)
    expect(meta.textContent).toContain('First tip')
    expect(meta.textContent).toContain('Last look')
    expect(screen.getByText(/Last look at iddaa/).textContent).toMatch(/worked · 4 of 4 games matched$/)
    expect(document.querySelector('.ic-bands')).toBeNull()
  })

  it('says when the last look failed', async () => {
    const data = night([game(1, 'scheduled', '2026-11-22T22:00:00Z')])
    data.look = { ...data.look, ok: false, error: 'iddaa timed out' }
    mount(data)
    expect((await screen.findByText(/Last look at iddaa/)).textContent).toMatch(/failed: iddaa timed out$/)
  })
})
