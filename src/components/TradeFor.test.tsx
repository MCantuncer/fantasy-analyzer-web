import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisReport, PlayerRef, TargetOffer, TargetReport } from '../api/client'
import * as client from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { TradeFor } from './TradeFor'

const player = (id: number, name: string, over: Partial<PlayerRef> = {}) =>
  ({
    id,
    name,
    pro_team: 'BOS',
    positions: ['SF', 'PF'],
    injury_status: 'ACTIVE',
    perceived_value: 10,
    tier: 'tradeable',
    badges: [],
    ...over,
  }) as unknown as PlayerRef

const mobley = player(21, 'Evan Mobley', { pro_team: 'CLE', positions: ['PF', 'C'], perceived_value: 19 })
const sga = player(22, 'Shai Gilgeous-Alexander', { pro_team: 'OKC', perceived_value: 61 })
const murray = player(23, 'Jamal Murray', { pro_team: 'DEN', perceived_value: 49 })
const jokic = player(31, 'Nikola Jokic', { pro_team: 'DEN', perceived_value: 66 })

const report = {
  league: {
    id: 7,
    season: 2027,
    name: 'L',
    categories: ['FG%', 'AST', 'REB'],
    teams: [{ id: 1 }, { id: 3 }, { id: 5 }],
    playoff_teams: 2,
  },
  team_id: 3,
  team_name: 'Mine',
  roster: [
    player(1, 'Jayson Tatum', { perceived_value: 43 }),
    player(2, 'Giannis Antetokounmpo', { perceived_value: 42, injury_status: 'OUT', tier: 'injured' }),
    player(3, 'Kyshawn George', { perceived_value: 12 }),
    player(4, 'Cam Spencer', { perceived_value: 12, tier: 'droppable' }),
  ],
  categories: [
    { category: 'AST', win_pct: 0.41, tag: 'swing', league_rank: 8, weekly_projection: 0 },
    { category: 'REB', win_pct: 0.64, tag: 'swing', league_rank: 2, weekly_projection: 0 },
    { category: 'FG%', win_pct: 0.9, tag: 'locked', league_rank: 1, weekly_projection: 0 },
  ],
  builds: [
    { team_id: 1, team_name: 'Sariyer Wolfpack', ranks: { AST: 1 }, strong: ['AST'], weak: [], expected_cats_won: 4 },
    { team_id: 5, team_name: 'Antalya Apaches', ranks: { REB: 2 }, strong: ['REB'], weak: [], expected_cats_won: 4 },
  ],
  season: [
    { team_id: 1, team_name: 'Sariyer Wolfpack', current_record: '15-21-0', playoff_pct: 0.62 },
    { team_id: 3, team_name: 'Mine', current_record: '17-19-0', playoff_pct: 0.54 },
    { team_id: 5, team_name: 'Antalya Apaches', current_record: '15-20-1', playoff_pct: 0.45 },
  ],
  league_rosters: [
    {
      team_id: 1,
      team_name: 'Sariyer Wolfpack',
      players: [
        { player: mobley, my_cats_gain: 0.07 },
        { player: sga, my_cats_gain: 0.3 },
        { player: murray, my_cats_gain: 0.26 },
      ],
    },
    { team_id: 5, team_name: 'Antalya Apaches', players: [{ player: jokic, my_cats_gain: 0.51 }] },
  ],
} as unknown as AnalysisReport

const offer = {
  partner_team_id: 1,
  partner_team_name: 'Sariyer Wolfpack',
  give: [player(1, 'Jayson Tatum')],
  get: [mobley],
  my_drop: player(4, 'Cam Spencer'),
  angle: 'best',
  angle_note: '',
  acceptance: 0.11,
  acceptance_label: 'possible',
  playoff_pct_before: 0.54,
  playoff_pct_after: 0.56,
  partner_playoff_pct_before: 0.62,
  partner_playoff_pct_after: 0.61,
  pitch: 'Helps their AST.',
  pitch_needs: [{ category: 'AST', league_rank: 7, per_game: 2.1 }],
  value_they_get: 43,
  value_they_give: 19,
  their_cats_gain: 0.1,
} as unknown as TargetOffer

function targetReport(offers: TargetOffer[]): TargetReport {
  return {
    team_id: 3,
    team_name: 'Mine',
    target: mobley,
    fit: {
      label: 'small',
      my_cats_gain: 0.07,
      my_drop: player(9, 'Neemias Queta'),
      helps: [],
      hurts: [],
      playoff_pct_before: 0.54,
      playoff_pct_after: 0.53,
      category_changes: { AST: 0.03, REB: 0, 'FG%': -0.01 },
    },
    owner: {
      team_id: 1,
      team_name: 'Sariyer Wolfpack',
      record: '15-21-0',
      build: { team_id: 1, team_name: 'Sariyer Wolfpack', ranks: {}, strong: ['TO'], weak: [], expected_cats_won: 4 },
      punts: [],
      needs: ['REB', 'STL', 'AST'],
      playoff_pct: 0.62,
      outside_playoffs: true,
      target_is_star: false,
      would_value: [
        { player: player(1, 'Jayson Tatum'), their_cats_gain: 0.19, helps: ['AST', 'PTS'] },
        { player: player(3, 'Kyshawn George'), their_cats_gain: 0.03, helps: ['AST'] },
      ],
    },
    offers,
    note: null,
    generated_at: '',
    elapsed_ms: 1,
  } as unknown as TargetReport
}

function setup(keep: number[] = []) {
  const onCheck = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <TradeFor report={report} keep={keep} creds={null} onCheck={onCheck} />
    </QueryClientProvider>,
  )
  return { ...view, onCheck }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  setPlayerCardHost(null)
})

describe('TradeFor, nothing picked', () => {
  it('shows today on the centre line, the best fits with labelled columns, and what your build wants', () => {
    const { container } = setup([3])
    expect(container.querySelector('.tt-plate')?.textContent).toBe('Your playoff odds54%today · 2nd best of 3')
    expect(screen.getByText('Cats a week')).toBeInTheDocument()
    const fits = [...container.querySelectorAll('button.tf-fit .tf-nm')].map((n) => n.textContent)
    expect(fits).toEqual(['Nikola Jokic', 'Shai Gilgeous-Alexander', 'Jamal Murray', 'Evan Mobley'])
    expect([...container.querySelectorAll('.tt-want-c')].map((c) => c.textContent)).toEqual(['ASTClose', 'REB'])
    expect(container.querySelector('.tt-want')?.textContent).toContain('Strong there')
  })

  it('pays with your most valued players, no droppables, keepers locked', () => {
    const { container } = setup([3])
    const rows = [...container.querySelectorAll('.tf-pay')]
    expect(rows.map((r) => r.querySelector('.tf-nm')?.textContent)).toEqual([
      'Jayson Tatum',
      'Giannis Antetokounmpo',
      'Kyshawn George',
    ])
    expect(rows[1].textContent).toContain('OUT')
    expect(rows[2].textContent).toContain('Keeper')
    // The lock and "Keeper" say it; the sentence under the list is gone, the rule sits in the tag's title.
    expect(rows[2].querySelector('.tt-status')).toHaveAttribute('title', 'Never goes in an offer')
    expect(screen.queryByText(/Keepers never go in an offer/)).toBeNull()
  })

  it('searches players and teams', () => {
    const { container } = setup()
    fireEvent.change(screen.getByLabelText('Search players or teams'), { target: { value: 'apaches' } })
    expect([...container.querySelectorAll('button.tf-fit .tf-nm')].map((n) => n.textContent)).toEqual(['Nikola Jokic'])
    expect(screen.getByText('1 found')).toBeInTheDocument()
  })
})

describe('TradeFor, a player picked', () => {
  it('shows his card at once, then his owner, the honest empty block and Check pre-fills', async () => {
    vi.spyOn(client, 'fetchTarget').mockResolvedValue(targetReport([]))
    const { container, onCheck } = setup([3])
    fireEvent.click(screen.getByRole('button', { name: /Evan Mobley/ }))
    expect(container.querySelector('.tf-card-nm')?.textContent).toBe('Evan Mobley')
    expect(container.querySelector('.tt-plate-status')?.textContent).toBe('Building offers')

    await screen.findByText('No offer to send')
    expect(container.querySelector('.tt-plate')?.textContent).toBe(
      'Your odds with him53%from 54%▼−1 ptsCeiling: he comes free, Neemias Queta goes',
    )
    expect(container.querySelector('.tf-partner-mt')?.textContent).toBe(
      '15–21–0 · 62% playoff odds · outside the playoff spots',
    )
    expect([...container.querySelectorAll('.tf-facts > div')].map((d) => d.textContent)).toEqual([
      'NeedsREBSTLAST',
      'Strong inTO',
      'PuntsNothing',
    ])
    expect(screen.getByText('0 of 3 offers')).toBeInTheDocument()
    expect(within(container).getAllByRole('listitem', { name: /points|no change/ })).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Check a Trade With Them' }))
    expect(onCheck).toHaveBeenLastCalledWith({ partner: 1, give: [], get: [21], mode: 'sending', cut: null })
    fireEvent.click(screen.getByRole('button', { name: 'Check Tatum for Mobley' }))
    expect(onCheck).toHaveBeenLastCalledWith({ partner: 1, give: [1], get: [21], mode: 'sending', cut: null })
    // A keeper is never offered.
    expect(screen.queryByRole('button', { name: 'Check George for Mobley' })).toBeNull()
    expect(screen.getByText('Not offered')).toBeInTheDocument()
  })

  it('puts the selected offer on the table with its pitch and Check This Trade', async () => {
    vi.spyOn(client, 'fetchTarget').mockResolvedValue(targetReport([offer]))
    const { container, onCheck } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Evan Mobley/ }))
    await screen.findByText('Your pitch to Sariyer Wolfpack')
    expect(container.querySelector('button.tf-offer')).toHaveAttribute('aria-current', 'true')
    expect(container.querySelector('.tt-plate-them')?.textContent).toBe('Them 62% → 61%')
    expect(within(container).getByRole('status').textContent).toBe('Best offer: Tatum for Mobley, odds 54 to 56')
    fireEvent.click(screen.getByRole('button', { name: 'Check This Trade' }))
    expect(onCheck).toHaveBeenLastCalledWith({ partner: 1, give: [1], get: [21], mode: 'sending', cut: 4 })
  })

  it("shows the opened offer's players as chips, and links the ceiling's drop", async () => {
    vi.spyOn(client, 'fetchTarget').mockResolvedValue(targetReport([offer]))
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Evan Mobley/ }))
    const chips = await screen.findByRole('region', { name: 'Players in this deal' })
    expect(container.querySelector('.tf-offer-open')).toContainElement(chips)
    expect(chips.querySelectorAll('.head')).toHaveLength(3)
    fireEvent.click(within(chips).getByRole('button', { name: 'Cam Spencer' }))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 4 }))
  })

  it("links the ceiling's drop on the centre line when there is no offer", async () => {
    vi.spyOn(client, 'fetchTarget').mockResolvedValue(targetReport([]))
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Evan Mobley/ }))
    await screen.findByText('No offer to send')
    const note = container.querySelector('.tt-plate-note') as HTMLElement
    expect(note).toHaveTextContent('Ceiling: he comes free, Neemias Queta goes')
    expect(note.querySelector('.pc-link-face .head')).not.toBeNull()
    fireEvent.click(within(note).getByRole('button', { name: 'Neemias Queta' }))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 9 }))
    // "No package for Evan Mobley": his name opens his card too.
    const block = container.querySelector('.tf-block') as HTMLElement
    fireEvent.click(within(block).getByRole('button', { name: 'Evan Mobley' }))
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ id: 21 }))
  })

  it('offers his teammates in the foot, and clears back to the fits', async () => {
    vi.spyOn(client, 'fetchTarget').mockResolvedValue(targetReport([]))
    const { container } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Evan Mobley/ }))
    expect(screen.getByText('Also on Sariyer Wolfpack')).toBeInTheDocument()
    expect([...container.querySelectorAll('.tf-also button.tf-fit .tf-nm')].map((n) => n.textContent)).toEqual([
      'Shai Gilgeous-Alexander',
      'Jamal Murray',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Clear Evan Mobley' }))
    expect(screen.getByText('Best fits for your build')).toBeInTheDocument()
  })

  it('keeps the table and offers Try Again when the search fails', async () => {
    vi.spyOn(client, 'fetchTarget').mockRejectedValue(new Error('The server took too long to answer.'))
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Evan Mobley/ }))
    await screen.findByText("Couldn't build offers")
    expect(screen.getByText('The server took too long to answer.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })
})
