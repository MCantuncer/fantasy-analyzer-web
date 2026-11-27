import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render as rtlRender, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PickupIdea, ScoreDay } from '../api/client'
import { fetchScores } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { Pickups } from './Pickups'

vi.mock('../api/client', async (orig) => ({ ...(await orig<object>()), fetchScores: vi.fn() }))

// Pickups reads today's games through react-query; without a source it never fetches.
const render = (ui: ReactElement) =>
  rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

const ref = (id: number, name: string) =>
  ({ id, name, positions: ['SF'], percent_owned: 40, injury_status: 'ACTIVE' }) as PickupIdea['add']

const pickup = {
  add: ref(1, 'Miles Bridges'),
  drop: ref(2, 'Aaron Wiggins'),
  open_spot_by_trade: false,
  availability: 'WAIVERS',
  playoff_pct_before: 0.14,
  playoff_pct_after: 0.2,
  category_changes: {},
} as unknown as PickupIdea

describe('Pickups waiver priority', () => {
  it('shows your place in the waiver order in leagues without FAAB', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={null} waiverPriority={2} teams={12} />)
    const view = within(container)
    expect(container.querySelector('.fa-priority .fa-stat-v')?.textContent).toBe('2nd of 12')
    expect(container.querySelector('.fa-priority .fa-stat-k')?.textContent).toBe('Waiver priority')
    fireEvent.click(view.getByRole('button', { expanded: false }))
    expect(view.getByText(/It uses your waiver priority \(2nd\)/)).toBeInTheDocument()
  })

  it('shows FAAB instead when the league bids', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={98} waiverPriority={null} teams={10} />)
    const view = within(container)
    expect(container.querySelector('.fa-faab .fa-stat-v')?.textContent).toBe('$98')
    expect(container.querySelector('.fa-faab .fa-stat-k')?.textContent).toBe('FAAB left')
    expect(view.queryByText(/Waiver priority/)).toBeNull()
  })
})

describe('Pickups shared drop', () => {
  it('names a drop shared by every idea once, above the list', () => {
    const other = { ...pickup, add: ref(3, 'Neemias Queta'), playoff_pct_after: 0.18 } as PickupIdea
    const { container } = render(<Pickups pickups={[pickup, other]} faab={50} />)
    const view = within(container)
    expect(view.getByText(/Each one replaces/)).toHaveClass('sr-only')
    expect(container.querySelector('.pk-shared .pk-shared-swap')).not.toBeNull()
    expect(view.getAllByText('Aaron Wiggins')).toHaveLength(1)
    expect(container.querySelector('.pk-from')?.textContent).toBe(' · from 14%')
  })

  it('opens the shared drop and the names in an opened row on the card', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const other = { ...pickup, add: ref(3, 'Neemias Queta'), playoff_pct_after: 0.18 } as PickupIdea
    const { container } = render(<Pickups pickups={[pickup, other]} faab={50} />)
    const shared = container.querySelector('.pk-shared') as HTMLElement
    expect(shared.querySelector('.pc-link-face .head')).not.toBeNull()
    fireEvent.click(within(shared).getByRole('button', { name: 'Aaron Wiggins' }))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 2 }))
    fireEvent.click(within(container).getAllByRole('button', { expanded: false })[0])
    const reasons = container.querySelector('.move-detail .reasons') as HTMLElement
    fireEvent.click(within(reasons).getByRole('button', { name: 'Aaron Wiggins' }))
    expect(open).toHaveBeenCalledTimes(2)
    act(() => setPlayerCardHost(null))
  })

  it('keeps the drop on each row when the drops differ', () => {
    const other = { ...pickup, add: ref(3, 'Neemias Queta'), drop: ref(4, 'Kris Dunn') } as PickupIdea
    const { container } = render(<Pickups pickups={[pickup, other]} faab={50} />)
    const view = within(container)
    expect(view.queryByText(/Each one replaces/)).toBeNull()
    expect(view.getByText('for Dunn')).toBeInTheDocument()
  })
})

describe('Pickups timing', () => {
  const day = (date: string, add: boolean, drop: boolean) => ({ date, add_plays: add, drop_plays: drop })
  const waiting = {
    ...pickup,
    add: ref(3, 'Brook Lopez'),
    drop: ref(4, 'Georges Niang'),
    availability: 'FREEAGENT',
    timing: {
      wait: true,
      make_on: '2026-11-08',
      next_week: false,
      earliest_on: '2026-11-05',
      cats_now: -0.02,
      cats_best: 0.1,
      drop_games_kept: 2,
      add_games_missed: 0,
      week_changes: {},
      days: [
        day('2026-11-05', false, true),
        day('2026-11-06', false, false),
        day('2026-11-07', false, true),
        day('2026-11-08', true, false),
      ],
    },
  } as unknown as PickupIdea
  const week = {
    opponent_team_id: 4,
    opponent_name: 'Kavaklidere',
    adds_used: 2,
    adds_allowed: 5,
    close_categories: [],
  }

  it('says when waiting pays, with the games it keeps', () => {
    const { container } = render(<Pickups pickups={[waiting]} faab={50} week={week} />)
    expect(container.querySelector('.fa-move')?.textContent).toBe('Add Sunday+2 games with Niang')
    expect(container.querySelector('.fa-row')?.textContent).toContain(
      'Add on Sunday: Niang plays today and Saturday first, so this spot gets 3 games this week instead of 1. Add Lopez Sunday.',
    )
    expect(container.querySelector('.fa-row')?.textContent).not.toContain('..')
  })

  it('shows adds left this week in the header', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={50} week={week} />)
    expect(container.querySelector('.fa-adds .fa-stat-v')?.textContent).toBe('3 of 5')
    expect(container.querySelector('.fa-adds .fa-stat-k')?.textContent).toBe('adds left this week')
    expect(container.querySelector('.fa-move')?.textContent).toBe('Claim nowfor Wiggins')
  })
})

describe('Pickups fold', () => {
  const many = Array.from(
    { length: 7 },
    (_, i) => ({ ...pickup, add: ref(10 + i, `Free Agent ${i + 1}`) }) as PickupIdea,
  )

  it('opens on the best five and shows the rest on request', () => {
    const { container } = render(<Pickups pickups={many} faab={50} />)
    const view = within(container)
    expect(container.querySelectorAll('.fa-item')).toHaveLength(5)
    expect(view.queryByText('Free Agent 6')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Show all 7' }))
    expect(container.querySelectorAll('.fa-item')).toHaveLength(7)
    expect(container.textContent).toContain('Free Agent 7')
    fireEvent.click(view.getByRole('button', { name: 'Show top 5' }))
    expect(container.querySelectorAll('.fa-item')).toHaveLength(5)
  })

  it('has no fold when five or fewer ideas fit as they are', () => {
    const { container } = render(<Pickups pickups={many.slice(0, 5)} faab={50} />)
    expect(container.querySelectorAll('.fa-item')).toHaveLength(5)
    expect(within(container).queryByRole('button', { name: /Show all/ })).toBeNull()
  })

  it('names a drop once when the rows in view share it, even if a folded row differs', () => {
    const odd = { ...pickup, add: ref(30, 'Odd One'), drop: ref(31, 'Kris Dunn') } as PickupIdea
    const { container } = render(<Pickups pickups={[...many.slice(0, 5), odd]} faab={50} />)
    const view = within(container)
    expect(view.getByText(/Each one replaces/)).toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { name: 'Show all 6' }))
    expect(view.queryByText(/Each one replaces/)).toBeNull()
    expect(view.getByText('for Dunn')).toBeInTheDocument()
  })
})

describe('Pickups name', () => {
  const named = (name: string, extra: object = {}) => ({ ...pickup, add: { ...ref(40, name), ...extra } }) as PickupIdea

  it('holds the durability mark and a suffix to the last name', () => {
    const p = named('Robert Williams III', { injury_prone: true, games_share: 0.65 })
    const { container } = render(<Pickups pickups={[p]} faab={50} />)
    const end = container.querySelector('.fa-name-end')
    expect(end?.textContent).toBe('Williams III65')
    expect(end?.querySelector('.dur-chip')).not.toBeNull()
    expect(container.querySelector('.fa-name')?.textContent).toBe('Add Robert Williams III65')
  })

  it('keeps the injury tag with the last word', () => {
    const p = named('Nickeil Alexander-Walker', { injury_status: 'DAY_TO_DAY' })
    const { container } = render(<Pickups pickups={[p]} faab={50} />)
    expect(container.querySelector('.fa-name-end')?.textContent).toMatch(/^Alexander-Walker\u2060?DTD$/)
  })
})

describe('Pickups today', () => {
  const side = (abbrev: string) => ({ pro_team_id: 0, abbrev, name: abbrev, score: null })
  const day = (n: number, date: string, games: object[]) =>
    ({ day: n, date, games, days: [{ day: 26 }, { day: 27 }], week: [], live: false }) as unknown as ScoreDay

  it('says whether he plays today, stepping past a finished night', async () => {
    const lakers = { ...pickup, add: { ...ref(5, 'Ziaire Williams'), pro_team: 'LAL' } } as PickupIdea
    vi.mocked(fetchScores).mockImplementation(async (_l, _s, d) =>
      d === null
        ? day(26, '2026-11-14', [
            { id: 1, start: '2026-11-15T00:00:00Z', status: 'final', away: side('LAL'), home: side('BOS'), lines: [] },
          ])
        : day(27, '2026-11-15', [
            {
              id: 2,
              start: '2026-11-16T00:30:00Z',
              status: 'scheduled',
              away: side('DEN'),
              home: side('LAL'),
              lines: [],
            },
          ]),
    )
    const { container, findByText } = render(
      <Pickups pickups={[lakers]} faab={50} today={{ leagueId: 1, season: 2027, teamId: 3, creds: null }} />,
    )
    expect(await findByText('vs DEN', { exact: false })).toBeInTheDocument()
    expect(container.querySelector('.fa-day')?.textContent).toMatch(/^Plays (tonight|today) vs DEN · /)
    expect(vi.mocked(fetchScores)).toHaveBeenCalledWith(1, 2027, 27, 3, null)
  })
})

describe('Pickups hot run', () => {
  const run = {
    verdict: 'straw_fire',
    games: 6,
    gap: 8.5,
    minutes_part: 0.5,
    production_part: 4,
    shooting_part: 4,
    likely_kept: 0.22,
    minutes_usual: 21.5,
    minutes_recent: 24.2,
    pts_usual: 9.1,
    pts_recent: 15.6,
    fg_usual: 0.39,
    fg_recent: 0.54,
  }
  const hot = { ...pickup, add: { ...ref(5, 'Nolan Traore'), hot_run: run } } as PickupIdea

  it('adds one quiet line to a hot row and one sentence for screen readers', () => {
    const { container } = render(<Pickups pickups={[hot]} faab={50} />)
    expect(container.querySelector('.hr-line')?.textContent).toBe('Straw fireshooting 39 → 54%')
    expect(container.querySelector('.hr-line')).toHaveAttribute('aria-hidden', 'true')
    expect(within(container).getByText(/Straw fire\. Shooting 54% against his usual 39%, minutes 22 to 24\./)).toBeInTheDocument()
  })

  it('leaves a row without a hot run exactly as it was', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={50} />)
    expect(container.querySelector('.hr-line')).toBeNull()
  })

  it('explains the run once the row opens, and says the odds already count it', () => {
    const { container } = render(<Pickups pickups={[hot]} faab={50} />)
    fireEvent.click(within(container).getByRole('button', { expanded: false }))
    const story = container.querySelector('.hr-story')!
    expect(story.textContent).toContain('About a fifth of it should last')
    expect(story.textContent).toContain('His odds number already counts this.')
    expect([...story.querySelectorAll('.hr-label')].map((e) => e.textContent)).toEqual(['Shooting', 'Per 10 minutes'])
  })
})

describe('Pickups rows (Quiet Lead)', () => {
  it('numbers the rows and leads with the after-odds over the ▲ delta', () => {
    const other = { ...pickup, add: ref(3, 'Neemias Queta'), playoff_pct_after: 0.18 } as PickupIdea
    const { container } = render(<Pickups pickups={[pickup, other]} faab={50} />)
    expect([...container.querySelectorAll('.fa-rk')].map((e) => e.textContent)).toEqual(['1', '2'])
    expect(container.querySelector('.fa-after')?.textContent).toBe('20%')
    expect(container.querySelector('.fa-delta')?.textContent).toBe('▲+6 pts')
    expect(container.querySelector('.fa-odds .sr-only')?.textContent).toBe('Details. Playoff odds 14% to 20%')
  })

  it('makes the verb a link to the ESPN add page, its reason under it', () => {
    const { container } = render(
      <Pickups pickups={[pickup]} faab={50} today={{ leagueId: 77, season: 2027, teamId: 3, creds: null }} />,
    )
    const link = within(container).getByRole('link', { name: 'Claim now Miles Bridges on ESPN, for Wiggins' })
    expect(link).toHaveAttribute('href', 'https://fantasy.espn.com/basketball/players/add?leagueId=77')
    expect(link).toHaveAttribute('target', '_blank')
    expect(container.querySelector('.fa-why')?.textContent).toBe('for Wiggins')
  })

  it("opens the player's card from the name and the face, and the details from the odds", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = render(<Pickups pickups={[pickup]} faab={50} />)
    fireEvent.click(within(container.querySelector('.fa-name') as HTMLElement).getByRole('button'))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 1 }))
    expect(container.querySelector('.fa-face .pc-link-face .head')).not.toBeNull()
    const toggle = container.querySelector('.fa-odds') as HTMLElement
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(container.querySelector('.fa-item.open .move-detail')).not.toBeNull()
    act(() => setPlayerCardHost(null))
  })

  it('says so in one quiet line when no free agent helps', () => {
    const { container } = render(<Pickups pickups={[]} faab={50} />)
    expect(container.querySelector('.fa-empty')?.textContent).toBe('No free agent improves your team right now.')
  })
})
