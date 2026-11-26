import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TradeIdea } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { PlayerCardHost } from './PlayerCard'
import { TradeItem, Trades } from './Trades'

const ref = (id: number, name: string) =>
  ({ id, name, positions: ['SF'], percent_owned: 40, injury_status: 'ACTIVE' }) as TradeIdea['give'][number]

const idea = {
  partner_team_id: 7,
  partner_team_name: 'Aliaga Hermanos',
  give: [ref(1, 'Davion Mitchell')],
  get: [ref(2, 'Jaylen Brown')],
  playoff_pct_before: 0.51,
  playoff_pct_after: 0.55,
  partner_playoff_pct_before: 0.89,
  partner_playoff_pct_after: 0.88,
  acceptance: 0.33,
  acceptance_label: 'possible',
  value_they_get: 15,
  value_they_give: 13,
  reasons: [],
  facts: [],
  warnings: [],
  category_changes: {},
} as unknown as TradeIdea

const show = (ui: ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

describe('Trades', () => {
  afterEach(cleanup)

  it('folds to the Bold list, with no switch, when no trade helps both teams', () => {
    const { container } = show(<Trades fair={[]} edge={[idea]} />)
    const view = within(container)
    expect(view.queryByRole('group', { name: 'Trade style' })).toBeNull()
    expect(view.getByText(/these are Bold ideas: they win on paper/)).toBeInTheDocument()
    expect(container.querySelectorAll('.move-list > li')).toHaveLength(1)
  })

  it('puts how the partner plays in a quiet line under their name', () => {
    const { container } = show(
      <Trades fair={[idea]} edge={[]} partnerStyles={new Map([[7, 'Door closed · declined 2, never traded']])} />,
    )
    expect(container.querySelector('.tr-style')?.textContent).toBe('Door closed · declined 2, never traded')
  })

  it('folds to one line when there is no trade of either style', () => {
    const { container } = show(<Trades fair={[]} edge={[]} />)
    const view = within(container)
    expect(view.queryByRole('group', { name: 'Trade style' })).toBeNull()
    expect(view.getByText(/No trade worth offering right now/)).toBeInTheDocument()
    expect(view.queryByText(/Ranked by expected gain/)).toBeNull()
    expect(view.queryByText(/The Bold tab has deals/)).toBeNull()
  })

  it('names the kept players above the list, with the way to change them', () => {
    const onEditKeep = vi.fn()
    const { container } = show(
      <Trades
        fair={[idea]}
        edge={[]}
        kept={[ref(5, 'Kyshawn George'), ref(6, 'Jayson Tatum')]}
        onEditKeep={onEditKeep}
      />,
    )
    const view = within(container)
    expect(container.querySelector('.trades-kept')).toHaveTextContent('Always kept: Kyshawn George, Jayson Tatum.')
    fireEvent.click(view.getByRole('button', { name: 'Change in My Team' }))
    expect(onEditKeep).toHaveBeenCalledOnce()
  })

  it('opens the card from each kept name, each with a small face', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = show(<Trades fair={[idea]} edge={[]} kept={[ref(5, 'Kyshawn George'), ref(6, 'Jayson Tatum')]} />)
    const line = container.querySelector('.trades-kept') as HTMLElement
    expect(line).toHaveTextContent('Always kept: Kyshawn George, Jayson Tatum.')
    expect(line.querySelectorAll('.pin .head')).toHaveLength(2)
    // The comma and the full stop stay on the line of the name they follow.
    expect([...line.querySelectorAll('.pin')].map((p) => p.textContent)).toEqual(['Kyshawn George,', 'Jayson Tatum.'])
    fireEvent.click(within(line).getByRole('button', { name: 'Jayson Tatum' }))
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 6 }))
    act(() => setPlayerCardHost(null))
  })

  it('opens on Fair when a trade helps both teams', () => {
    const { container } = show(<Trades fair={[idea]} edge={[idea]} />)
    const view = within(container)
    expect(view.getByRole('button', { name: 'Fair · 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(view.getByRole('button', { name: 'Bold · 1' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the accept chance as a word, never as a percentage', () => {
    const { container } = show(<Trades fair={[idea]} edge={[]} />)
    const accept = container.querySelector('.tr-accept')
    expect(accept).toHaveTextContent('chance they accept, Possible')
    expect(accept).not.toHaveTextContent('%')
  })

  it('prints the number the list is ranked by on each row', () => {
    const { container } = show(<Trades fair={[idea]} edge={[]} />)
    const view = within(container)
    expect(view.getByText(/Ranked by expected gain: your gain times the chance they say yes/)).toBeInTheDocument()
    // 33% of +4 points.
    expect(container.querySelector('.tr-exp')).toHaveTextContent('Expected gain+1.3, plus 1.3 playoff odds points')
  })
})

function OneTrade({ trade }: { trade: TradeIdea }) {
  const [open, setOpen] = useState(false)
  return (
    <ul>
      <TradeItem trade={trade} id="t1" open={open} onToggle={() => setOpen((o) => !o)} why="Why" />
    </ul>
  )
}

describe('TradeItem', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('opens player cards from the names in the offer once the trade is open', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    show(
      <>
        <OneTrade trade={{ ...idea, my_drop: ref(3, 'Kris Dunn') }} />
        <PlayerCardHost leagueRef={{ leagueId: 1, season: 2027 }} creds={null} teams={[]} myTeamId={3} />
      </>,
    )
    // Closed: the names are plain text and the whole row is one Details toggle.
    expect(screen.queryByRole('button', { name: 'Jaylen Brown' })).toBeNull()
    const toggle = screen.getByRole('button', { name: /^Details of the trade with Aliaga Hermanos/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Open: no separate chip list, the offer's own names (and the drop) open the card.
    expect(screen.queryByRole('region', { name: 'Players in this deal' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Davion Mitchell' })).toBeInTheDocument()
    const dunn = screen.getByRole('button', { name: 'Kris Dunn' })
    // The drop has no face in the lanes, so his line carries a small one.
    expect(dunn.closest('.pin')?.querySelector('.pc-link-face .head')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Jaylen Brown' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('offers "Keep him" beside the players you give once the trade is open', () => {
    const onToggleKeep = vi.fn()
    const row = (keep: number[]) => (
      <ul>
        <TradeItem trade={idea} id="t1" open onToggle={() => {}} why="Why" keeper={{ keep, onToggleKeep }} />
      </ul>
    )
    const view = show(row([]))
    // Only your side: nobody keeps a player they would receive.
    expect(screen.queryByRole('button', { name: 'Keep Jaylen Brown out of trades' })).toBeNull()
    const keepHim = screen.getByRole('button', { name: 'Keep Davion Mitchell out of trades' })
    expect(keepHim).toHaveTextContent('Keep him')
    fireEvent.click(keepHim)
    expect(onToggleKeep).toHaveBeenCalledWith(1)
    view.rerender(<QueryClientProvider client={new QueryClient()}>{row([1])}</QueryClientProvider>)
    const kept = screen.getByRole('button', { name: 'Davion Mitchell is kept out of trades' })
    expect(kept).toHaveTextContent('Kept')
    expect(kept).toHaveAttribute('aria-pressed', 'true')
  })

  it('dims an offer that gives a player you just kept, and says why', () => {
    const row = (keep: number[]) => (
      <ul>
        <TradeItem trade={idea} id="t1" open={false} onToggle={() => {}} why="Why" keeper={{ keep, onToggleKeep: () => {} }} />
      </ul>
    )
    const view = show(row([]))
    expect(view.container.querySelector('.move')).not.toHaveClass('tr-stale')
    expect(screen.queryByText(/is kept$/)).toBeNull()
    // Keeping a player you would only receive changes nothing.
    view.rerender(<QueryClientProvider client={new QueryClient()}>{row([2])}</QueryClientProvider>)
    expect(view.container.querySelector('.move')).not.toHaveClass('tr-stale')
    view.rerender(<QueryClientProvider client={new QueryClient()}>{row([1])}</QueryClientProvider>)
    expect(view.container.querySelector('.move')).toHaveClass('tr-stale')
    expect(screen.getByText('Davion Mitchell is kept')).toBeInTheDocument()
  })

  it('leaves "Keep him" out of a closed row and of lists without a Keep list', () => {
    show(
      <ul>
        <TradeItem trade={idea} id="t1" open={false} onToggle={() => {}} why="Why" keeper={{ keep: [], onToggleKeep: () => {} }} />
        <TradeItem trade={idea} id="t2" open onToggle={() => {}} why="Why" />
      </ul>,
    )
    expect(screen.queryByText('Keep him')).toBeNull()
  })
})
