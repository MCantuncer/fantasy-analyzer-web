import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Me } from '../api/client'
import type { BookCompare, ComparePlayer } from '../lib/iddaaCompare'
import { EstimatesTeaser } from './EstimatesTeaser'
import { ProProvider } from './Pro'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

const hart = (over: Partial<ComparePlayer> = {}): ComparePlayer => ({
  name: 'Josh Hart',
  player_id: 41,
  team: 'NY',
  stat: 'reb',
  played: null,
  ladder: [],
  rungs: Array.from({ length: 12 }, (_, i) => ({
    n: i + 1,
    odd: 1.4 + i * 0.3,
    book: 0.5,
    ours: 0.55,
    value: null,
    hit: null,
  })),
  ours: 9,
  book: 7,
  actual: null,
  gap: 2,
  ours_hit: null,
  book_hit: null,
  closer: null,
  ...over,
})

function night(players: ComparePlayer[], status: 'scheduled' | 'final' = 'scheduled'): BookCompare {
  return {
    season: 2027,
    day: 34,
    date: '2026-11-22',
    days: [34],
    nights: [{ day: 34, date: '2026-11-22', games: 1 }],
    bands: { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 },
    look: { checked: '2026-11-22T21:33:00Z', ok: true, error: null, games: 1, matched: 1 },
    games: [
      {
        game_id: 1,
        away: 'IND',
        home: 'NY',
        tip: status === 'final' ? '2020-11-22T22:00:00Z' : '2099-11-22T22:00:00Z',
        checked: '',
        status,
        away_score: status === 'final' ? 110 : null,
        home_score: status === 'final' ? 104 : null,
        markets: [],
        players,
      },
    ],
    tally: [],
  }
}

function mount(data: BookCompare) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProProvider me={PRO} signedIn theme="dark" onNeedAccount={vi.fn()}>
        <EstimatesTeaser onOpen={vi.fn()} />
      </ProProvider>
    </QueryClientProvider>,
  )
}

describe('EstimatesTeaser', () => {
  it("is one row under Tonight: tonight's biggest gap, ours beside the book's", async () => {
    const { container } = mount(night([hart()]))
    const sub = await screen.findByText(/Josh Hart · Rebounds: ours/)
    expect(sub.textContent).toBe('Josh Hart · Rebounds: ours 9.0, the book 7.0')
    expect(container.querySelector('.et-k')!.textContent).toBe('Tonight')
    const row = screen.getByRole('button')
    expect(row).toHaveTextContent('Our Estimates')
    expect(row.querySelector('.et-gap')!.textContent).toBe('+2.0biggest gap')
    expect(container.querySelector('.ic-lane')).toBeNull()
  })

  it("tells last night's tally once every game is final", async () => {
    const { container } = mount(night([hart({ actual: 10, ours_hit: true, book_hit: true, closer: 'ours' })], 'final'))
    expect(await screen.findByText(/We won/)).toHaveTextContent('We won 1 of 1 · Book won 0')
    expect(container.querySelector('.et-k')!.textContent).toBe('Sun 22 Nov')
    expect(container.querySelector('.et-gap')).toBeNull()
  })

  it('is the bare row, with no explainer, when there are no lines yet', async () => {
    const { container } = mount({ ...night([]), games: [] })
    await screen.findByText('Our Estimates')
    expect(screen.queryByText(/our number beside the book/)).toBeNull()
    expect(container.querySelector('.et-s')).toBeNull()
  })
})
