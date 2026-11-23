import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchFeed } from '../api/client'
import type { FeedItem, FeedPage } from '../api/client'
import { LeagueChat } from './LeagueChat'

const p = (id: number, name: string) => ({ id, name, position: 'SF' })
const base = { team_ids: [], losing_bids: [], reactions: { counts: {}, mine: [] }, replies: 0 }
const items: FeedItem[] = [
  {
    ...base,
    id: 'tx:big',
    kind: 'waiver',
    at: new Date().toISOString(),
    team_id: 3,
    bid: 12,
    losing_bids: [{ team_id: 6, bid: 5 }],
    moves: [
      { player: p(1, 'Tristan da Silva'), kind: 'add', from_team_id: 0, to_team_id: 3 },
      { player: p(2, 'Kyle Kuzma'), kind: 'drop', from_team_id: 3, to_team_id: 0 },
    ],
  },
  {
    ...base,
    id: 'tx:fa',
    kind: 'free_agent',
    at: new Date().toISOString(),
    team_id: 6,
    moves: [{ player: p(5, 'Cam Spencer'), kind: 'add', from_team_id: 0, to_team_id: 6 }],
  },
  {
    ...base,
    id: 'tx:t',
    kind: 'trade',
    at: new Date().toISOString(),
    team_id: 3,
    team_ids: [3, 6],
    moves: [
      { player: p(3, 'Mikal Bridges'), kind: 'trade', from_team_id: 6, to_team_id: 3 },
      { player: p(4, 'Jalen Green'), kind: 'trade', from_team_id: 3, to_team_id: 6 },
    ],
  },
  { ...base, id: 'post:1', kind: 'post', at: new Date().toISOString(), team_id: 6, body: 'nice steal' },
]
const page: FeedPage = {
  league_id: 1,
  season: 2027,
  page: 0,
  has_more: false,
  items,
  teams: [
    { id: 3, name: 'Kucukesat Aspavas', abbrev: 'KEA', faab_spent: 12 },
    { id: 6, name: 'Cayyolu Bastards', abbrev: 'CAY', faab_spent: 0 },
  ],
  faab_budget: 100,
  me: null,
}

vi.mock('../api/client', async (orig) => ({
  ...(await orig<typeof import('../api/client')>()),
  fetchFeed: vi.fn(async () => page),
}))

describe('LeagueChat wire', () => {
  afterEach(cleanup)

  it('puts moves on one line each, talk in moments, and sums the day on its milestone', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    const wire = container.querySelector('ol.feed-wire')!
    expect(wire.getAttribute('aria-label')).toBe('League moves, newest first')
    expect(wire.querySelector('.feed-day h3')?.textContent).toBe('Today')
    expect(wire.querySelector('.feed-day-summary')?.textContent).toBe('3 moves · $12 spent')
    expect(wire.querySelectorAll('.feed-line')).toHaveLength(2)
    expect(wire.querySelectorAll('.feed-moment')).toHaveLength(2)
    expect(wire.querySelector('.feed-moment-trade')?.textContent).toContain('Cayyolu Bastards get')
    expect(wire.querySelector('.feed-moment-post')?.textContent).toContain('nice steal')
    expect(container.querySelector('.feed-grid, .feed-tile')).toBeNull()
    expect(wire.querySelectorAll('img')).toHaveLength(5)
  })

  it('shows the bid, what it beat and the biggest bid in the line, and a free agent in the same slot', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    const [claim, fa] = container.querySelectorAll('.feed-line')
    expect(claim.querySelector('.feed-slot')?.textContent).toBe('Waiver bid$12')
    expect(claim.querySelector('.feed-meta')?.textContent).toContain('Biggest bid this week')
    const beat = claim.querySelector('.feed-beat')!
    expect(beat.textContent).toMatch(/^Beat 1 bid/)
    expect(beat.querySelector('.sr-only')?.textContent).toBe('Cayyolu Bastards')
    expect(beat.querySelector('.num')?.textContent).toBe('$5')
    expect(fa.querySelector('.feed-slot')?.textContent).toBe('Free agent')
    expect(fa.querySelector('.feed-meta')).toBeNull()
  })

  it('prints the time once for a run of moves made in the same minute', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    const [first, second] = container.querySelectorAll('.feed-line')
    expect(first.querySelector('time.feed-time')).not.toBeNull()
    expect(second.querySelector('time.feed-time')).toBeNull()
    expect(second.querySelector('time.sr-only')).not.toBeNull()
  })
})

describe('LeagueChat refresh', () => {
  it('keeps the feed on screen when a refresh fails', async () => {
    const client = new QueryClient()
    const { container } = render(
      <QueryClientProvider client={client}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    vi.mocked(fetchFeed).mockRejectedValue(new ApiError(500, 'server', 'Something broke.'))
    await act(() => client.refetchQueries({ queryKey: ['feed', 1, 2027] }))
    await screen.findByText(/Couldn't refresh the feed just now/)
    expect(screen.queryByText("Couldn't load the league feed")).toBeNull()
    expect(container.querySelectorAll('.feed-wire .feed-line')).toHaveLength(2)
  })
})
