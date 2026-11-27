import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TradeOfTheDay as Pick } from '../api/client'
import { fetchTradeOfTheDay } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { P } from '../test/newsSince'
import { TradeOfTheDay } from './TradeOfTheDay'

vi.mock('../api/client', async (orig) => ({ ...(await orig<object>()), fetchTradeOfTheDay: vi.fn() }))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const side = (team_id: number, team_name: string, sends = [P.morant], before = 0.61, after = 0.64) => ({
  team_id,
  team_name,
  abbrev: 'X',
  sends,
  drop: null,
  cats_gain: 0.3,
  category_changes: { REB: 0.19, BLK: 0.06 },
  punts: [],
  acceptance: 0.5,
  acceptance_label: 'possible',
  pitch: '',
  reasons: [],
  facts: [],
  gains: [
    { category: 'REB', league_rank: 8, per_game: 2.6 },
    { category: 'BLK', league_rank: 7, per_game: 0.6 },
  ],
  playoff_pct_before: before,
  playoff_pct_after: after,
})

const pick = (over: Partial<Pick> = {}) =>
  ({
    status: 'ready',
    date: '2026-11-23',
    league_id: 1,
    season: 2027,
    headline: 'Kavaklidere get the boards, Antalya get a playmaker.',
    sides: [side(4, 'Kavaklidere Boytoys', [P.morant]), side(5, 'Antalya Apaches', [P.holmgren], 0.44, 0.48)],
    team_pairs: 45,
    win_win_deals: 4,
    votes: {},
    pick_id: 'p1',
    ...over,
  }) as unknown as Pick

/** Renders the band and waits for the state the pick asks for (the heading shows while loading too). */
async function show(p: Pick, myTeamId = 3) {
  vi.mocked(fetchTradeOfTheDay).mockResolvedValue(p)
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <TradeOfTheDay
        leagueId={1}
        season={2027}
        leagueName="Chill"
        myTeamId={myTeamId}
        teamIds={[3, 4, 5]}
        creds={null}
      />
    </QueryClientProvider>,
  )
  const ready =
    p.status === 'pending' ? '.totd-bones' : p.status === 'none' ? '.totd-none-line' : '.totd-board:not(.totd-bones)'
  await waitFor(() => expect(view.container.querySelector(ready)).not.toBeNull())
  return view
}

describe('Trade of the day, Quiet Lead', () => {
  it('shows both sides with odds, players and every gain, no toggle', async () => {
    const { container } = await show(pick())
    expect(container.querySelector('.totd-sub')?.textContent).toBe(
      'Mon, Nov 23 · best of 4 win-win deals across 45 team pairs',
    )
    const left = container.querySelector('.totd-l') as HTMLElement
    expect(left.querySelector('.totd-a')?.textContent).toBe('64%')
    expect(left.querySelector('.totd-f')?.textContent).toBe('from 61% ▲+3 pts')
    expect(within(left).getByText('Chet Holmgren')).toBeInTheDocument() // Kavaklidere get what Antalya send
    expect(left.querySelector('.totd-pl .head')).not.toBeNull()
    expect([...left.querySelectorAll('.totd-gain')].map((g) => g.textContent)).toEqual([
      'REB: +19 points of weekly win chance, +2.6 rebounds a game, 8th of 3 in the league nowREB+19 pts+2.6 rebounds a gamenow 8th of 3',
      'BLK: +6 points of weekly win chance, +0.6 blocks a game, 7th of 3 in the league nowBLK+6 pts+0.6 blocks a gamenow 7th of 3',
    ])
    expect(container.querySelector('[aria-expanded]')).toBeNull()
    expect(container.querySelector('.totd-note')?.textContent).toBe('Next at 00:00 UTC')
  })

  it('opens the player card from the names in the deal', async () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = await show(pick())
    within(container.querySelector('.totd-l .totd-pl-name') as HTMLElement)
      .getByRole('button')
      .click()
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: P.holmgren.id }))
    act(() => setPlayerCardHost(null))
  })

  it('shows the tally only after you vote', async () => {
    const votes = { 4: { yes: 3, no: 1 } }
    const before = await show(pick({ votes } as Partial<Pick>))
    expect(before.container.querySelector('.totd-count')).toBeNull()
    cleanup()
    localStorage.setItem('totd-vote:1:2026-11-23:p1:4', 'yes')
    const after = await show(pick({ votes } as Partial<Pick>))
    expect(after.container.querySelector('.totd-count')?.textContent).toBe('3 of 4 say yes')
    expect(within(after.container).getAllByRole('button', { name: 'Yes' })[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks your side and makes proposing it the main action', async () => {
    const p = pick({ sides: [side(3, 'Kucukesat Aspavas'), side(5, 'Antalya Apaches', [P.holmgren])] } as Partial<Pick>)
    const { container, getByRole } = await show(p)
    expect(container.querySelector('.totd-l .totd-me')?.textContent).toBe(' (your team)')
    expect(getByRole('link', { name: 'Propose it to Antalya Apaches on ESPN' })).toHaveAttribute(
      'href',
      'https://fantasy.espn.com/basketball/team?leagueId=1&teamId=5&seasonId=2027',
    )
  })

  it('says it in one line when no deal works', async () => {
    const { container } = await show(pick({ status: 'none', sides: [] } as Partial<Pick>))
    expect(container.querySelector('.totd-none-line')?.textContent).toBe('No deal works for both sides today.')
  })

  it('waits its turn at the final height while the scan runs', async () => {
    const { container } = await show(pick({ status: 'pending', sides: [], stage: null } as Partial<Pick>))
    expect(container.querySelector('.totd-status')?.textContent).toContain('Waiting its turn')
    expect(container.querySelector('.totd-bones')).not.toBeNull()
    expect(container.textContent).not.toContain('Looking at every pair of teams')
  })
})
