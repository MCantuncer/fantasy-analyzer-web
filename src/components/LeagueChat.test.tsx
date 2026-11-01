import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
    moves: [
      { player: p(1, 'Tristan da Silva'), kind: 'add', from_team_id: 0, to_team_id: 3 },
      { player: p(2, 'Kyle Kuzma'), kind: 'drop', from_team_id: 3, to_team_id: 0 },
    ],
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

describe('LeagueChat cards', () => {
  it('tiles moves and trades with faces, highlights the biggest bid and sums the day', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LeagueChat leagueId={1} season={2027} creds={null} />
      </QueryClientProvider>,
    )
    await screen.findByText('Tristan da Silva')
    expect(container.querySelectorAll('.feed-grid .feed-tile')).toHaveLength(2)
    expect(container.querySelector('.feed-tile.big')?.textContent).toContain('Biggest bid this week')
    expect(container.querySelector('.feed-tile.trade')?.textContent).toContain('Cayyolu Bastards get')
    expect(container.querySelector('.feed-post.feed-wide')).not.toBeNull()
    expect(container.querySelectorAll('.feed-tile img')).toHaveLength(4)
    expect(container.querySelector('.feed-day-summary')?.textContent).toContain('2 moves · $12 spent')
  })
})
