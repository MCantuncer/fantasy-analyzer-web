import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OddsPlate, TheirSide, TradeTable, Wants } from './TradeTable'

afterEach(cleanup)

describe('TradeTable', () => {
  it('puts the lit end first and the odds after it, and says when it is busy', () => {
    const { container } = render(
      <TradeTable label="Trading for Evan Mobley" lit="get" odds={<span>odds</span>} give="give" get="get" busy announce="Best deal" />,
    )
    const table = container.querySelector('section.tt')!
    expect(table).toHaveAttribute('aria-label', 'Trading for Evan Mobley')
    expect(table).toHaveAttribute('aria-busy', 'true')
    expect([...table.children].map((c) => c.className)).toEqual([
      'tt-end tt-get tt-lit',
      'tt-mid',
      'tt-end tt-give',
      'sr-only',
    ])
    expect(within(container).getByRole('status').textContent).toBe('Best deal')
  })

  it('leads with the odds band before a pick', () => {
    const { container } = render(<TradeTable label="Trade Park" lit="give" oddsFirst odds="odds" give="give" get="get" />)
    const table = container.querySelector('section.tt')!
    expect(table).toHaveClass('tt-odds-first')
    expect(table).not.toHaveAttribute('aria-busy')
    expect(table.firstElementChild).toHaveClass('tt-mid')
    expect(table.children[1]).toHaveClass('tt-give', 'tt-lit')
  })
})

describe('OddsPlate', () => {
  it('shows today with its rank before a deal', () => {
    const { container } = render(<OddsPlate label="Your playoff odds" value={0.54} sub="today · 6th best of 10" />)
    expect(container.textContent).toBe('Your playoff odds54%today · 6th best of 10')
    expect(container.querySelector('.tt-chip')).toBeNull()
  })

  it('shows the odds after a deal with where they came from and a signed chip', () => {
    const { container } = render(
      <OddsPlate label="Your playoff odds" value={0.56} from={0.54} them={{ before: 0.47, after: 0.46 }} status="Updating" />,
    )
    expect(container.querySelector('.tt-plate-from')?.textContent).toBe('from 54%')
    expect(container.querySelector('.tt-chip')).toHaveClass('tt-chip-up')
    expect(container.querySelector('.tt-chip')?.textContent).toBe('▲+2 pts')
    expect(container.querySelector('.tt-plate-them')?.textContent).toBe('Them 47% → 46%')
    expect(container.querySelector('.tt-plate-status')?.textContent).toBe('Updating')
  })

  it('marks a drop with a down arrow and a minus sign', () => {
    const { container } = render(<OddsPlate label="Your odds with him" value={0.534} from={0.542} />)
    expect(container.querySelector('.tt-chip')).toHaveClass('tt-chip-down')
    expect(container.querySelector('.tt-chip')?.textContent).toBe('▼−1 pts')
  })
})

describe('Wants', () => {
  it('shows each category with its weekly win and the teams strong there', () => {
    const { container } = render(
      <Wants
        wants={[
          { category: 'AST', winPct: 0.41, close: true },
          { category: 'REB', winPct: 0.64, close: false },
        ]}
        strong={{ AST: [{ id: 8, name: 'Eryaman Lakers', colour: 'red' }], REB: [] }}
      />,
    )
    const items = container.querySelectorAll('.tt-want')
    expect(items[0]).toHaveClass('tt-want-close')
    expect(items[0].textContent).toBe('ASTClose41%weekly winStrong thereEL: Eryaman Lakers')
    expect(items[1].textContent).toBe('REB64%weekly winNo team strong there')
  })
})

describe('TheirSide', () => {
  it('lays the pitch out as columns with flat facts under it', () => {
    const { container } = render(
      <TheirSide
        partner="Aachen ShowManners"
        pitch="Helps their FG% and REB."
        needs={[
          { category: 'FG%', league_rank: 7, per_game: null },
          { category: 'REB', league_rank: 7, per_game: 2 },
          { category: 'TO', league_rank: 3, per_game: null },
        ]}
        teams={10}
        valueGet={7.5}
        valueGive={7}
        theirCats={-0.02}
        rounds={null}
        actions={<button type="button">Check This Trade</button>}
      />,
    )
    const view = within(container)
    expect(view.getByText('Your pitch to Aachen ShowManners')).toBeInTheDocument()
    expect([...container.querySelectorAll('.tt-pcol')].map((c) => c.textContent)).toEqual([
      'FG%7th of 10Improvestheir field goal %',
      'REB7th of 10+2.0rebounds a game',
      'TO↓turnovers, lower wins3rd of 10Improvestheir turnovers',
    ])
    expect(view.getByRole('button', { name: 'Copy pitch' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Check This Trade' })).toBeInTheDocument()
    expect([...container.querySelectorAll('.tt-facts > div')].map((d) => d.textContent)).toEqual([
      'On paper they get107% of what they send',
      'Their categories a week−0.02',
    ])
    // Their side is theirs: no "good for you" or "bad for you" colour anywhere in it.
    expect(container.querySelector('.good, .bad')).toBeNull()
  })

  it('shows the trade value only when there is no on-paper share to show', () => {
    const { container } = render(
      <TheirSide partner="Aachen ShowManners" pitch="" valueGet={3} valueGive={0} theirCats={0.01} rounds={null} />,
    )
    expect([...container.querySelectorAll('.tt-facts > div')].map((d) => d.textContent)).toEqual([
      'Trade value$3 for $0',
      'Their categories a week+0.01',
    ])
  })
})
