import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, CompareMarket, ComparePlayer } from '../lib/iddaaCompare'
import { FRONT_KEY } from './KuponStack'
import { Kupons } from './Kupons'

// The phone stack under 900px: the front slip whole, the other Kupons as edges to tap.

/** A matchMedia that answers the stack query and reduced motion as asked. */
function media({ phone = true, still = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width: 899px') ? phone : query.includes('reduce') ? still : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

beforeEach(() => {
  localStorage.clear()
  media()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (document as { startViewTransition?: unknown }).startViewTransition
  vi.restoreAllMocks()
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

const show = (data: BookCompare = night(true)) => render(<Kupons data={data} lines={linesOf(data, NOW)} />)

const edges = () => within(screen.getByRole('list', { name: 'Other Kupons' })).getAllByRole('button')
const front = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.ic-ks-slips > li')).filter((li) => !li.hidden)

describe("Tonight's Kupons as a stack", () => {
  it('shows the first slip whole and every other Kupon as an edge under it', () => {
    const { container } = show()
    const shown = front(container)
    expect(shown).toHaveLength(1)
    expect(shown[0].id).toBe('ic-ku-safe')
    expect(container.querySelector('.ic-ku-rail')).toBeNull()
    const list = screen.getByRole('list', { name: 'Other Kupons' })
    expect(list.tagName).toBe('UL')
    const all = edges()
    for (const b of all) {
      expect(b.parentElement!.tagName).toBe('LI')
      expect(b.getAttribute('aria-expanded')).toBe('false')
      const id = b.getAttribute('aria-controls')!
      expect(container.querySelector(`#${id}`)!.hasAttribute('hidden')).toBe(true)
    }
    expect(all.map((b) => b.querySelector('.en')!.firstChild!.textContent)).toEqual(['Players Only', 'Surprise'])
  })

  it("gives each edge its total odds and probability, or why it isn't on tonight", () => {
    show()
    const [players, surprise] = edges()
    expect(players.querySelector('.ev')!.textContent).toMatch(/^\d+\.\d\d odds · ~\d+%$/)
    expect(players.getAttribute('aria-label')).toMatch(/^Players Only, \d+\.\d\d odds, about \d+%\. Bring to the front$/)
    expect(surprise.querySelector('.ev')!.textContent).toBe('Not tonight')
  })

  it('says when player bets come in on a waiting Players Only edge', () => {
    show(night(false))
    const players = edges().find((b) => b.getAttribute('aria-controls') === 'ic-ku-players')!
    expect(players.querySelector('.ev')!.textContent).toBe('At 19:00')
  })

  it('brings a tapped edge to the front, remembers it and moves focus to its heading', () => {
    const { container } = show()
    fireEvent.click(edges()[0])
    expect(front(container).map((li) => li.id)).toEqual(['ic-ku-players'])
    expect(localStorage.getItem(FRONT_KEY)).toBe('players')
    expect(document.activeElement).toBe(container.querySelector('#ic-ku-players h3'))
    // the slip that was in front is now the first edge, merged names and all
    const first = edges()[0]
    expect(first.getAttribute('aria-controls')).toBe('ic-ku-safe')
    expect(first.querySelector('small')!.textContent).toBe('+ Matches Only')
  })

  it('opens on the remembered Kupon, and on Highest Confidence for a Matches Only riding on it', () => {
    localStorage.setItem(FRONT_KEY, 'surprise')
    const { container, unmount } = show()
    expect(front(container).map((li) => li.id)).toEqual(['ic-ku-surprise'])
    unmount()

    localStorage.setItem(FRONT_KEY, 'matches')
    const again = show()
    expect(front(again.container).map((li) => li.id)).toEqual(['ic-ku-safe'])
  })

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { container } = show()
    fireEvent.click(edges()[1])
    expect(front(container).map((li) => li.id)).toEqual(['ic-ku-surprise'])
  })

  it('swaps through a View Transition where there is one', () => {
    const vt = vi.fn((cb: () => void) => cb())
    ;(document as { startViewTransition?: unknown }).startViewTransition = vt
    const { container } = show()
    act(() => {
      fireEvent.click(edges()[0])
    })
    expect(vt).toHaveBeenCalledTimes(1)
    expect(front(container).map((li) => li.id)).toEqual(['ic-ku-players'])
  })

  it('swaps at once under reduced motion', () => {
    media({ still: true })
    const vt = vi.fn((cb: () => void) => cb())
    ;(document as { startViewTransition?: unknown }).startViewTransition = vt
    const { container } = show()
    fireEvent.click(edges()[0])
    expect(vt).not.toHaveBeenCalled()
    expect(front(container).map((li) => li.id)).toEqual(['ic-ku-players'])
  })

  it('keeps the rail with every slip from 900px', () => {
    media({ phone: false })
    const { container } = show()
    expect(container.querySelector('.ic-ku-rail')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Other Kupons' })).toBeNull()
    expect(container.querySelectorAll('.ic-ku-slip[hidden]')).toHaveLength(0)
  })
})
