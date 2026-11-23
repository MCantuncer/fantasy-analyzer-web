import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Me } from '../api/client'
import type { BookCompare, CompareGame } from '../lib/iddaaCompare'
import { IddaaCompare } from './IddaaCompare'
import { ProProvider } from './Pro'

const PRO: Me = {
  id: 1,
  email: 'can@example.com',
  has_google: false,
  leagues: [],
  notices: [],
  admin: true,
  plan: 'pro',
  features: ['estimates'],
  gifted: false,
  payment_due: false,
}

const game = (id: number, status: CompareGame['status'], tip: string): CompareGame => ({
  game_id: id,
  away: 'IND',
  home: 'NY',
  tip,
  checked: '',
  status,
  away_score: null,
  home_score: null,
  markets: [],
  players: [],
})

function night(games: CompareGame[]): BookCompare {
  return {
    season: 2027,
    day: 34,
    date: '2026-11-22',
    days: [33, 34],
    nights: [
      { day: 33, date: '2026-11-21', games: 6 },
      { day: 34, date: '2026-11-22', games: 7 },
    ],
    bands: { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 },
    look: { checked: '2026-11-22T21:33:00Z', ok: true, error: null, games: 4, matched: 4 },
    games,
    tally: [],
  }
}

function mount(data: BookCompare, onHealth?: () => void) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    String(url).includes('/api/book-compare/record')
      ? new Response('{}', { status: 404 })
      : new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }),
  )
  const onBack = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ProProvider me={PRO} signedIn theme="dark" onNeedAccount={vi.fn()}>
        <IddaaCompare onBack={onBack} onHealth={onHealth} />
      </ProProvider>
    </QueryClientProvider>,
  )
  return { onBack }
}

describe('Our Estimates head', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has Back, the title, How to read and Site health, and no intro paragraph', async () => {
    const onHealth = vi.fn()
    const { onBack } = mount(night([]), onHealth)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Site health' }))
    expect(onHealth).toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1, name: 'Our Estimates' })).toBeTruthy()
    expect(screen.queryByText(/never feeds our model/)).toBeNull()
    // One How to read per layout (wide in row 1, phone in row 2); CSS shows one of them.
    const how = screen.getAllByRole('button', { name: 'How to read' })
    expect(how).toHaveLength(2)
    await screen.findByRole('tablist', { name: 'Night' })
    fireEvent.click(how[0])
    expect(screen.getByRole('dialog', { name: 'How to read' }).textContent).toContain('never feeds our model')
  })

  it('leaves Site health out for non-admins', () => {
    mount(night([]))
    expect(screen.queryByRole('button', { name: 'Site health' })).toBeNull()
  })

  it('puts the nights and one meta line in the second row, and the last look in the foot', async () => {
    mount(
      night([
        game(1, 'final', '2026-11-22T19:00:00Z'),
        game(2, 'scheduled', '2026-11-22T22:30:00Z'),
        game(3, 'scheduled', '2026-11-22T22:00:00Z'),
      ]),
    )
    const tabs = await screen.findByRole('tablist', { name: 'Night' })
    const head = tabs.closest('.ic-head') as HTMLElement
    expect(within(tabs).getAllByRole('tab').map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true'])
    expect(within(tabs).getByRole('tab', { selected: true }).textContent).toContain('Tonight')
    const meta = head.querySelector('.ic-meta') as HTMLElement
    expect(meta.textContent).toMatch(/^2 of 3 games to come/)
    expect(meta.textContent).toContain('First tip')
    expect(meta.textContent).toContain('Last look')
    expect(screen.getByText(/Last look at iddaa/).textContent).toMatch(/worked · 4 of 4 games matched$/)
    expect(document.querySelector('.ic-bands')).toBeNull()
  })

  it('says when the last look failed', async () => {
    const data = night([game(1, 'scheduled', '2026-11-22T22:00:00Z')])
    data.look = { ...data.look, ok: false, error: 'iddaa timed out' }
    mount(data)
    expect((await screen.findByText(/Last look at iddaa/)).textContent).toMatch(/failed: iddaa timed out$/)
  })
})

describe('Game picks', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const odds2 = (a: number, b: number) => [
    { side: 'pick' as const, odd: a },
    { side: 'other' as const, odd: b },
  ]
  const mk = (
    market: 'winner' | 'margin' | 'total',
    team: string,
    ours: number,
    book: number,
    odds: { side: 'pick' | 'other' | 'over' | 'under'; odd: number }[],
  ) => ({ market, team, book_team: team, won: '', ours, book, actual: null, gap: ours - book, ours_hit: null, book_hit: null, closer: null, odds })

  it('reads as calm rows: Handicap, Total points, Match result, with our chance as a number and no rings', async () => {
    const g = game(1, 'scheduled', '2099-11-22T22:00:00Z')
    g.markets = [
      mk('winner', 'NY', 0.64, 0.58, odds2(1.3, 3.4)),
      mk('margin', 'NY', 2, 4.5, odds2(1.87, 1.93)),
      mk('total', '', 230, 226.5, [
        { side: 'under', odd: 1.9 },
        { side: 'over', odd: 1.9 },
      ]),
    ]
    mount(night([g]))
    const section = (await screen.findByRole('heading', { level: 2, name: 'Game picks' })).closest('section')!
    expect(section.querySelector('.ic-gp-sm')!.textContent).toBe('2 bets · 1 no bet')
    const rows = [...section.querySelectorAll('.ic-gp-row')]
    expect(rows.map((r) => r.querySelector('.ml')!.textContent)).toEqual(['Handicap', 'Total points', 'Match result'])
    expect(rows[0].querySelector('.bt')!.textContent).toBe('IND +4.5')
    expect(rows[0].querySelector('.bo')!.textContent).toBe('Book NY −4.5 · Ours NY −2')
    expect(rows[1].querySelector('.ic-ch')!.textContent).toBe('51%') // 9 parts the book's even 1.90s, 1 part our 58%
    expect(rows[2].textContent).toContain('Ours NY 64%')
    expect(rows[2].querySelector('.nb')!.textContent).toBe('No betNY odds 1.33 or less')
    // the score is solid, our chance is a number: no hollow digits, no ring buttons or popovers
    expect(section.querySelector('.ic-gp-sc')!.textContent).toContain('Our score')
    expect(section.querySelector('.hollow, .ic-gp-conf, .ic-gp-ring')).toBeNull()
    expect(within(section).queryByRole('button', { name: /What this means/ })).toBeNull()
  })
})
