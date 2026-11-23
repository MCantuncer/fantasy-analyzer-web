import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, CompareMarket, Line } from '../lib/iddaaCompare'
import { setPlayerCardHost } from '../lib/playerCard'
import { Kupons, PickName } from './Kupons'

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

const line = (playerId: number | null) => ({ name: 'Ausar Thompson', playerId }) as Line

describe('a Kupon pick name', () => {
  it("opens the player's card", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    render(<PickName line={line(4433)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ausar Thompson: player details' }))
    expect(open).toHaveBeenCalledWith({ id: 4433, name: 'Ausar Thompson' })
  })

  it('is plain text with no card to open', () => {
    act(() => setPlayerCardHost({ open: vi.fn(), prefetch: () => {} }))
    render(<PickName line={line(null)} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Ausar Thompson')).toBeTruthy()
  })
})

const win = (team: string, ours: number, pick: number): CompareMarket => ({
  market: 'winner',
  team,
  book_team: team,
  won: '',
  ours,
  book: 0.6,
  actual: null,
  gap: ours - 0.6,
  ours_hit: null,
  book_hit: null,
  closer: null,
  odds: [
    { side: 'pick', odd: pick },
    { side: 'other', odd: 2.4 },
  ],
})

const game = (id: number, away: string, home: string, m: CompareMarket): CompareGame => ({
  game_id: id,
  away,
  home,
  tip: '2026-11-23T00:00:00Z',
  checked: '',
  status: 'scheduled',
  away_score: null,
  home_score: null,
  markets: [m],
  players: [],
})

function night(): BookCompare {
  const games = [
    game(1, 'MIA', 'PHI', win('PHI', 0.74, 1.55)),
    game(2, 'IND', 'NY', win('NY', 0.71, 1.5)),
    game(3, 'BOS', 'ORL', win('BOS', 0.58, 1.8)),
    game(4, 'SAC', 'HOU', win('HOU', 0.62, 1.7)),
  ]
  return {
    season: 2027,
    day: 35,
    date: '2026-11-22',
    days: [35],
    nights: [{ day: 35, date: '2026-11-22', games: games.length }],
    bands: { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 },
    look: { checked: null, ok: null, error: null, games: games.length, matched: games.length },
    games,
    tally: [],
  }
}

describe('a Kupon game pick', () => {
  it("opens the match card's Form on the side it backs; the chance ring stays its own button", () => {
    const data = night()
    const onMatch = vi.fn()
    render(<Kupons data={data} lines={linesOf(data, new Date('2026-11-22T12:00:00Z'))} onMatch={onMatch} />)
    const pick = screen.getAllByRole('button', { name: /^IND @ NY, Match result: open the match form$/ })[0]
    expect(pick.querySelector('button')).toBeNull() // no nested buttons
    fireEvent.click(pick)
    expect(onMatch).toHaveBeenCalledWith(2, 'home')
    fireEvent.click(screen.getAllByRole('button', { name: /^Our chance 63%/ })[0])
    expect(onMatch).toHaveBeenCalledTimes(1)
  })
})
