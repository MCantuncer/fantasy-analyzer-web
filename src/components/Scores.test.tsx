import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScoreDay } from '../api/client'
import { game, line } from '../test/fixtures'
import { setPlayerCardHost } from '../lib/playerCard'
import { PlayerCardHost } from './PlayerCard'
import { Scores, type TonightMatchup } from './Scores'
import pregame from '../test/pregame-orl-bkn.json'

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
    // No rival tonight: your row alone, one figure per category.
    expect(screen.getByRole('list', { name: 'Your categories tonight' }).children).toHaveLength(9)
    // Nothing is open until you pick a game.
    expect(screen.getAllByRole('table').some((t) => t.classList.contains('box'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /HOU/ }))
    expect(screen.getByRole('button', { expanded: true, name: /HOU/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Box score: Houston Rockets/ })).toBeInTheDocument()

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
    fireEvent.click(screen.getByRole('button', { name: /HOU/ }))
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
    // Line Score's sheet: the night's count and its word, then CatStrip pair with tonight's figures.
    const strip = screen.getByRole('list', { name: "Tonight's categories" })
    const items = within(strip).getAllByRole('listitem')
    expect(items).toHaveLength(9)
    expect(items.slice(0, 2).map((i) => i.getAttribute('aria-label')?.split(':')[0])).toEqual(['FG%', 'FT%'])
    const leads = items.map((i) => i.getAttribute('aria-label') ?? '')
    const w = leads.filter((x) => / you lead$/.test(x)).length
    const l = leads.filter((x) => / Avokados lead$/.test(x)).length
    expect(document.querySelector('.sc-tn-big')).toHaveAttribute('aria-label', expect.stringMatching(new RegExp(`^${w} won, ${l} lost`)))
    expect(screen.getByText(/the night|so far/)).toBeInTheDocument()
    // Tonight only: no week figures and no "close this week" flags.
    expect(strip.querySelector('.cs-pk')).toBeNull()
    expect(strip.querySelector('.cs-close')).toBeNull()
    // The old lines and tiles are gone.
    expect(screen.queryByText(/of your players combined/)).not.toBeInTheDocument()
    expect(document.querySelector('.night-res')).toBeNull()
  })

  it("lifts games with your or your rival's players and marks them with each crest and its count", async () => {
    mockApi()
    renderScores({ opponentId: 5, opponentName: 'Los Avokados' })
    await screen.findByRole('heading', { name: /Tonight in your matchup/ })
    const card = document.querySelector('.game-card.stake')!
    expect(card).not.toBeNull()
    const mark = card.querySelector('.sc-own')!
    expect(mark.querySelector('.sc-own-side.you')?.textContent).toBe('KA1')
    expect(mark.querySelector('.sc-own-side.rival')?.textContent).toBe('LA2')
    // The names are in the title and in screen-reader text, not as faces on the card.
    const label = "1 of your players: Amen Thompson. 2 of your opponent's: Alperen Sengun, Victor Wembanyama"
    expect(mark).toHaveAttribute('title', label)
    expect(within(card as HTMLElement).getByText(label)).toHaveClass('sr-only')
    expect(card.querySelector('.game-status .head')).toBeNull()
    expect(document.querySelector('.game-card.cold')).toBeNull()
  })

  it("edges the open game in its clubs' lights and marks your rival's rows in the box score", async () => {
    mockApi()
    renderScores({ opponentId: 5, opponentName: 'Los Avokados' })
    await screen.findByRole('heading', { name: /Tonight in your matchup/ })
    fireEvent.click(screen.getByRole('button', { name: /HOU/ }))
    const open = screen.getByRole('button', { expanded: true, name: /HOU/ })
    expect(open).toHaveClass('is-tab')
    expect(open.style.getPropertyValue('--ta')).not.toBe('')
    expect(open.style.getPropertyValue('--tb')).not.toBe('')

    const box = screen.getAllByRole('table').find((t) => t.classList.contains('box')) as HTMLElement
    expect(within(box).getByRole('row', { name: /Amen Thompson/ })).toHaveClass('mine')
    const sengun = within(box).getByRole('row', { name: /Alperen Sengun/ })
    expect(sengun).toHaveClass('rival')
    expect(sengun).toHaveTextContent('(your opponent)')
    expect(within(box).getByRole('row', { name: /Tari Eason/ })).not.toHaveClass('rival')
    expect(screen.getByRole('button', { name: 'Houston Rockets' }).style.getPropertyValue('--tl')).not.toBe('')
  })

  it('marks the players on the court in a live box score, and nothing when ESPN has no say', async () => {
    const on = (id: number) => (id === 1 ? true : id === 2 ? false : null)
    const live = {
      ...DAY,
      live: true,
      games: [
        {
          ...DAY.games[0],
          status: 'live',
          clock: 'Q2 3:41',
          lines: DAY.games[0].lines.map((l) => ({ ...l, on_court: on(l.player_id) })),
        },
      ],
    }
    mockApi({ '/api/scores': () => live })
    renderScores()
    fireEvent.click(await screen.findByRole('button', { name: /HOU/ }))
    const box = screen.getAllByRole('table').find((t) => t.classList.contains('box')) as HTMLElement
    const sengun = within(box).getByRole('row', { name: /Alperen Sengun/ })
    expect(sengun).toHaveClass('sc-on')
    expect(sengun).not.toHaveClass('sc-on-in') // already on the floor when the box opened: no draw-in
    expect(sengun).toHaveTextContent('On the court')
    for (const name of [/Amen Thompson/, /Tari Eason/]) {
      const row = within(box).getByRole('row', { name })
      expect(row).not.toHaveClass('sc-on')
      expect(row).not.toHaveTextContent('On the court')
    }
    expect(box.querySelector('.sc-oc-key')).toHaveTextContent('On court')
  })

  it('shows no on-court key when no player of the team carries the flag', async () => {
    mockApi()
    renderScores()
    fireEvent.click(await screen.findByRole('button', { name: /HOU/ }))
    const box = screen.getAllByRole('table').find((t) => t.classList.contains('box')) as HTMLElement
    expect(box.querySelector('.sc-oc-key')).toBeNull()
    expect(box.querySelector('tr.sc-on')).toBeNull()
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
    // The clock is the card's hero number; screen readers hear it as a sentence.
    expect((await screen.findAllByText('2:31')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Live, 2:31 left in the 4th quarter/).length).toBeGreaterThan(0)
    const card = document.querySelector('.game-card[data-ember="run"]') as HTMLElement
    expect(card).not.toBeNull()
    expect(Number(card.style.getPropertyValue('--gt-p'))).toBeGreaterThan(0.9)
    expect(screen.queryByText(/no quarter or game clock/)).toBeNull()
  })

  it('shows where each player of the shown team ends tonight under a live box score', async () => {
    const live = { ...DAY, live: true, games: [{ ...DAY.games[0], status: 'live', clock: 'Half' }] }
    const lines = {
      league_id: 1,
      season: 2027,
      day: 4,
      game_id: 7,
      status: 'live',
      clock: 'Half',
      elapsed: 24,
      half_within: 3.1,
      most_within: 5.5,
      lines: [
        { player_id: 2, name: 'Amen Thompson', pro_team_id: 10, pts: 20, minutes: 18, line_pts: 16, line_minutes: 34, final: 31.2, rest: 11.2, minutes_left: 15.6 },
        { player_id: 3, name: 'Tari Eason', pro_team_id: 10, pts: 2, minutes: 10, line_pts: 11, line_minutes: 24, final: 8.1, rest: 6.1, minutes_left: 12, fouls: 5 },
        { player_id: 4, name: 'Victor Wembanyama', pro_team_id: 24, pts: 25, minutes: 17, line_pts: 24, line_minutes: 33, final: 40.5, rest: 15.5, minutes_left: 16 },
      ],
      quarters: {
        period: 2,
        away: { pro_team_id: 10, pregame: [29, 28, 29, 27], real: [33, 28], live: [33, 28, 28.6, 26.3], fouls: 1, bonus: true },
        home: { pro_team_id: 24, pregame: [28, 28, 28, 27], real: [25, 24], live: [25, 24, 28.4, 27.3] },
      },
    }
    const fetchMock = mockApi({ '/api/scores/games': () => live, '/api/scores': () => live, '/api/scores/live-lines': () => lines })
    renderScores()
    await screen.findAllByText('Half')
    fireEvent.click(screen.getAllByRole('button', { name: /HOU/ })[0])
    const panel = await screen.findByRole('region', { name: 'Live line' })
    expect(within(panel).getByText(/as of Half/)).toBeInTheDocument()
    const rows = within(panel).getAllByRole('listitem')
    expect(rows.map((r) => r.querySelector('.lvl-who')?.textContent)).toEqual(['Amen Thompson', 'Tari Eason'])
    // Each row leads with a small face.
    expect(rows.every((r) => r.querySelector('.lvl-name .head'))).toBe(true)
    expect(rows[0]).toHaveTextContent('20 now, ends about 31, +15 against his line of 16.')
    expect(rows[1]).toHaveTextContent('−3')
    expect(within(panel).getByText(/half of finals land within 3.1 points/)).toBeInTheDocument()
    expect(bodies(fetchMock, '/api/scores/live-lines')).toContainEqual(expect.objectContaining({ game_id: 7 }))
    // Both teams' quarters: real when played, our number for the rest, moved by the score.
    const table = within(panel).getByRole('table')
    expect(table).toHaveAccessibleName(/Houston Rockets: 1st 33; 2nd 28 so far, about 28 by its end; 3rd about 29; 4th about 26/)
    expect(within(table).getByText('was 27')).toBeInTheDocument()
    expect(within(table).getByText('Bonus')).toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('5 fouls')
    // The other team's players once the switch shows them.
    fireEvent.click(screen.getByRole('button', { name: 'San Antonio Spurs' }))
    expect(within(screen.getByRole('region', { name: 'Live line' })).getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows a break as a paused word with no clock', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...DAY, live: true, games: [{ ...DAY.games[0], status: 'live', clock: 'Half' }] })),
      ),
    )
    renderScores()
    expect((await screen.findAllByText('Half')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Live, halftime/).length).toBeGreaterThan(0)
    expect(document.querySelector('.game-card[data-ember="break"]')).not.toBeNull()
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

  it("opens a player's card from the names on a game card with nothing to open yet", async () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    try {
      const tonight = { ...DAY.games[1], id: 9 }
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ...DAY, games: [tonight] }))),
      )
      const { container } = renderScores()
      await screen.findByRole('radio', { name: 'Mine 1 game' })
      const card = container.querySelector<HTMLElement>('.game-card[data-game="9"]')!
      expect(card.tagName).toBe('DIV')
      expect(card).toHaveTextContent('G. Antetokounmpo, D. Mitchell, K. Dunn')
      expect(card).not.toHaveTextContent('of yours')
      fireEvent.click(within(card).getByRole('button', { name: 'K. Dunn' }))
      expect(open).toHaveBeenCalledWith({ id: 13, name: 'Kris Dunn' })
    } finally {
      act(() => setPlayerCardHost(null))
    }
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
    expect(within(week).getByRole('button', { name: 'Sat 24, 1 sit' })).toBeInTheDocument()
    expect(within(week).getByRole('columnheader', { name: 'Starts' })).toBeInTheDocument()
    // No legend in words: the badge and the summary line carry it, the day head's title spells it out.
    expect(week).not.toHaveTextContent('sits: more games that day than your lineup spots')
    expect(within(week).getByRole('button', { name: 'Sat 24, 1 sit' })).toHaveAttribute(
      'title',
      'Games on Sat 24 · 1 player sits: more games than lineup spots',
    )
    const row = (name: string) => within(week).getByRole('rowheader', { name }).parentElement as HTMLElement
    expect(within(row('G. Antetokounmpo')).getByText('Plays CHA')).toBeInTheDocument()
    // The opponent in words: "@CHA" away, "vs MIA" at home.
    expect(row('G. Antetokounmpo').querySelector('.sw-op')).toHaveTextContent('@CHA')
    expect(row('K. Dunn').querySelector('.sw-op')).toHaveTextContent('vs MIA')
    expect(within(row('D. Mitchell')).getByText('Out, vs MIA')).toBeInTheDocument()
    expect(within(row('K. Dunn')).getByText('Sits (no lineup spot), vs MIA')).toBeInTheDocument()
    // The full list of NBA games is one tap away.
    fireEvent.click(within(week).getByRole('button', { name: 'All 2 NBA games' }))
    expect(week).toHaveTextContent('NO@DEN')
  })

  it("gives each week row a small face, and the name opens the player's card", async () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    try {
      mockApi({ '/api/scores/sits': () => ({ days: [{ day: 5, date: '2026-10-24', sits: [13] }] }) })
      renderScores()
      const week = await screen.findByRole('region', { name: 'Still to play this week' })
      const row = within(week).getByRole('rowheader', { name: 'G. Antetokounmpo' })
      // The face is lit by his own club (MIA), not the opponent's.
      const face = row.querySelector('.head')
      expect(face).not.toBeNull()
      expect(face).toHaveClass('head-team')
      fireEvent.click(within(row).getByRole('button', { name: 'G. Antetokounmpo' }))
      expect(open).toHaveBeenCalledWith({ id: 11, name: 'Giannis Antetokounmpo' })
    } finally {
      act(() => setPlayerCardHost(null))
    }
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
    // The game cards are up before the scores; one opened early waits for its numbers.
    const hou = await screen.findByRole('button', { name: /HOU/ })
    expect(hou).toHaveTextContent('Fetching the box score')
    fireEvent.click(hou)
    expect(await screen.findByText('Fetching box score')).toBeInTheDocument()
    expect(screen.getByText('Fetching the scores')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Mine, still counting' })).toBeInTheDocument()
    expect(screen.queryByText('Your night')).not.toBeInTheDocument()

    release(DAY)
    expect(await screen.findByText(/Amen Thompson led with 20 pts, 10 reb/)).toBeInTheDocument()
    expect(screen.queryByText('Fetching box score')).not.toBeInTheDocument()
    expect(screen.getAllByRole('table').some((t) => t.classList.contains('box'))).toBe(true)
  })
  it('opens a box score in place and closes it with Close, Esc or the card itself', async () => {
    mockApi()
    renderScores()
    await screen.findByText(/Amen Thompson led with 20 pts, 10 reb/)
    const hou = screen.getByRole('button', { name: /HOU/ })
    const hasBox = () => !!document.getElementById('box')

    fireEvent.click(hou)
    // The box comes after its game (in the grid after the game's row; under the strip on phones and here,
    // where there is no CSS grid), and the card is its tab.
    const box = document.getElementById('box')!
    expect(hou.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(hou).toHaveAttribute('aria-expanded', 'true')
    expect(document.querySelector('.game-grid')).toHaveClass('has-open')
    fireEvent.click(screen.getByRole('button', { name: 'Close box score' }))
    expect(hasBox()).toBe(false)
    expect(hou).toHaveAttribute('aria-expanded', 'false')
    expect(hou).toHaveFocus()

    fireEvent.click(hou)
    expect(hasBox()).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(hasBox()).toBe(false)

    fireEvent.click(hou)
    fireEvent.click(hou)
    expect(hasBox()).toBe(false)
  })

  it('hides the games summary line while a box score is open', async () => {
    mockApi()
    renderScores()
    await screen.findByText(/Amen Thompson led with 20 pts, 10 reb/)
    const summary = screen.getByText(/All 2 games · 1 of your players in action/).closest('.sc-sum')!
    const hou = screen.getByRole('button', { name: /HOU/ })
    expect(summary).not.toHaveClass('sl-away')

    fireEvent.click(hou)
    expect(summary).toHaveClass('sl-away')
    expect(summary).toHaveAttribute('aria-hidden', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(summary).not.toHaveClass('sl-away')
    expect(summary).not.toHaveAttribute('aria-hidden')

    fireEvent.click(hou)
    expect(summary).toHaveClass('sl-away')
    fireEvent.click(screen.getByRole('button', { name: 'Close box score' }))
    expect(summary).not.toHaveClass('sl-away')
  })

  it('closes a player card opened from the box score first, and the box score on the next Esc', async () => {
    const never = () => new Promise(() => {})
    mockApi({ '/api/player-card': never, '/api/player-card/extras': never })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Scores leagueId={1} season={2027} teamId={3} teams={TEAMS} creds={null} matchup={null} />
        <PlayerCardHost leagueRef={{ leagueId: 1, season: 2027 }} creds={null} teams={[]} myTeamId={3} />
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /HOU/ }))
    const box = document.getElementById('box')!
    fireEvent.click(within(box).getByRole('button', { name: 'Alperen Sengun' }))
    expect(await screen.findByRole('dialog', { name: 'Alperen Sengun' })).toBeInTheDocument()

    fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.getElementById('box')).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.getElementById('box')).toBeNull()
  })

  it("adds our call's total under the two teams, and the real total once the game is on", async () => {
    const called: ScoreDay = {
      ...DAY,
      games: DAY.games.map((g) => ({ ...g, call: { away: 101, home: 112, chance: 0.82 } })),
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input), 'http://x').pathname
      if (path === '/api/scores/sits') return new Response(JSON.stringify({ days: [] }))
      return new Response(JSON.stringify(called))
    })
    const { container } = renderScores()
    await screen.findByText(/Amen Thompson led with/)
    const played = container.querySelector('.game-card[data-game="7"] .call-total-row')!
    const g = DAY.games[0]
    expect(played.querySelector('.ct-call')!.textContent).toBe('213')
    expect(played.querySelector('.ct-real')!.textContent).toBe(String(g.away.score! + g.home.score!))
    const later = container.querySelector('.game-card[data-game="8"] .call-total-row')!
    expect(later.querySelector('.ct-call')!.textContent).toBe('213')
    expect(later.querySelector('.ct-real')!.textContent).toBe('')
    expect(container.querySelector('.game-card[data-game="8"]')!.textContent).toMatch(/213 in all/)
  })

  it('shows one line of our calls for the day on screen, also after switching days', async () => {
    const called = (day: number, date: string): ScoreDay => ({
      ...DAY,
      day,
      date,
      games: DAY.games.map((g) => ({ ...g, call: { away: 101, home: 112, chance: 0.82 } })),
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = new URL(String(input), 'http://x').pathname
      if (path === '/api/scores/sits') return new Response(JSON.stringify({ days: [] }))
      const day = JSON.parse(String(init?.body)).day
      return new Response(JSON.stringify(day === 3 ? called(3, '2026-10-22') : called(4, '2026-10-23')))
    })
    const { container } = renderScores()
    await screen.findByText(/Amen Thompson led with/)
    expect(container.querySelectorAll('.call-tally')).toHaveLength(1)
    // The tally sits on the summary row; the key sentence lives in How this works now.
    expect(container.querySelector('.sc-sum .call-tally')!.textContent).toMatch(/^Our calls \d+ of \d+ right · \d+ pts off a team$/)
    expect(container.querySelector('.sc-sum')!.textContent).not.toMatch(/locked at tip-off/)
    fireEvent.click(screen.getByRole('button', { name: /^Thu 22/ }))
    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: /^Thu 22/ })[0]).toHaveAttribute('aria-pressed', 'true'))
    await vi.waitFor(() => expect(container.querySelectorAll('.call-tally')).toHaveLength(1))
    expect(container.querySelectorAll('.game-card.has-call').length).toBeGreaterThan(0)
  })

  it('opens a game that has not started into its pre-game box once Our call is in', async () => {
    const tonight: ScoreDay = {
      ...DAY,
      games: [
        ...DAY.games,
        game({
          id: 401909306,
          status: 'scheduled',
          start: '2099-11-21T00:30:00Z',
          away: { pro_team_id: 19, abbrev: 'ORL', name: 'Orlando Magic', score: null },
          home: { pro_team_id: 17, abbrev: 'BKN', name: 'Brooklyn Nets', score: null },
          call: { away: 114, home: 109, chance: 0.636 },
        }),
      ],
    }
    const fetchMock = mockApi({ '/api/scores/games': () => tonight, '/api/scores': () => tonight, '/api/scores/pregame': () => pregame })
    const { container } = renderScores({ opponentId: 8, opponentName: 'Rival' })
    await screen.findByText(/Amen Thompson led with/)
    // Without a call there is nothing to open yet.
    expect(container.querySelector('.game-card[data-game="8"]')!.tagName).toBe('DIV')
    const card = container.querySelector<HTMLButtonElement>('.game-card[data-game="401909306"]')!
    expect(card.tagName).toBe('BUTTON')
    fireEvent.click(card)
    expect(await screen.findByText(/Brooklyn's defense is soft, and that outweighs Orlando playing on the road/)).toBeInTheDocument()
    expect(bodies(fetchMock, '/api/scores/pregame')).toContainEqual(expect.objectContaining({ game_id: 401909306, day: 4 }))
    const box = container.querySelector('#box')!
    expect(within(box as HTMLElement).getByRole('heading', { level: 2 }).textContent).toMatch(/Pre-game box/)
    expect(within(box as HTMLElement).getByText('How it could go')).toBeInTheDocument()
    expect(within(box as HTMLElement).getByText('Orlando by 15+')).toBeInTheDocument()
    // Can owns Banchero (out tonight); the rival owns Wagner and Carter Jr.
    expect(within(box as HTMLElement).getByText('Yours tonight')).toBeInTheDocument()
    expect(within(box as HTMLElement).getAllByText('Out tonight').length).toBeGreaterThan(0)
    // Out tonight and where his share went: each name opens the player card.
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    try {
      const outline = box.querySelector<HTMLElement>('.pg-outline')!
      fireEvent.click(within(outline).getByRole('button', { name: 'P. Banchero' }))
      expect(open).toHaveBeenLastCalledWith({ id: expect.any(Number), name: 'Paolo Banchero' })
      fireEvent.click(within(outline).getByRole('button', { name: 'Wagner' }))
      expect(open).toHaveBeenLastCalledWith({ id: 4566434, name: 'Franz Wagner' })
    } finally {
      act(() => setPlayerCardHost(null))
    }
    // A row opens to his line built step by step.
    fireEvent.click(within(box as HTMLElement).getByRole('button', { name: "Why Franz Wagner's line" }))
    expect(within(box as HTMLElement).getByText('His usual line')).toBeInTheDocument()
    expect(within(box as HTMLElement).getByText('Tonight, our estimate')).toBeInTheDocument()
    fireEvent.click(within(box as HTMLElement).getByRole('button', { name: /Why the gap/ }))
    expect(within(box as HTMLElement).getByText(/more than the 240 a game has/)).toBeVisible()
  })
})
