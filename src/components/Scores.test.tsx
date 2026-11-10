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
  complete: true,
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

/** Every Scores request answers with DAY, unless a route is given its own answer (a promise holds it back). */
function mockApi(routes: Record<string, () => Promise<unknown> | unknown> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input), 'http://x').pathname
    const route = routes[path]
    const body = route ? await route() : path === '/api/scores/sits' ? { days: [] } : DAY
    return new Response(JSON.stringify(body))
  })
}

/** The request bodies sent to one endpoint, in order. */
function bodies(fetchMock: ReturnType<typeof mockApi>, path: string) {
  return fetchMock.mock.calls
    .filter(([input]) => new URL(String(input), 'http://x').pathname === path)
    .map(([, init]) => JSON.parse(String(init?.body)))
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
    // Points right after minutes, then the shooting splits, like the player card game log.
    const heads = [...box.querySelectorAll('thead th')].map((h) => h.textContent)
    expect(heads).toEqual(['PLAYER', 'OWNER', 'MIN', 'FG', 'FT', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'])
    const amen = within(box).getByRole('row', { name: /Amen Thompson/ })
    expect(amen).toHaveClass('mine')
    expect(within(box).getByRole('row', { name: /Tari Eason/ })).toHaveTextContent('FA')
    // One team at a time, opening on the team with my players; the switch shows the other one.
    expect(screen.getByRole('button', { name: 'Houston Rockets' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(box).queryByRole('row', { name: /Wembanyama/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'San Antonio Spurs' }))
    expect(within(box).getByRole('row', { name: /Wembanyama/ })).toHaveTextContent('AVK')
    expect(within(box).queryByRole('row', { name: /Amen Thompson/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Best free agent in this game/)).toHaveTextContent('Tari Eason')
  })

  it('sorts the team by a category, then back to the game order', async () => {
    mockApi()
    renderScores()
    await screen.findByText(/Amen Thompson led with 20 pts, 10 reb/)
    const box = screen.getAllByRole('table').find((t) => t.classList.contains('box')) as HTMLElement
    const order = () => [...box.querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent?.split(' ')[0])
    expect(order()).toEqual(['Alperen', 'Amen', 'Tari'])

    const reb = within(box).getByRole('button', { name: 'REB' })
    fireEvent.click(reb)
    // Most rebounds first among Houston's players.
    expect(order()).toEqual(['Amen', 'Alperen', 'Tari'])
    expect(reb.closest('th')).toHaveAttribute('aria-sort', 'descending')
    expect(box).toHaveAttribute('data-col', '7')

    fireEvent.click(reb)
    expect(order()).toEqual(['Tari', 'Alperen', 'Amen'])
    expect(reb.closest('th')).toHaveAttribute('aria-sort', 'ascending')

    fireEvent.click(reb)
    expect(order()).toEqual(['Alperen', 'Amen', 'Tari'])
    expect(reb.closest('th')).not.toHaveAttribute('aria-sort')
    expect(box).not.toHaveAttribute('data-col')
  })

  it('puts tonight in your matchup against your opponent', async () => {
    mockApi()
    renderScores({ opponentId: 5, opponentName: 'Los Avokados' })
    expect((await screen.findByRole('heading', { name: /Tonight in your matchup/ })).textContent).toBe(
      'Tonight in your matchup · vs Los Avokados',
    )
    expect(screen.queryByText(/Flip /)).not.toBeInTheDocument()
    expect(screen.getByText(/against 2 of theirs/)).toBeInTheDocument()
    expect(screen.getAllByText(/Los Avokados:/).length).toBe(9)
    // Game Night: every category says who took it tonight, and the night's count leads the card.
    const letters = [...document.querySelectorAll('.night-res')].map((n) => n.textContent)
    expect(letters).toHaveLength(9)
    const w = letters.filter((x) => x === 'W').length
    const l = letters.filter((x) => x === 'L').length
    expect(document.querySelector('.night-score b')?.textContent).toMatch(new RegExp(`^${w}-${l}`))
    expect(screen.getByText(/the night|so far/)).toBeInTheDocument()
    expect([...document.querySelectorAll('.night-cats dt')].slice(1, 3).map((n) => n.firstChild?.textContent)).toEqual([
      'FG%',
      'FT%',
    ])
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

  it('filters to games with my players from the All | Mine lens', async () => {
    mockApi()
    renderScores()
    const lens = await screen.findByRole('radiogroup', { name: 'Games shown' })
    const all = within(lens).getByRole('radio', { name: 'All 2 games' })
    const mine = within(lens).getByRole('radio', { name: 'Mine 1 game' })
    expect(all).toBeChecked()
    expect(screen.getByText(/All 2 games · 1 of your players in action/)).toBeInTheDocument()

    fireEvent.click(mine)
    expect(mine).toBeChecked()
    expect(screen.queryByText(/ATL/)).toBeNull()
    expect(screen.getByText(/of 2 games · 1 of your players in action/)).toHaveTextContent('1 of 2 games')

    fireEvent.keyDown(mine, { key: 'ArrowLeft' })
    expect(all).toBeChecked()
    expect(all).toHaveFocus()
    expect(screen.getByText(/ATL/)).toBeInTheDocument()
  })

  it('counts a game that has not started as mine from the week fixtures', async () => {
    const tonight = { ...DAY.games[1], id: 9 }
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ...DAY, games: [tonight] }))),
    )
    renderScores()
    expect(await screen.findByRole('radio', { name: 'Mine 1 game' })).toBeInTheDocument()
    expect(screen.getByText(/All games include your players · 3 of your players in action/)).toBeInTheDocument()
  })

  it('offers all games when none of mine play that day', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ...DAY, games: [DAY.games[1]] }))),
    )
    renderScores()
    fireEvent.click(await screen.findByRole('radio', { name: 'Mine 0 games' }))
    expect(screen.getByRole('heading', { name: 'None of your players play on Fri, Oct 23' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show all games' }))
    expect(screen.getByRole('radio', { name: 'All 1 game' })).toBeChecked()
    expect(screen.getByText(/ATL/)).toBeInTheDocument()
  })

  it('asks the API for the day picked in the strip', async () => {
    const fetchMock = mockApi()
    renderScores()
    ;(await screen.findByRole('button', { name: 'Later day' })).click()
    await vi.waitFor(() =>
      expect(bodies(fetchMock, '/api/scores/games')).toContainEqual(expect.objectContaining({ league_id: 1, day: 5 })),
    )
    expect(bodies(fetchMock, '/api/scores')).toContainEqual(expect.objectContaining({ day: 5, with_sits: false }))
  })

  it("draws this week's games as a grid: opponent per cell, who is out and who sits", async () => {
    mockApi({ '/api/scores/sits': () => ({ days: [{ day: 5, date: '2026-10-24', sits: [13] }] }) })
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
    await vi.waitFor(() =>
      expect(bodies(fetchMock, '/api/scores/games')).toContainEqual(expect.objectContaining({ day: 3, team_id: 3 })),
    )
  })

  it('shows the games first, then fills in the scores, with a spinner in the box score meanwhile', async () => {
    let release!: (v: unknown) => void
    const held = new Promise((r) => (release = r))
    const quick: ScoreDay = {
      ...DAY,
      complete: false,
      games: DAY.games.map((g) =>
        g.status === 'scheduled'
          ? g
          : { ...g, lines: [], away: { ...g.away, score: null }, home: { ...g.home, score: null } },
      ),
    }
    mockApi({ '/api/scores/games': () => quick, '/api/scores': () => held })
    renderScores()
    // The game cards are up before the scores.
    expect(await screen.findByText('Fetching box score')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /HOU/ })).toHaveTextContent('Fetching the box score')
    expect(screen.getByText('Fetching the scores')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Mine, still counting' })).toBeInTheDocument()
    expect(screen.queryByText('Your night')).not.toBeInTheDocument()

    release(DAY)
    expect(await screen.findByText(/Amen Thompson led with 20 pts, 10 reb/)).toBeInTheDocument()
    expect(screen.queryByText('Fetching box score')).not.toBeInTheDocument()
    expect(screen.getAllByRole('table').some((t) => t.classList.contains('box'))).toBe(true)
  })
})
