import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { AnalysisReport, PlayerRef, ShopDeal, ShopReport } from '../api/client'
import * as client from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
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

const deal = (give: PlayerRef[], get: PlayerRef[], over: Partial<ShopDeal> = {}) =>
  ({
    partner_team_id: 1,
    partner_team_name: 'Sariyer Wolfpack',
    give,
    get,
    my_cats_gain: 0.05,
    their_cats_gain: -0.02,
    edge: 0,
    value_they_get: 7.5,
    value_they_give: 7,
    owner_premium: 0,
    acceptance: 0.5,
    acceptance_label: 'possible',
    pitch: 'Helps their REB (7th in the league), +2.0 a game.',
    reasons: [],
    pitch_needs: [{ category: 'REB', league_rank: 7, per_game: 2 }],
    playoff_pct_before: 0.54,
    playoff_pct_after: 0.56,
    partner_playoff_pct_before: 0.47,
    partner_playoff_pct_after: 0.46,
    category_changes: { AST: 0.09, REB: -0.05 },
    kind: 'win_win',
    uses_all: false,
    faab: 0,
    target_gain: 0.1,
    ...over,
  }) as ShopDeal

const ausar = player(91, 'Ausar Thompson', { pro_team: 'DET', positions: ['SF', 'PF'], perceived_value: 7 })
const herro = player(92, 'Tyler Herro', { pro_team: 'MIA', positions: ['SG'], perceived_value: 20 })

/** Allen + Mitchell: one deal with Sariyer (Allen for Thompson), a second (Allen + Mitchell for Herro) with Los
 * Avokados, a team whose deals pass the checks but give no lift, and two teams with nothing. */
function richReport(offered: PlayerRef[]): ShopReport {
  const best = deal([roster[2]], [ausar])
  const both = deal([roster[2], roster[3]], [herro], {
    partner_team_id: 5,
    partner_team_name: 'Los Avokados',
    acceptance_label: 'long_shot',
    playoff_pct_after: 0.55,
    uses_all: true,
    faab: 3,
  })
  return {
    ...shopReport(offered),
    faab_cap: 7,
    targets: [
      { category: 'AST', win_pct: 0.41, reason: 'swing' },
      { category: 'REB', win_pct: 0.64, reason: 'swing' },
    ],
    deals: [best, both],
    teams: [
      { team_id: 1, team_name: 'Sariyer Wolfpack', record: '15-21-0', deals_found: 3, best },
      { team_id: 5, team_name: 'Los Avokados', record: '22-14-0', deals_found: 2, best: both },
      { team_id: 8, team_name: 'Aliaga Hermanos', record: '15-20-1', deals_found: 1, best: null },
      { team_id: 9, team_name: 'Kartal Bulls', record: '10-26-0', deals_found: 0, best: null },
      { team_id: 10, team_name: 'Eagles', record: '9-27-0', deals_found: 0, best: null },
    ],
  } as unknown as ShopReport
}

const onCheck = vi.fn()

function Host({ keep = [], start = [] }: { keep?: number[]; start?: number[] }) {
  const [picks, setPicks] = useState<number[]>(start)
  return <TradePark report={report} keep={keep} creds={null} picks={picks} onPicks={setPicks} onCheck={onCheck} />
}

function setup(props: { keep?: number[]; start?: number[] } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Host {...props} />
    </QueryClientProvider>,
  )
}

let shop: MockInstance<typeof client.fetchShop>

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
  setPlayerCardHost(null)
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
    expect(await screen.findByText('No deal for Allen + Mitchell', { selector: '.park-block-h2' })).toBeInTheDocument()
  })

  it('keeps the last result while a new set settles', async () => {
    setup({ start: [3] })
    await screen.findByText('No deal for Allen', { selector: '.park-block-h2' })
    fireEvent.click(screen.getByRole('button', { name: 'Shop Davion Mitchell' }))
    expect(screen.getByText('Showing Allen · updating for Allen + Mitchell')).toBeInTheDocument()
    expect(document.querySelector('.tt')).toHaveAttribute('aria-busy', 'true')
    await act(() => vi.advanceTimersByTimeAsync(710))
    expect(await screen.findByText('No deal for Allen + Mitchell', { selector: '.park-block-h2' })).toBeInTheDocument()
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

  it("opens a picked player's card from his chip in the rail", async () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Shop Jarrett Allen' }))
    await act(() => vi.advanceTimersByTimeAsync(710))
    await screen.findByRole('button', { name: 'Stop shopping Jarrett Allen' })
    const chip = container.querySelector('.park-chip') as HTMLElement
    expect(chip.querySelector('button.pc-link-face .head')).not.toBeNull()
    fireEvent.click(within(chip).getByRole('button', { name: 'Allen' }))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 3 }))
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
    // The chip's face and last name open his card (a plain name outside a league).
    expect(container.querySelector('.park-chip')?.textContent).toBe('Allen')
    const add = screen.getByRole('button', { name: 'Add' })
    expect(add).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(add)
    expect(container.querySelector('.park-page')).not.toHaveClass('park-folded')
    // A later result doesn't fold it again.
    fireEvent.click(screen.getByRole('button', { name: 'Shop Davion Mitchell' }))
    await act(() => vi.advanceTimersByTimeAsync(710))
    await screen.findByText('No deal for Allen + Mitchell', { selector: '.park-block-h2' })
    expect(container.querySelector('.park-page')).not.toHaveClass('park-folded')
    fireEvent.click(screen.getByRole('button', { name: 'Stop shopping Jarrett Allen' }))
    expect(screen.getByRole('button', { name: 'Shop Jarrett Allen' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('TradePark, the deal on the table', () => {
  beforeEach(() => {
    onCheck.mockClear()
    shop.mockImplementation(async (_l, _t, _s, ids) => richReport(roster.filter((p) => ids.includes(p.id))))
  })

  async function picked() {
    const view = setup({ start: [3, 4] })
    await screen.findByText('Chance they say yes')
    return view
  }

  it('puts the best deal on the table: odds on the centre line, your side marked, theirs in the get end', async () => {
    const { container } = await picked()
    expect(container.querySelector('.tt-plate')?.textContent).toBe('Your playoff odds56%from 54%▲+2 ptsThem 47% → 46%')
    expect(container.querySelector('.park-accept')?.textContent).toBe('PossibleChance they say yes')
    expect(container.querySelector('.park-partner')?.textContent).toBe('SWSariyer Wolfpack15–21–0 · best deal, 1 of 2')
    expect(container.querySelector('.park-get .park-card')?.textContent).toBe('Ausar ThompsonSF/PF · DET · $7 trade value')
    const inDeal = [...container.querySelectorAll('.park-row.park-in')]
    expect(inDeal).toHaveLength(1)
    expect(inDeal[0].textContent).toContain('Jarrett Allen')
    expect(inDeal[0].textContent).toContain('In this deal')
    expect(screen.getByText('Your pitch to Sariyer Wolfpack')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy pitch' })).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toBe('Best deal: Allen for Thompson, odds 54 to 56')
  })

  it('opens Check This Trade filled in and sending', async () => {
    await picked()
    fireEvent.click(screen.getByRole('button', { name: 'Check This Trade' }))
    expect(onCheck).toHaveBeenCalledWith({ partner: 1, give: [3], get: [91], mode: 'sending', cut: null })
  })

  it('carries your strip, what the search aimed at and the FAAB line in the foot', async () => {
    const { container } = await picked()
    const foot = container.querySelector('.park-foot')!
    expect(within(foot as HTMLElement).getByText('Your weekly win chance')).toBeInTheDocument()
    expect(within(foot as HTMLElement).getByRole('listitem', { name: 'AST +9 points' })).toBeInTheDocument()
    expect(foot.querySelector('.park-sum')?.textContent).toBe('+0.05')
    expect(foot.querySelector('.park-aim-foot')?.textContent).toBe('Aimed at AST 41% · REB 64% weekly win')
    expect(foot.textContent).toContain('Up to $7 of your $72 FAAB can sweeten a deal')
  })

  it('lists every team: deal rows by team, the filter, the muted no-lift row and the fold', async () => {
    const { container } = await picked()
    const rows = [...container.querySelectorAll('button.park-drow')]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute('aria-current', 'true')
    expect(rows[0].textContent).toContain('On the table')
    expect(rows[1]).not.toHaveAttribute('aria-current')
    expect(rows[1].textContent).toContain('Allen + Mitchell')
    expect(rows[1].textContent).toContain('+ $3 FAAB')
    const filter = screen.getByRole('group', { name: 'Show deals with' })
    expect([...filter.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'All2',
      'Both Go1',
      'Allen2',
      'Mitchell1',
    ])
    const dim = container.querySelector('.park-drow.park-dim')!
    expect(dim.textContent).toBe('Allen or Mitchell1 deal passes the checks54%no lift for youAHAliaga Hermanos15–20–1')
    expect(screen.getByText('2 teams: no deal that works for both')).toBeInTheDocument()
    const show = screen.getByRole('button', { name: 'Show' })
    expect(show).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(show)
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Kartal Bulls')).toBeInTheDocument()
  })

  it('opens the card from the no-lift row, its faces and the shopped names', async () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = await picked()
    const dim = container.querySelector('.park-drow.park-dim') as HTMLElement
    expect(dim.querySelectorAll('.head-stack button.pc-link-face .head')).toHaveLength(2)
    fireEvent.click(within(dim).getByRole('button', { name: 'Mitchell' }))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 4 }))
    fireEvent.click(within(container.querySelector('.park-who-label') as HTMLElement).getByRole('button', { name: 'Allen' }))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 3 }))
  })

  it('filters the rows client-side', async () => {
    const { container } = await picked()
    fireEvent.click(screen.getByRole('button', { name: /^Both Go/ }))
    let rows = [...container.querySelectorAll('button.park-drow')]
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Tyler Herro')
    fireEvent.click(screen.getByRole('button', { name: /^Mitchell/ }))
    rows = [...container.querySelectorAll('button.park-drow')]
    expect(rows).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /^All ?2$/ }))
    expect(container.querySelectorAll('button.park-drow')).toHaveLength(2)
  })

  it('puts a tapped row on the table', async () => {
    const { container } = await picked()
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    fireEvent.click(container.querySelectorAll('button.park-drow')[1])
    expect(container.querySelector('.tt-plate')?.textContent).toContain('55%')
    expect(container.querySelector('.park-accept')?.textContent).toBe('Long shotChance they say yes')
    expect(container.querySelector('.park-partner')?.textContent).toContain('deal, 2 of 2')
    expect(container.querySelectorAll('.park-row.park-in')).toHaveLength(2)
    expect(container.querySelectorAll('button.park-drow')[1]).toHaveAttribute('aria-current', 'true')
    expect(container.querySelector('.park-foot')?.textContent).toContain('This deal adds $3 of your $72 FAAB')
    expect(screen.getByRole('status').textContent).toBe('On the table: Allen + Mitchell for Herro, odds 54 to 55')
    scroll.mockRestore()
  })
})

describe('TradePark, no deal and errors', () => {
  beforeEach(() => onCheck.mockClear())

  it('says so plainly, with Add a Player and Check a Trade', async () => {
    const { container } = setup({ start: [4] })
    await screen.findByText('No deal for Mitchell', { selector: '.park-block-h2' })
    expect(container.querySelector('.tt-plate')?.textContent).toBe('Your playoff odds54%no deal yet')
    expect(screen.getByText('All 0 rosters checked. None looks like a win for them and helps you.')).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toBe('No deal for Mitchell')
    fireEvent.click(screen.getByRole('button', { name: 'Check a Trade' }))
    expect(onCheck).toHaveBeenCalledWith(expect.objectContaining({ partner: null, give: [], get: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a Player' }))
    expect(container.querySelector('.park-page')).not.toHaveClass('park-folded')
  })

  it('shows the API message and Try Again when the first search fails', async () => {
    shop.mockRejectedValueOnce(new Error('The server took too long to answer.'))
    const { container } = setup({ start: [3] })
    expect(await screen.findByText("Couldn't search trades")).toBeInTheDocument()
    expect(screen.getByText('The server took too long to answer.')).toBeInTheDocument()
    expect(container.querySelector('.tt-plate')?.textContent).toBe('Your playoff odds54%today')
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(await screen.findByText('No deal for Allen', { selector: '.park-block-h2' })).toBeInTheDocument()
  })

  it('keeps a result on screen when the next search fails, with one status line', async () => {
    shop.mockImplementation(async (_l, _t, _s, ids) => {
      if (ids.includes(4)) throw new Error('Timed out')
      return richReport(roster.filter((p) => ids.includes(p.id)))
    })
    const { container } = setup({ start: [3] })
    await screen.findByText('Chance they say yes')
    fireEvent.click(screen.getByRole('button', { name: 'Shop Davion Mitchell' }))
    await act(() => vi.advanceTimersByTimeAsync(710))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't update for Allen + Mitchell. Timed out")
    expect(container.querySelector('.park-get .park-card')?.textContent).toContain('Ausar Thompson')
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })
})
