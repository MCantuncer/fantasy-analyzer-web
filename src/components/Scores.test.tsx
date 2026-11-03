import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScoreDay } from '../api/client'
import { game, line } from '../test/fixtures'
import { Scores, type TonightMatchup } from './Scores'

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
  week: [
    {
      day: 5,
      date: '2026-10-24',
      sits: [13],
      games: [
        {
          id: 9,
          start: '2026-10-24T22:00:00Z',
          away: { pro_team_id: 14, abbrev: 'MIA', name: 'Miami Heat', score: null },
          home: { pro_team_id: 30, abbrev: 'CHA', name: 'Charlotte Hornets', score: null },
          my_players: [
            { player_id: 11, name: 'Giannis Antetokounmpo', injury_status: 'ACTIVE', pro_team_id: 14 },
            { player_id: 12, name: 'Davion Mitchell', injury_status: 'OUT', pro_team_id: 30 },
            { player_id: 13, name: 'Kris Dunn', injury_status: 'ACTIVE', pro_team_id: 30 },
          ],
        },
        {
          id: 10,
          start: '2026-10-24T23:30:00Z',
          away: { pro_team_id: 3, abbrev: 'NO', name: 'New Orleans Pelicans', score: null },
          home: { pro_team_id: 7, abbrev: 'DEN', name: 'Denver Nuggets', score: null },
          my_players: [],
        },
      ],
    },
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

function renderScores(matchup: TonightMatchup | null = null) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <Scores leagueId={1} season={2027} teamId={3} teams={TEAMS} creds={null} matchup={matchup} />
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
    expect(screen.getByText('Your night')).toBeInTheDocument()
    expect(screen.getByText('Your 1 player')).toBeInTheDocument()
    expect(screen.getByRole('button', { pressed: true, name: /HOU/ })).toBeInTheDocument()

    const box = screen.getAllByRole('table').find((t) => t.classList.contains('box')) as HTMLElement
    const amen = within(box).getByRole('row', { name: /Amen Thompson/ })
    expect(amen).toHaveClass('mine')
    expect(within(box).getByRole('row', { name: /Tari Eason/ })).toHaveTextContent('FA')
    expect(within(box).getByRole('row', { name: /Wembanyama/ })).toHaveTextContent('AVK')
    expect(screen.getByText(/Best free agent in this game/)).toHaveTextContent('Tari Eason')
  })

  it('puts tonight in your matchup against your opponent', async () => {
    mockApi()
    renderScores({ opponentId: 5, opponentName: 'Los Avokados', hint: 'Flip REB to win 5-4-0' })
    expect(await screen.findByText('Tonight in your matchup · vs Los Avokados')).toBeInTheDocument()
    expect(screen.getByText('Flip REB to win 5-4-0')).toBeInTheDocument()
    expect(screen.getByText(/against 2 of theirs/)).toBeInTheDocument()
    expect(screen.getAllByText(/Los Avokados:/).length).toBe(9)
  })

  it('shows the quarter and clock of a live game', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ ...DAY, live: true, games: [{ ...DAY.games[0], status: 'live', clock: 'Q4 2:31' }] }),
        ),
      ),
    )
    renderScores()
    expect((await screen.findAllByText(/Q4 2:31/)).length).toBeGreaterThan(0)
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

  it("draws this week's games as a grid: opponent per cell, who is out and who sits", async () => {
    mockApi()
    renderScores()
    const week = await screen.findByRole('region', { name: 'Still to play this week' })
    expect(week).toHaveTextContent('1 start left · 1 player sits on full days')
    expect(within(week).getByRole('columnheader', { name: 'Sat 24, 1 sit' })).toBeInTheDocument()
    const row = (name: string) => within(week).getByRole('rowheader', { name }).parentElement as HTMLElement
    expect(within(row('G. Antetokounmpo')).getByText('Plays CHA')).toBeInTheDocument()
    expect(within(row('D. Mitchell')).getByText('Out, vs MIA')).toBeInTheDocument()
    expect(within(row('K. Dunn')).getByText('Sits, vs MIA')).toBeInTheDocument()
    // The full list of NBA games is one tap away.
    fireEvent.click(within(week).getByRole('button', { name: 'All 2 NBA games' }))
    expect(week).toHaveTextContent('NO@DEN')
  })

  it('jumps to any day of the season from the picker', async () => {
    const fetchMock = mockApi()
    renderScores()
    const picker = await screen.findByLabelText('Jump to a day')
    fireEvent.change(picker, { target: { value: '3' } })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ day: 3, team_id: 3 })
  })
})
