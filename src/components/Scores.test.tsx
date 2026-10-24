import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScoreDay } from '../api/client'
import { game, line } from '../test/fixtures'
import { Scores } from './Scores'

const TEAMS = [
  { id: 3, abbrev: 'KEA', name: 'Kucukesat Aspavas' },
  { id: 5, abbrev: 'AVK', name: 'Los Avokados' },
]

const DAY: ScoreDay = {
  league_id: 1,
  season: 2027,
  day: 4,
  date: '2026-10-23',
  live: false,
  updated_at: '2026-10-24T08:00:00Z',
  days: [
    { day: 3, date: '2026-10-22', games: 2 },
    { day: 4, date: '2026-10-23', games: 2 },
    { day: 5, date: '2026-10-24', games: 8 },
  ],
  games: [
    game({
      id: 7,
      lines: [
        line({ player_id: 1, name: 'Alperen Sengun', owner_team_id: 5, pts: 29, reb: 7, ast: 7 }),
        line({ player_id: 2, name: 'Amen Thompson', owner_team_id: 3, pts: 20, reb: 10 }),
        line({ player_id: 3, name: 'Tari Eason', pro_team_id: 10, pts: 12, stl: 3 }),
        line({ player_id: 4, name: 'Victor Wembanyama', pro_team_id: 24, owner_team_id: 5, pts: 25, reb: 13 }),
      ],
    }),
    game({
      id: 8,
      status: 'scheduled',
      start: '2026-10-25T00:30:00Z',
      away: { pro_team_id: 1, abbrev: 'ATL', name: 'Atlanta Hawks', score: null },
      home: { pro_team_id: 2, abbrev: 'BOS', name: 'Boston Celtics', score: null },
    }),
  ],
}

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify(DAY))))
}

function renderScores() {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <Scores leagueId={1} season={2027} teamId={3} teams={TEAMS} creds={null} />
    </QueryClientProvider>,
  )
}

describe('Scores', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows the day, my night and the box score of my game', async () => {
    mockApi()
    renderScores()
    expect(await screen.findByText(/Amen Thompson led with 20 pts, 10 reb/)).toBeInTheDocument()
    expect(screen.getByText('Your night · 1 played')).toBeInTheDocument()
    expect(screen.getByRole('button', { pressed: true, name: /HOU/ })).toBeInTheDocument()

    const box = screen.getByRole('table')
    const amen = within(box).getByRole('row', { name: /Amen Thompson/ })
    expect(amen).toHaveClass('mine')
    expect(within(box).getByRole('row', { name: /Tari Eason/ })).toHaveTextContent('FA')
    expect(within(box).getByRole('row', { name: /Wembanyama/ })).toHaveTextContent('AVK')
    expect(screen.getByText(/Best free agent in this game/)).toHaveTextContent('Tari Eason')
  })

  it("doesn't offer a box score for a game that hasn't started", async () => {
    mockApi()
    renderScores()
    await screen.findByText(/led with/)
    expect(screen.queryByRole('button', { name: /ATL/ })).toBeNull()
    expect(screen.getByText(/ATL/)).toBeInTheDocument()
  })

  it('asks the API for the day picked in the strip', async () => {
    const fetchMock = mockApi()
    renderScores()
    ;(await screen.findByRole('button', { name: 'Later day' })).click()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ league_id: 1, day: 5 })
  })
})
