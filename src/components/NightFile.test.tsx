import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, CompareMarket, ComparePlayer } from '../lib/iddaaCompare'
import { NightSearch } from './NightFile'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

const NOW = new Date('2026-11-22T12:00:00Z')

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

const line = (
  name: string,
  id: number,
  team: string,
  stat: ComparePlayer['stat'],
  ours: number,
  book: number,
  n: number,
  odd: number,
  chance: number,
): ComparePlayer => ({
  name,
  player_id: id,
  team,
  stat,
  played: null,
  ladder: [],
  rungs: [{ n, odd, book: 1 / odd, ours: chance, value: chance * odd - 1, hit: null }],
  ours,
  book,
  actual: null,
  gap: ours - book,
  ours_hit: null,
  book_hit: null,
  closer: null,
})

const game = (
  id: number,
  away: string,
  home: string,
  m: CompareMarket,
  players: ComparePlayer[] = [],
): CompareGame => ({
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
  estimates: [
    {
      name: 'Bench Guy',
      player_id: 900 + id,
      team: home,
      minutes: 14,
      pts: 6.2,
      reb: 2,
      ast: 1,
      stl: 0.4,
      blk: 0.2,
      three_pm: 0.8,
      played: null,
      actual: null,
    },
  ],
})

function night(): BookCompare {
  const games = [
    game(1, 'MIA', 'PHI', win('PHI', 0.74, 1.55), [
      line('Tyrese Maxey', 11, 'PHI', 'pts', 27.4, 24.5, 25, 1.8, 0.58),
      line('Tyrese Maxey', 11, 'PHI', 'three_pm', 3.1, 3.2, 4, 2.2, 0.38),
      line('Tyler Herro', 12, 'MIA', 'ast', 5.2, 4.6, 5, 1.7, 0.55),
    ]),
    game(2, 'DAL', 'DEN', win('DEN', 0.71, 1.5), [
      line('Nikola Jokić', 13, 'DEN', 'reb', 12.6, 11.5, 12, 1.62, 0.6),
      line('Nikola Jokić', 13, 'DEN', 'ast', 9.8, 9.5, 10, 1.9, 0.47),
    ]),
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

function mount(onJump = vi.fn(), only?: { game: number | null; set: (g: number | null) => void }) {
  const data = night()
  const slot = document.createElement('div')
  document.body.appendChild(slot)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const r = render(
    <QueryClientProvider client={qc}>
      <NightSearch
        data={data}
        lines={linesOf(data, NOW)}
        slot={slot}
        league={null}
        onJump={onJump}
        onlyGame={only?.game ?? null}
        onOnlyGame={only?.set}
      />
    </QueryClientProvider>,
  )
  return { ...r, slot, onJump }
}

describe('Night File search', () => {
  it("lists tonight's match for what is typed and opens his night on Enter", () => {
    mount()
    const box = screen.getByRole('combobox')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'jok' } })
    const opts = screen.getAllByRole('option')
    expect(opts[0].textContent).toContain('Nikola Jokić')
    expect(opts[0].textContent).toContain('2 lines · 1 bet')
    fireEvent.keyDown(box, { key: 'Enter' })
    const dialog = screen.getByRole('dialog', { name: 'Nikola Jokić, tonight' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(within(dialog).getByText('Rebounds')).toBeTruthy()
    expect(within(dialog).getByText('Assists')).toBeTruthy()
  })

  it('jumps to his line in Where we disagree and closes the file', () => {
    vi.useFakeTimers()
    const { onJump } = mount()
    const box = screen.getByRole('combobox')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'maxey' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getAllByRole('button', { name: /Disagree #/ })[0])
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ where: 'disagree' }))
    vi.useRealTimers()
  })

  it('says plainly when nobody tonight matches, and offers the teams', () => {
    mount()
    const box = screen.getByRole('combobox')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'zzz' } })
    expect(screen.getByText(/No one on tonight's 2 games matches that/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'DEN' }))
    expect(screen.getByRole('dialog', { name: 'Denver Nuggets, tonight' })).toBeTruthy()
  })

  it('opens from the / key', () => {
    mount()
    fireEvent.keyDown(document.body, { key: '/' })
    expect(document.activeElement).toBe(screen.getByRole('combobox'))
  })

  it('walks his spots from a bar, keeps him in the link, and stops on ✕', () => {
    vi.useFakeTimers()
    const { onJump } = mount()
    const box = screen.getByRole('combobox')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'maxey' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(window.location.search).toContain('follow=p11')
    const walk = screen.getByRole('button', { name: /Walk his \d+ spots?/ })
    fireEvent.click(walk)
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    const bar = screen.getByRole('region', { name: 'Following Tyrese Maxey' })
    expect(within(bar).getByText(/^1$/)).toBeTruthy()
    expect(onJump).toHaveBeenCalledTimes(1)
    const prev = within(bar).getByRole('button', { name: 'Previous spot' }) as HTMLButtonElement
    const next = within(bar).getByRole('button', { name: 'Next spot' }) as HTMLButtonElement
    expect(prev.disabled).toBe(true)
    fireEvent.click(next)
    expect(onJump).toHaveBeenCalledTimes(2)
    expect(within(bar).getByText(/^2$/)).toBeTruthy()
    // His night opens the file again
    fireEvent.click(within(bar).getByRole('button', { name: /Open the night again/ }))
    expect(screen.getByRole('dialog', { name: 'Tyrese Maxey, tonight' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: /Disagree #/ })[0])
    act(() => {
      vi.runAllTimers()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Stop following' }))
    expect(screen.queryByRole('region', { name: /Following/ })).toBeNull()
    expect(window.location.search).not.toContain('follow=')
    vi.useRealTimers()
  })

  it('opens the file named in the link', () => {
    window.history.replaceState(null, '', '/?view=estimates&follow=tDEN')
    mount()
    expect(screen.getByRole('dialog', { name: 'Denver Nuggets, tonight' })).toBeTruthy()
  })

  it("narrows Where we disagree to the team's game with Only this game", () => {
    const set = vi.fn()
    mount(undefined, { game: null, set })
    const box = screen.getByRole('combobox')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'denver' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    const sw = screen.getByRole('switch', { name: /Only this game/ })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(set).toHaveBeenCalledWith(2)
  })
})
