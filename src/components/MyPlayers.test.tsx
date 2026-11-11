import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DayLineup, LineupSpot, ScoreDay } from '../api/client'
import { game, line } from '../test/fixtures'
import { MyPlayers } from './MyPlayers'

const LIVE: ScoreDay = {
  league_id: 1,
  season: 2027,
  day: 22,
  date: '2026-11-10',
  live: true,
  updated_at: '2026-11-11T03:00:00Z',
  complete: true,
  days: [
    { day: 21, date: '2026-11-09', games: 8 },
    { day: 22, date: '2026-11-10', games: 6 },
    { day: 23, date: '2026-11-11', games: 10 },
  ],
  week: [],
  games: [
    game({
      id: 1,
      status: 'live',
      clock: 'Q4 4:12',
      away: { pro_team_id: 2, abbrev: 'BOS', name: 'Boston Celtics', score: 98 },
      home: { pro_team_id: 20, abbrev: 'PHI', name: 'Philadelphia 76ers', score: 94 },
      lines: [line({ player_id: 10, name: 'Jayson Tatum', pro_team_id: 2, owner_team_id: 3, pts: 27, fgm: 9, fga: 19 })],
    }),
    game({
      id: 2,
      status: 'scheduled',
      start: '2026-11-11T04:00:00Z',
      away: { pro_team_id: 25, abbrev: 'OKC', name: 'Oklahoma City Thunder', score: null },
      home: { pro_team_id: 22, abbrev: 'POR', name: 'Portland Trail Blazers', score: null },
      lines: [],
    }),
  ],
}

const spot = (player_id: number, name: string, slot: string, game_id: number | null, eligible = ['UTIL']): LineupSpot => ({
  player_id,
  name,
  pro_team_id: 2,
  slot,
  slot_id: 0,
  starting: slot !== 'BE' && slot !== 'IR',
  injury_status: 'ACTIVE',
  game_id,
  eligible,
})

const LINEUP: DayLineup = {
  league_id: 1,
  season: 2027,
  team_id: 3,
  day: 22,
  date: '2026-11-10',
  spots: [
    spot(10, 'Jayson Tatum', 'SF', 1),
    spot(11, 'Aday Mara', 'C', 2),
    spot(12, 'Saddiq Bey', 'UTIL', null),
    spot(13, 'Christian Braun', 'BE', 2, ['SG', 'UTIL']),
  ],
  open_slots: [],
  fetched_at: new Date().toISOString(),
}

function mockApi(lineup: DayLineup = LINEUP) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input), 'http://x').pathname
    return new Response(JSON.stringify(path === '/api/scores/lineup' ? lineup : LIVE))
  })
}

function renderIt() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MyPlayers leagueId={1} season={2027} teamId={3} creds={null} />
    </QueryClientProvider>,
  )
}

describe('MyPlayers', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("follows ESPN's lineup order and shows each player's night", async () => {
    mockApi()
    renderIt()
    const tatum = (await screen.findAllByText('Jayson Tatum'))
      .map((e) => e.closest('li.mp-row'))
      .find(Boolean) as HTMLElement
    const rows = [...document.querySelectorAll('.mp-row')].map((r) => r.querySelector('.mp-slot')?.textContent)
    expect(rows).toEqual(['SF', 'C', 'UTIL', 'BE'])
    expect(tatum).toHaveClass('mp-live')
    expect(within(tatum).getByText('Q4 4:12')).toBeInTheDocument()
    expect(within(tatum).getByText('27')).toBeInTheDocument()
    const bey = screen.getByText('Saddiq Bey').closest('li') as HTMLElement
    expect(bey).toHaveTextContent(/No game tonight/)
    expect(document.querySelector('.mp-seg-play')).toHaveTextContent('Playing tonight2 of 3 starting slotsIdle: Bey')
    // Tip order: the live game's starters, by name for screen readers.
    expect(document.querySelector('.mp-groups')).toHaveTextContent('Jayson Tatum')
    expect(screen.getByText('Starters so far')).toBeInTheDocument()
  })

  it('asks for a swap when a bench player plays and fits an idle slot', async () => {
    mockApi()
    renderIt()
    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent('Braun plays from your bench, Bey has no game in UTIL.')
    expect(within(note).getByRole('link', { name: /Open team in ESPN/ })).toHaveAttribute(
      'href',
      'https://fantasy.espn.com/basketball/team?leagueId=1&teamId=3&seasonId=2027',
    )
  })

  it('says nothing when there is nothing to swap', async () => {
    mockApi({ ...LINEUP, spots: LINEUP.spots.filter((s) => s.slot !== 'BE') })
    renderIt()
    await screen.findAllByText('Jayson Tatum')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
