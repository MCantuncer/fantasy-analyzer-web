import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, CompareMarket, ComparePlayer } from '../lib/iddaaCompare'
import { setPlayerCardHost } from '../lib/playerCard'
import { Kupons } from './Kupons'

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

const NOW = new Date('2026-11-22T12:00:00Z')

const win = (team: string, ours: number, pick: number, hit: boolean | null = null): CompareMarket => ({
  market: 'winner',
  team,
  book_team: team,
  won: '',
  ours,
  book: 0.6,
  actual: null,
  gap: ours - 0.6,
  ours_hit: hit,
  book_hit: null,
  closer: null,
  odds: [
    { side: 'pick', odd: pick },
    { side: 'other', odd: 2.4 },
  ],
})

const scorer = (name: string, id: number, team: string): ComparePlayer => ({
  name,
  player_id: id,
  team,
  stat: 'pts',
  played: null,
  ladder: [],
  rungs: [{ n: 20, odd: 2.1, book: 0.5, ours: 0.48, value: null, hit: null }],
  ours: 21,
  book: 20.5,
  actual: null,
  gap: 0.5,
  ours_hit: null,
  book_hit: null,
  closer: null,
})

const game = (id: number, away: string, home: string, m: CompareMarket, players: ComparePlayer[] = []): CompareGame => ({
  game_id: id,
  away,
  home,
  tip: '2026-11-23T00:00:00Z',
  checked: '',
  status: 'scheduled',
  away_score: null,
  home_score: null,
  markets: [m],
  players,
})

function night(players = false): BookCompare {
  const games = [
    game(1, 'MIA', 'PHI', win('PHI', 0.74, 1.55)),
    game(2, 'IND', 'NY', win('NY', 0.71, 1.5)),
    game(3, 'BOS', 'ORL', win('BOS', 0.58, 1.8), players ? [scorer('Ann Shooter', 77, 'ORL')] : []),
    game(4, 'SAC', 'HOU', win('HOU', 0.62, 1.7), players ? [scorer('Bo Scorer', 78, 'SAC')] : []),
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

const show = (data: BookCompare, onMatch = vi.fn()) =>
  render(<Kupons data={data} lines={linesOf(data, NOW)} onMatch={onMatch} />)

describe("Tonight's Kupons", () => {
  it('heads the section with a visible hint, not a tooltip or the old rules', () => {
    show(night())
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe("Tonight's Kupons")
    expect(screen.getByText("iddaa's bet slips")).toBeTruthy()
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.queryByText(/How we build them/)).toBeNull()
  })

  it('writes the sum under the total odds and shows the probability beside it', () => {
    const { container } = show(night())
    const slip = container.querySelector('#ic-ku-safe') as HTMLElement
    expect(slip.querySelector('.prod')!.textContent).toBe('1.55 × 1.50 × 1.80')
    expect(within(slip).getByText('Total odds')).toBeTruthy()
    expect(within(slip).getByText('Probability')).toBeTruthy()
  })

  it('says the merged slip waits on player bets only while they are still to come', () => {
    const { container, unmount } = show(night())
    expect(within(container.querySelector('#ic-ku-safe') as HTMLElement).getByText('Matches Only')).toBeTruthy()
    expect(screen.getByText('Same picks until player bets come in')).toBeTruthy()
    const players = container.querySelector('#ic-ku-players') as HTMLElement
    expect(players.classList.contains('quiet')).toBe(true)
    expect(players.textContent).toContain('Player bets usually come in after 19:00')
    unmount()

    show(night(true))
    expect(screen.getByText('Same picks tonight')).toBeTruthy()
    expect(screen.queryByText('Same picks until player bets come in')).toBeNull()
  })

  it("opens the match card from a game leg, one button with no ring or popover inside", () => {
    const onMatch = vi.fn()
    show(night(), onMatch)
    const leg = screen.getByRole('button', { name: /^IND @ NY, Match result NY to win.*Opens the match card$/ })
    expect(leg.querySelector('button')).toBeNull()
    expect(leg.querySelector('.ic-ch')!.textContent).toBe('71%')
    fireEvent.click(leg)
    expect(onMatch).toHaveBeenCalledWith(2, 'home')
    expect(screen.queryByRole('button', { name: /^Our chance/ })).toBeNull()
  })

  it("opens the player's card from a player leg", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    show(night(true))
    fireEvent.click(screen.getByRole('button', { name: /^Ann Shooter, 20\+ points.*Opens the player card$/ }))
    expect(open).toHaveBeenCalledWith({ id: 77, name: 'Ann Shooter' })
  })

  it('keeps a player leg as plain text with no card to open', () => {
    show(night(true))
    expect(screen.queryByRole('button', { name: /Ann Shooter/ })).toBeNull()
    expect(screen.getAllByText('Ann Shooter').length).toBeGreaterThan(0)
  })

  it('swaps the probability for the result once the night is in', () => {
    const data = night()
    const hits: Record<number, boolean> = { 1: true, 2: false, 3: true, 4: true }
    data.games = data.games.map((g) => ({
      ...g,
      status: 'final',
      away_score: 100,
      home_score: 99,
      markets: g.markets.map((m) => ({ ...m, ours_hit: hits[g.game_id] })),
    }))
    const { container } = show(data)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe("Last night's Kupons")
    const slip = container.querySelector('#ic-ku-safe') as HTMLElement
    expect(within(slip).getByText('Lost on NY to win')).toBeTruthy()
    expect(within(slip).queryByText('Probability')).toBeNull()
    expect(slip.querySelector('.was')!.textContent).toMatch(/^Probability was ~\d+%$/)
    expect(slip.querySelectorAll('.ic-ku-leg.lost')).toHaveLength(1)
    expect(slip.querySelectorAll('.ic-ku-leg.won')).toHaveLength(2)
  })
})
