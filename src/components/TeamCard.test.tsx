import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNbaTeam, fetchPlayerIndex, type IndexedPlayer, type NbaTeamInfo, type OverviewTeam } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { closeTeamCard } from '../lib/teamCard'
import { PlayerSearch, PlayerSearchKey } from './PlayerSearch'
import { TeamCardHost } from './TeamCard'

vi.mock('../api/client', async (orig) => ({
  ...(await orig<object>()),
  fetchPlayerIndex: vi.fn(),
  fetchNbaTeam: vi.fn(),
}))

function p(player_id: number, name: string, owner_team_id: number | null, extra: Partial<IndexedPlayer> = {}) {
  return {
    player_id,
    name,
    owner_team_id,
    pro_team: 'DEN',
    position: 'C',
    percent_owned: 50,
    injury_status: null,
    ...extra,
  } as IndexedPlayer
}

const PLAYERS = [
  p(1, 'Nikola Jokic', 5, { percent_owned: 100 }),
  p(2, 'Christian Braun', 3, { position: 'SG', percent_owned: 43 }),
  p(3, 'Cameron Johnson', null, { position: 'SF', percent_owned: 13 }),
  p(4, 'Spencer Jones', null, { position: 'SF', percent_owned: 0.2 }),
  p(5, 'Josh Hart', null, { pro_team: 'NY' }),
]
const TEAMS = [
  { id: 3, name: 'Kucukesat Aspavas' },
  { id: 5, name: 'Antalya Apaches' },
] as OverviewTeam[]

function result(won: boolean, opponent: string, home: boolean, by: number, top: string, pts: number) {
  return {
    game_id: Math.round(Math.random() * 1e9),
    date: '2026-11-14',
    start: '2026-11-15T00:00:00Z',
    home,
    opponent,
    opponent_name: opponent,
    points: won ? 110 + by : 110,
    opponent_points: won ? 110 : 110 + by,
    won,
    top: { player_id: top === 'Nikola Jokic' ? 1 : 9, name: top, pts, reb: 8, ast: 8 },
  }
}

const DEN: NbaTeamInfo = {
  abbrev: 'DEN',
  name: 'Denver Nuggets',
  wins: 7,
  losses: 4,
  streak: 'W2',
  // Most recent first.
  latest: [
    result(true, 'NO', false, 8, 'Nikola Jokic', 26),
    result(true, 'MEM', false, 5, 'Jamal Murray', 30),
    result(false, 'HOU', false, 10, 'Jamal Murray', 38),
    result(true, 'IND', false, 12, 'Nikola Jokic', 19),
    result(true, 'TOR', true, 19, 'Nikola Jokic', 31),
  ],
  next_game: null,
}

const open = vi.fn()

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlayerSearchKey />
      <PlayerSearch leagueRef={{ leagueId: 1, season: 2027 }} creds={null} teams={TEAMS} myTeamId={3} />
      <TeamCardHost leagueRef={{ leagueId: 1, season: 2027 }} creds={null} teams={TEAMS} myTeamId={3} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(fetchPlayerIndex).mockResolvedValue({ league_id: 1, season: 2027, players: PLAYERS })
  vi.mocked(fetchNbaTeam).mockResolvedValue(DEN)
  setPlayerCardHost({ open, prefetch: vi.fn() })
})

afterEach(() => {
  closeTeamCard()
  cleanup()
  setPlayerCardHost(null)
  open.mockReset()
})

async function openDenver() {
  fireEvent.click(screen.getByRole('button', { name: 'Find a player' }))
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value: 'nugg' } })
  const team = await screen.findByRole('option', { name: /^Denver Nuggets, NBA team/ })
  await waitFor(() => expect(team.getAttribute('aria-label')).toContain('yours: Christian Braun'))
  fireEvent.click(team)
  return screen.findByRole('dialog', { name: 'Denver Nuggets' })
}

describe('TeamCard', () => {
  it('search finds a team above its players, with your stake', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Find a player' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'den' } })
    const team = await screen.findByRole('option', { name: /^Denver Nuggets, NBA team/ })
    await waitFor(() => expect(team.getAttribute('aria-label')).toContain('1 free agent worth a look'))
    expect(screen.getAllByRole('option')[0]).toBe(team)
  })

  it('opens the team card: record, streak, last five, one sentence, roster', async () => {
    setup()
    const dialog = await openDenver()
    expect(document.activeElement?.textContent).toBe('Denver Nuggets')
    await screen.findByLabelText('Record 7 wins, 4 losses')
    expect(screen.getByText('Won 2 straight')).toBeTruthy()
    expect(screen.getAllByRole('listitem', { name: /^Nov 14, (won|lost)/ })).toHaveLength(5)
    expect(
      screen.getByText('Won 4 of 5, the only loss by 10 at Houston, with Jokic their top scorer in 3.'),
    ).toBeTruthy()
    // Most rostered first; the 0.2% free agent folds into the deep bench.
    const rows = () => [...dialog.querySelectorAll('.tc-row')].map((r) => r.getAttribute('aria-label')?.split(',')[0])
    await waitFor(() => expect(rows()).toEqual(['Nikola Jokic', 'Christian Braun', 'Cameron Johnson']))
    // Free Agents shows every free agent its count says, the deep bench too.
    const fa = screen.getAllByRole('button', { name: /^Free Agents/ })[0]
    expect(fa.textContent).toBe('Free Agents2')
    fireEvent.click(fa)
    expect(rows()).toEqual(['Cameron Johnson', 'Spencer Jones'])
    expect(screen.queryByRole('button', { name: /Deep bench/ })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /^All/ })[0])
    fireEvent.click(screen.getByRole('button', { name: /Deep bench/ }))
    expect(rows()).toContain('Spencer Jones')
    fireEvent.click(screen.getAllByRole('button', { name: /^Yours/ })[0])
    expect(rows()).toEqual(['Christian Braun'])
  })

  it('a roster player opens his card; Esc closes only the top card', async () => {
    setup()
    const dialog = await openDenver()
    const braun = await screen.findByRole('button', { name: /^Christian Braun, SG, on your team/ })
    fireEvent.click(braun)
    expect(open).toHaveBeenCalledWith({ id: 2, name: 'Christian Braun' })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Denver Nuggets' })).toBeNull())
    expect(dialog.isConnected).toBe(false)
    // The search is still there, its field focused again.
    expect(document.activeElement).toBe(screen.getByRole('combobox'))
  })
})
