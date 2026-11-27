import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TradeIdea } from '../api/client'
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
  my_cats_gain: 0.13,
  their_cats_gain: -0.03,
  pitch: 'Helps their FT% (5th in the league).',
  pitch_needs: [{ category: 'FT%', league_rank: 5, per_game: null }],
  owner_premium: 0,
  reasons: [],
  facts: [],
  warnings: [],
  category_changes: { REB: 0.09, AST: -0.04 },
} as unknown as TradeIdea

const show = (ui: ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

describe('Trades', () => {
  afterEach(cleanup)

  it('folds to the Bold list, with no switch, when no trade is fair', () => {
    const { container } = show(<Trades fair={[]} edge={[idea]} />)
    const view = within(container)
    expect(view.queryByRole('group', { name: 'Trade style' })).toBeNull()
    expect(view.getByText('No fair trade raises your playoff odds today.')).toBeInTheDocument()
    expect(view.queryByText(/they win on paper/)).toBeNull()
    expect(container.querySelectorAll('.mvt-list > li')).toHaveLength(1)
  })

  it('puts how the partner plays in a quiet line under their name', () => {
    const { container } = show(
      <Trades fair={[idea]} edge={[]} partnerStyles={new Map([[7, 'Door closed · declined 2, never traded']])} />,
    )
    expect(container.querySelector('.mvt-style')?.textContent).toBe('Door closed · declined 2, never traded')
  })

  it('folds to one line when there is no trade of either style', () => {
    const { container } = show(<Trades fair={[]} edge={[]} />)
    const view = within(container)
    expect(view.queryByRole('group', { name: 'Trade style' })).toBeNull()
    expect(view.getByText(/No trade worth offering right now/)).toBeInTheDocument()
    expect(view.queryByText(/Ranked by expected gain/)).toBeNull()
    expect(view.queryByText(/The Bold tab has deals/)).toBeNull()
  })

  it('puts the untouchable line at the top of the list', () => {
    const { container } = show(<Trades fair={[idea]} edge={[]} untouchable={<p data-part="untouchable" />} />)
    const panel = container.querySelector('.trades-panel') as HTMLElement
    expect(panel.querySelector('[data-part="untouchable"]')).not.toBeNull()
    expect(container.querySelector('.trades-kept')).toBeNull()
    expect(container.textContent).not.toContain('Change in My Team')
  })

  it('opens on Fair when there is a fair trade', () => {
    const { container } = show(<Trades fair={[idea]} edge={[idea]} />)
    const view = within(container)
    expect(view.getByRole('button', { name: 'Fair 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(view.getByRole('button', { name: 'Bold 1' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the accept chance as a word, never as a percentage', () => {
    const { container } = show(<Trades fair={[idea]} edge={[]} />)
    const accept = container.querySelector('.mvt-accept')
    expect(accept).toHaveTextContent('chance they accept, Possible')
    expect(accept).not.toHaveTextContent('%')
  })

  it('prints the number the list is ranked by on each row', () => {
    const { container } = show(<Trades fair={[idea]} edge={[]} />)
    const view = within(container)
    expect(view.queryByText(/Ranked by expected gain/)).toBeNull()
    // 33% of +4 points.
    expect(container.querySelector('.mvt-exp')).toHaveTextContent('Expected gain+1.3, plus 1.3 playoff odds points')
  })
})

function OneTrade({ trade }: { trade: TradeIdea }) {
  const [open, setOpen] = useState(false)
  return (
    <ul>
      <TradeItem trade={trade} id="t1" open={open} onToggle={() => setOpen((o) => !o)} />
    </ul>
  )
}

describe('TradeItem', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('opens player cards from the names in the offer, closed or open', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    show(
      <>
        <OneTrade trade={{ ...idea, my_drop: ref(3, 'Kris Dunn') }} />
        <PlayerCardHost leagueRef={{ leagueId: 1, season: 2027 }} creds={null} teams={[]} myTeamId={3} />
      </>,
    )
    // Closed: every name already opens the card; the rest of the row is one Show details toggle.
    expect(screen.getByRole('button', { name: 'Jaylen Brown' })).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: /^Show details of the trade with Aliaga Hermanos/ })
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

  it('offers a Keep lock beside the players you give once the trade is open', () => {
    const onToggleKeep = vi.fn()
    const row = (keep: number[]) => (
      <ul>
        <TradeItem trade={idea} id="t1" open onToggle={() => {}} keeper={{ keep, onToggleKeep }} />
      </ul>
    )
    const view = show(row([]))
    // Only your side: nobody keeps a player they would receive.
    expect(screen.queryByRole('button', { name: 'Keep Jaylen Brown out of trades' })).toBeNull()
    const keepHim = screen.getByRole('button', { name: 'Keep Davion Mitchell out of trades' })
    expect(keepHim).toHaveAttribute('title', 'Keep him')
    expect(document.querySelector('.mvt-keep-k')).toHaveTextContent('Keep')
    fireEvent.click(keepHim)
    expect(onToggleKeep).toHaveBeenCalledWith(1)
    view.rerender(<QueryClientProvider client={new QueryClient()}>{row([1])}</QueryClientProvider>)
    const kept = screen.getByRole('button', { name: 'Davion Mitchell is kept out of trades' })
    expect(kept).toHaveAttribute('title', 'Kept')
    expect(kept).toHaveAttribute('aria-pressed', 'true')
  })

  it('dims an offer that gives a player you just kept, and says why', () => {
    const row = (keep: number[]) => (
      <ul>
        <TradeItem trade={idea} id="t1" open={false} onToggle={() => {}} keeper={{ keep, onToggleKeep: () => {} }} />
      </ul>
    )
    const view = show(row([]))
    expect(view.container.querySelector('.mvt-item')).not.toHaveClass('mvt-kept')
    expect(screen.queryByText(/is kept$/)).toBeNull()
    // Keeping a player you would only receive changes nothing.
    view.rerender(<QueryClientProvider client={new QueryClient()}>{row([2])}</QueryClientProvider>)
    expect(view.container.querySelector('.mvt-item')).not.toHaveClass('mvt-kept')
    view.rerender(<QueryClientProvider client={new QueryClient()}>{row([1])}</QueryClientProvider>)
    expect(view.container.querySelector('.mvt-item')).toHaveClass('mvt-kept')
    expect(screen.getByText('Davion Mitchell is kept')).toBeInTheDocument()
  })

  it('leaves the Keep locks out of a closed row and of lists without a Keep list', () => {
    show(
      <ul>
        <TradeItem trade={idea} id="t1" open={false} onToggle={() => {}} keeper={{ keep: [], onToggleKeep: () => {} }} />
        <TradeItem trade={idea} id="t2" open onToggle={() => {}} />
      </ul>,
    )
    expect(screen.queryByRole('button', { name: /^Keep / })).toBeNull()
    expect(document.querySelector('.mvt-keep-k')).toBeNull()
  })

  it('numbers the rows and starts them all closed', () => {
    const second = { ...idea, partner_team_id: 8, partner_team_name: 'Kartal' } as TradeIdea
    const { container } = show(<Trades fair={[idea, second]} edge={[]} />)
    const rows = [...container.querySelectorAll('.mvt-list > li')]
    expect(rows.map((r) => r.querySelector('.mvt-rank')?.textContent)).toEqual(['1', '2'])
    expect(container.querySelectorAll('.mvt-item.open')).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: /^Show details/ })[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('puts Playoffs on the centre line: the after-odds, the bar with a tick at today, ▲N and theirs in ink', () => {
    const { container } = show(<Trades fair={[idea]} edge={[]} />)
    const odds = container.querySelector('.mvt-deal .plo') as HTMLElement
    expect(odds.querySelector('.plo-k')).toHaveTextContent('Playoffs')
    expect(odds.querySelector('.plo-big')).toHaveTextContent('55%')
    expect(odds.querySelector('.plo-line .sr-only')).toHaveTextContent('55%, from 51%, up 4 points.')
    expect(odds.querySelector('.cd-bar')).toHaveClass('cd-up')
    expect(odds.querySelector('.plo-d')).toHaveClass('plo-help')
    expect(odds.querySelector('.plo-d')?.textContent).toBe('▲4')
    expect(odds.querySelector('.plo-them [aria-hidden]')?.textContent).toBe('Them 89% → 88% ▼1')
    expect(odds.querySelector('.plo-them .sr-only')).toHaveTextContent('Their playoff odds 89% to 88%, down 1.')
  })

  it('opens to their side of the deal, the weekly strip and the notes, and checks the trade as one you send', () => {
    const onCheck = vi.fn()
    const trade = {
      ...idea,
      give: [ref(1, 'Davion Mitchell'), ref(4, 'Aday Mara')],
      my_add: ref(5, 'Paul Reed'),
      their_drop: ref(6, 'Klay Thompson'),
      facts: [
        { kind: 'paper_win', tone: 'for', text: 'On paper they win.', ratio: 1.38 },
        { kind: 'sell_high', tone: 'for', text: 'Sell high', player_id: 1, player_name: 'Davion Mitchell', owners_value: 13, our_value: 3 },
        { kind: 'roster_squeeze', tone: 'against', text: 'They have to cut a player.', count: 1 },
        { kind: 'vs_pickup', tone: 'note', text: 'Measured against just adding Paul Reed.', player_id: 5, player_name: 'Paul Reed' },
      ],
    } as unknown as TradeIdea
    const { container } = show(
      <ul>
        <TradeItem
          trade={trade}
          id="t1"
          open
          onToggle={() => {}}
          categories={['REB', 'AST']}
          pickups={[{ add: ref(5, 'Paul Reed'), drop: ref(9, 'Neemias Queta') } as never]}
          onCheck={onCheck}
        />
      </ul>,
    )
    // The pitch and their side, flat: the sell-high fact names the player and both prices.
    expect(screen.getByRole('heading', { name: 'Your pitch to Aliaga Hermanos' })).toBeInTheDocument()
    const facts = container.querySelector('.tt-facts') as HTMLElement
    expect(facts).toHaveTextContent('Sell high on Davion Mitchell$13 paid · $3 worth')
    expect(facts).toHaveTextContent('Roster squeeze1 player they cut')
    // The paper win is the "On paper" row, never a second one.
    expect(facts.textContent?.match(/On paper/g)).toHaveLength(1)
    // The strip and its summary.
    expect(container.querySelector('.cs-sum')).toHaveTextContent('+0.13 categories won a week')
    expect(screen.getByRole('listitem', { name: 'REB +9 points' })).toBeInTheDocument()
    // Notes: each player named opens the card, and the measured-against line names the drop too.
    const notes = container.querySelector('.mvt-notes') as HTMLElement
    expect(notes).toHaveTextContent('Pick up Paul Reed for the open spot. The odds include him.')
    expect(notes).toHaveTextContent('Odds vs. just adding Paul Reed for Neemias Queta')
    expect(notes).not.toHaveTextContent('count only what the trade adds')
    expect(notes).toHaveTextContent('They would likely drop Klay Thompson.')
    expect(notes).toHaveTextContent('A roster squeeze deal is accepted about half as often as a 1-for-1.')
    expect(within(notes).getByText('Neemias Queta').closest('.pin')?.querySelector('.head')).not.toBeNull()
    expect(container.querySelector('.pc-rt, .rt, .impact')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Check This Trade' }))
    expect(onCheck).toHaveBeenCalledWith({ partner: 7, give: [1, 4], get: [2], mode: 'sending', cut: null })
  })

  it('leaves Check This Trade out where there is no Check a Trade to open', () => {
    show(
      <ul>
        <TradeItem trade={idea} id="t1" open onToggle={() => {}} />
      </ul>,
    )
    expect(screen.getByRole('button', { name: 'Copy pitch' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check This Trade' })).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})
