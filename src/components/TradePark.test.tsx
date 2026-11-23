import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisReport, PlayerRef, ShopReport } from '../api/client'
import * as client from '../api/client'
import { TradePark } from './TradePark'

const player = (id: number, name: string, over: Partial<PlayerRef> = {}) =>
  ({
    id,
    name,
    pro_team: 'CLE',
    positions: ['C'],
    injury_status: 'ACTIVE',
    perceived_value: 10,
    tier: 'tradeable',
    badges: [],
    ...over,
  }) as unknown as PlayerRef

const roster = [
  player(1, 'Jayson Tatum'),
  player(2, 'Kyshawn George'),
  player(3, 'Jarrett Allen'),
  player(4, 'Davion Mitchell'),
  player(5, 'Cam Spencer', { tier: 'droppable' }),
  player(6, 'Paolo Banchero', { injury_status: 'OUT', tier: 'injured' }),
  player(7, 'Christian Braun'),
]

const report = {
  league: { id: 7, season: 2027, name: 'L', categories: [], teams: [], playoff_teams: 2 },
  team_id: 3,
  team_name: 'Mine',
  roster,
  categories: [
    { category: 'AST', win_pct: 0.41, tag: 'swing', league_rank: 8, weekly_projection: 0 },
    { category: 'BLK', win_pct: 0.72, tag: 'locked', league_rank: 2, weekly_projection: 0 },
  ],
  builds: [
    { team_id: 3, team_name: 'Mine', ranks: {}, strong: [], weak: [], expected_cats_won: 4 },
    { team_id: 1, team_name: 'Sariyer Wolfpack', ranks: { REB: 10, STL: 8, AST: 7, PTS: 2 }, strong: [], weak: ['REB'], expected_cats_won: 4 },
    { team_id: 5, team_name: 'Los Avokados', ranks: { BLK: 9, FG: 8, PTS: 1 }, strong: [], weak: [], expected_cats_won: 4 },
  ],
  season: [
    { team_id: 1, team_name: 'Sariyer Wolfpack', current_record: '15-21-0', playoff_pct: 0.62 },
    { team_id: 3, team_name: 'Mine', current_record: '17-19-0', playoff_pct: 0.54 },
    { team_id: 5, team_name: 'Los Avokados', current_record: '22-14-0', playoff_pct: 0.9 },
  ],
  league_rosters: [],
} as unknown as AnalysisReport

function shopReport(offered: PlayerRef[]): ShopReport {
  return {
    team_id: 3,
    team_name: 'Mine',
    offered,
    playoff_pct_before: 0.54,
    faab_remaining: 72,
    faab_cap: 0,
    targets: [],
    deals: [],
    teams: [],
  } as unknown as ShopReport
}

function Host({ keep = [], start = [] }: { keep?: number[]; start?: number[] }) {
  const [picks, setPicks] = useState<number[]>(start)
  return <TradePark report={report} keep={keep} creds={null} picks={picks} onPicks={setPicks} />
}

function setup(props: { keep?: number[]; start?: number[] } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Host {...props} />
    </QueryClientProvider>,
  )
}

let shop: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  shop = vi
    .spyOn(client, 'fetchShop')
    .mockImplementation(async (_l, _t, _s, ids) => shopReport(roster.filter((p) => ids.includes(p.id))))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TradePark, nothing picked', () => {
  it('lays the whole roster in the give end, today on the centre line, and every team low in', () => {
    const { container } = setup({ keep: [2] })
    expect(container.querySelectorAll('.park-row')).toHaveLength(roster.length)
    expect(container.querySelector('.tt-plate')?.textContent).toBe('Your playoff odds54%today · 3rd best of 3')
    expect(screen.getByText('Pick up to 4 · deals load as you pick')).toBeInTheDocument()
    expect([...container.querySelectorAll('.tt-want-c')].map((c) => c.textContent)).toEqual(['ASTClose'])
    const teams = [...container.querySelectorAll('.park-team')].map((t) => t.textContent)
    expect(teams).toEqual(['LALos Avokados22–14–0BLKFG', 'SWSariyer Wolfpack15–21–0STLASTPTS'])
    expect(shop).not.toHaveBeenCalled()
  })

  it('shows status only when it matters and locks a keeper out of the picks', () => {
    const { container } = setup({ keep: [2] })
    const rows = [...container.querySelectorAll('.park-row')]
    expect(rows[0].querySelector('.park-mt')?.textContent).toBe('C · CLE')
    expect(rows[1].textContent).toContain('Keeper')
    expect(screen.queryByRole('button', { name: 'Shop Kyshawn George' })).toBeNull()
    expect(rows[4].textContent).toContain('Droppable')
    expect(rows[5].textContent).toContain('OUT')
  })
})

describe('TradePark, picking', () => {
  it('numbers the picks and runs one search on the sorted ids once they settle', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Shop Davion Mitchell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Shop Jarrett Allen' }))
    expect(screen.getByRole('button', { name: 'Shop Davion Mitchell' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Shop Davion Mitchell' }).textContent).toBe('1')
    expect(screen.getByRole('button', { name: 'Shop Jarrett Allen' }).textContent).toBe('2')
    expect(screen.getByText('Finding deals')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(shop).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(shop).toHaveBeenCalledTimes(1)
    expect(shop.mock.calls[0][3]).toEqual([3, 4])
    expect(await screen.findByText('Deals for Mitchell + Allen are below the table')).toBeInTheDocument()
  })

  it('keeps the last result while a new set settles', async () => {
    setup({ start: [3] })
    await screen.findByText('Deals for Allen are below the table')
    fireEvent.click(screen.getByRole('button', { name: 'Shop Davion Mitchell' }))
    expect(screen.getByText('Showing Allen · updating for Allen + Mitchell')).toBeInTheDocument()
    expect(document.querySelector('.tt')).toHaveAttribute('aria-busy', 'true')
    await act(() => vi.advanceTimersByTimeAsync(710))
    expect(await screen.findByText('Deals for Allen + Mitchell are below the table')).toBeInTheDocument()
  })

  it('starts at once for a player shopped from My Team', async () => {
    setup({ start: [3] })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(shop).toHaveBeenCalledTimes(1)
  })

  it('takes up to four, then marks the rest', () => {
    setup()
    for (const n of ['Jayson Tatum', 'Jarrett Allen', 'Davion Mitchell', 'Cam Spencer'])
      fireEvent.click(screen.getByRole('button', { name: `Shop ${n}` }))
    const braun = screen.getByRole('button', { name: 'Shop Christian Braun' })
    expect(braun).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(braun)
    expect(braun).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('4 of 4')).toBeInTheDocument()
  })

  it('folds the roster into the rail once, when the first result lands, and Add opens it again', async () => {
    const { container } = setup()
    const allen = screen.getByRole('button', { name: 'Shop Jarrett Allen' })
    allen.focus()
    fireEvent.click(allen)
    expect(container.querySelector('.park-rail')).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(710))
    await screen.findByRole('button', { name: 'Stop shopping Jarrett Allen' })
    expect(container.querySelector('.park-page')).toHaveClass('park-folded')
    const add = screen.getByRole('button', { name: 'Add' })
    expect(add).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(add)
    expect(container.querySelector('.park-page')).not.toHaveClass('park-folded')
    // A later result doesn't fold it again.
    fireEvent.click(screen.getByRole('button', { name: 'Shop Davion Mitchell' }))
    await act(() => vi.advanceTimersByTimeAsync(710))
    await screen.findByText('Deals for Allen + Mitchell are below the table')
    expect(container.querySelector('.park-page')).not.toHaveClass('park-folded')
    fireEvent.click(screen.getByRole('button', { name: 'Stop shopping Jarrett Allen' }))
    expect(screen.getByRole('button', { name: 'Shop Jarrett Allen' })).toHaveAttribute('aria-pressed', 'false')
  })
})
