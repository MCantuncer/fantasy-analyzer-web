import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NewsPage, NewsStory } from '../api/client'
import { News } from './News'

const TEAMS = [
  { id: 3, abbrev: 'KEA' },
  { id: 8, abbrev: 'KVK' },
]
const NOW = new Date()
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

function story(over: Partial<NewsStory>): NewsStory {
  return {
    id: over.headline ?? 'x',
    kind: 'other',
    status: 'reported',
    headline: 'Headline',
    summary: '',
    published_at: hoursAgo(2),
    updated_at: hoursAgo(1),
    players: [],
    sources: [],
    severity: 0,
    conflict: null,
    ...over,
  }
}

const PAGE: NewsPage = {
  league_id: 1,
  updated_at: hoursAgo(0.2),
  refreshing: false,
  stories: [
    story({
      kind: 'injury',
      status: 'confirmed',
      headline: 'Jalen Williams fractures ankle, out indefinitely',
      severity: 3,
      conflict: 'Sources disagree: ESPN status says day-to-day; CBS Sports says serious, weeks or more (ankle).',
      players: [
        {
          player_id: 1,
          name: 'Jalen Williams',
          pro_team: 'OKC',
          injury_status: 'DAY_TO_DAY',
          owner_team_id: 8,
        },
      ],
      sources: [
        {
          source_id: 'cbs',
          name: 'CBS Sports',
          kind: 'outlet',
          title: 'Jalen Williams fractures ankle, out indefinitely',
          url: 'https://cbs.example/jw',
          published_at: hoursAgo(1),
          summary: '',
        },
        {
          source_id: 'espn_players',
          name: 'ESPN player data',
          kind: 'fact',
          title: 'ESPN lists Jalen Williams as day-to-day',
          url: 'https://www.espn.com/nba/player/_/id/1',
          published_at: hoursAgo(1),
          summary: '',
        },
      ],
    }),
    story({
      kind: 'role',
      headline: 'Kris Dunn moves into the starting lineup',
      players: [
        {
          player_id: 2,
          name: 'Kris Dunn',
          pro_team: 'LAC',
          injury_status: 'ACTIVE',
          owner_team_id: null,
        },
      ],
    }),
    story({
      kind: 'rumor',
      headline: 'Davion Mitchell drawing trade interest',
      players: [
        {
          player_id: 3,
          name: 'Davion Mitchell',
          pro_team: 'MIA',
          injury_status: 'ACTIVE',
          owner_team_id: 3,
        },
      ],
    }),
  ],
  trending: [
    {
      player_id: 2,
      name: 'Kris Dunn',
      pro_team: 'LAC',
      injury_status: 'ACTIVE',
      percent_owned: 18.7,
      percent_change: 10.3,
      owner_team_id: null,
    },
  ],
  sources: [
    {
      source_id: 'espn_players',
      name: 'ESPN player data',
      kind: 'fact',
      ok: true,
      items: 700,
    },
    {
      source_id: 'yahoo',
      name: 'Yahoo Sports',
      kind: 'outlet',
      ok: false,
      items: 0,
      error: 'HTTP 503',
    },
    {
      source_id: 'reddit',
      name: 'Reddit r/nba',
      kind: 'tip',
      ok: null,
      items: 0,
    },
  ],
}

function renderNews(myTeamId: number | null = 3) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify(PAGE))))
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <News leagueId={1} season={2027} myTeamId={myTeamId} teams={TEAMS} creds={null} />
    </QueryClientProvider>,
  )
}

describe('News', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows checked stories with their sources, owners and the injury conflict', async () => {
    renderNews()
    const link = await screen.findByRole('link', {
      name: 'Jalen Williams fractures ankle, out indefinitely',
    })
    expect(link).toHaveAttribute('href', 'https://cbs.example/jw')
    const jw = link.closest('article') as HTMLElement
    expect(within(jw).getByText('Confirmed · 2 sources')).toBeInTheDocument()
    expect(within(jw).getByText('Sources disagree')).toBeInTheDocument()
    expect(within(jw).getByRole('note')).toHaveTextContent('ESPN status says day-to-day')
    expect(within(jw).getByText('ESPN: DTD')).toBeInTheDocument()
    expect(within(jw).getByText('KVK')).toBeInTheDocument()
    expect(screen.getAllByText('1 source · Reported')).toHaveLength(2)
    expect(screen.getAllByText('Free agent').length).toBeGreaterThan(0)
    expect(screen.getByText('+10.3')).toBeInTheDocument()
    expect(screen.getByText(/Not answering/)).toBeInTheDocument()
  })

  it('filters by kind and by my roster', async () => {
    renderNews()
    await screen.findByText('Kris Dunn moves into the starting lineup')
    fireEvent.click(screen.getByRole('button', { name: /Injuries/ }))
    expect(screen.queryByText('Kris Dunn moves into the starting lineup')).not.toBeInTheDocument()
    expect(screen.getByText('Jalen Williams fractures ankle, out indefinitely')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^All \d/ }))
    fireEvent.click(screen.getByRole('button', { name: 'My roster' }))
    expect(screen.getByText('Davion Mitchell drawing trade interest')).toBeInTheDocument()
    expect(screen.queryByText('Kris Dunn moves into the starting lineup')).not.toBeInTheDocument()
  })

  it('has no "My roster" before the team is verified', async () => {
    renderNews(null)
    await screen.findByText('Kris Dunn moves into the starting lineup')
    expect(screen.queryByRole('button', { name: 'My roster' })).not.toBeInTheDocument()
  })
})
