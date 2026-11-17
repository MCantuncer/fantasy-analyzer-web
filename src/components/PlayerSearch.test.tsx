import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPlayerIndex, type IndexedPlayer, type OverviewTeam } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { PlayerSearch, PlayerSearchBarKey, PlayerSearchKey } from './PlayerSearch'

vi.mock('../api/client', async (orig) => ({
  ...(await orig<object>()),
  fetchPlayerIndex: vi.fn(),
}))

function p(
  player_id: number,
  name: string,
  owner_team_id: number | null,
  extra: Partial<IndexedPlayer> = {},
): IndexedPlayer {
  return {
    player_id,
    name,
    owner_team_id,
    pro_team: 'DEN',
    position: 'C',
    percent_owned: 50,
    injury_status: null,
    on_roster: true,
    ...extra,
  }
}

const PLAYERS = [
  p(1, 'Nikola Jokić', 5, { percent_owned: 100 }),
  p(2, 'Josh Hart', null, {
    pro_team: 'NY',
    position: 'SF',
    percent_owned: 70,
  }),
  p(3, 'Jordan Clarkson', 3, { injury_status: 'OUT' }),
  p(4, 'LeBron James', 7, { percent_owned: 99 }),
]
const TEAMS = [
  { id: 3, name: 'Kucukesat Aspavas' },
  { id: 5, name: 'Antalya Apaches' },
  { id: 7, name: 'Los Avokados' },
] as OverviewTeam[]

const open = vi.fn()
const prefetch = vi.fn()

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlayerSearchKey />
      <PlayerSearchBarKey />
      <PlayerSearch leagueRef={{ leagueId: 1, season: 2027 }} creds={null} teams={TEAMS} myTeamId={3} />
    </QueryClientProvider>,
  )
  return screen.getByRole('combobox', { hidden: true }) as HTMLInputElement
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(fetchPlayerIndex).mockResolvedValue({
    league_id: 1,
    season: 2027,
    players: PLAYERS,
  })
  setPlayerCardHost({ open, prefetch })
})

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
  open.mockReset()
})

const options = () => screen.queryAllByRole('option').map((o) => o.getAttribute('aria-label'))

describe('PlayerSearch', () => {
  it('opens from the key with the field focused', () => {
    const input = setup()
    expect(input.closest('.ps')?.hasAttribute('hidden')).toBe(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Find a player' })[0])
    expect(input.closest('.ps')?.hasAttribute('hidden')).toBe(false)
    expect(document.activeElement).toBe(input)
  })

  it('opens with / and Ctrl+K, and Esc clears then closes', () => {
    const input = setup()
    fireEvent.keyDown(document, { key: '/' })
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: 'jo' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.closest('.ps')?.hasAttribute('hidden')).toBe(true)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(input.closest('.ps')?.hasAttribute('hidden')).toBe(false)
  })

  it('filters every player as you type, saying who has him', async () => {
    const input = setup()
    fireEvent.click(screen.getAllByRole('button', { name: 'Find a player' })[0])
    fireEvent.change(input, { target: { value: 'jo' } })
    await waitFor(() => expect(options()).toHaveLength(3))
    expect(options()).toEqual([
      'Josh Hart, New York Knicks, small forward, free agent, 70% rostered',
      'Jordan Clarkson, Denver Nuggets, center, out, on your team, 50% rostered',
      'Nikola Jokić, Denver Nuggets, center, on Antalya Apaches, 100% rostered',
    ])
    const segs = screen.getByRole('group', { name: 'Who has him' })
    expect(within(segs).getByRole('button', { name: /Free Agents/ }).textContent).toContain('1')
    fireEvent.click(within(segs).getByRole('button', { name: /Taken/ }))
    expect(options()).toEqual(['Nikola Jokić, Denver Nuggets, center, on Antalya Apaches, 100% rostered'])
  })

  it('opens the card with the arrows and Enter, and keeps it as a recent player', async () => {
    const input = setup()
    fireEvent.click(screen.getAllByRole('button', { name: 'Find a player' })[0])
    fireEvent.change(input, { target: { value: 'jo' } })
    await waitFor(() => expect(options()).toHaveLength(3))
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(open).toHaveBeenCalledWith({ id: 3, name: 'Jordan Clarkson' })
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByText('Recently opened')).toBeTruthy()
    expect(options()).toEqual(['Jordan Clarkson, Denver Nuggets, center, out, on your team, 50% rostered'])
  })

  it('says when no one matches', async () => {
    const input = setup()
    fireEvent.click(screen.getAllByRole('button', { name: 'Find a player' })[0])
    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzq' } })
    })
    await waitFor(() => expect(screen.getByText('No one called “zzq”')).toBeTruthy())
  })
})
