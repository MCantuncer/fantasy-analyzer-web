import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { CompareGame } from '../lib/iddaaCompare'
import { quarterBets } from '../lib/quarterBets.fixture'
import { QuarterBets, QuarterRecordStrip } from './QuarterBets'

const game = (settled: boolean): CompareGame => ({
  game_id: 401,
  away: 'MIL',
  home: 'PHI',
  tip: '2026-11-24T00:00:00Z',
  checked: '',
  status: settled ? 'final' : 'scheduled',
  away_score: settled ? 105 : null,
  home_score: settled ? 116 : null,
  markets: [],
  players: [],
  quarters: quarterBets(settled),
})

afterEach(cleanup)

describe('QuarterBets', () => {
  it('shows only the bets with value up front, with what the price needs', () => {
    render(<QuarterBets g={game(false)} />)
    const slips = screen.getByRole('list', { name: 'MIL @ PHI quarter bets with value' })
    const rows = within(slips).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('1st quarter winner')
    expect(rows[0]).toHaveTextContent('Value +0.06')
    expect(rows[0]).toHaveTextContent('needs 63%')
    expect(rows[1]).toHaveTextContent('PHI −3.5')
    expect(screen.getByText('Watch only, not in Kupons yet')).toBeInTheDocument()
  })

  it('opens every quarter bet in a grid, and settles each one', () => {
    render(<QuarterBets g={game(true)} />)
    const fold = screen.getByRole('button', { name: /All quarter bets/ })
    expect(fold).toHaveTextContent('4 of 4 right')
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('No line').length).toBeGreaterThan(0)
    expect(screen.getByText(/No bet · odds 1.33 or less/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('Won').length).toBe(4)
    expect(screen.getAllByText('Won').length).toBe(2) // the two edge slips
  })

  it('says so when a game has no quarter bet with value, and nothing without quarter bets', () => {
    const flat = {
      ...game(false),
      quarters: quarterBets(false).map((b) => ({
        ...b,
        edge: -0.1,
        sides: b.sides.map((s) => ({ ...s, value: -0.1 })),
      })),
    }
    const { container, rerender } = render(<QuarterBets g={flat} />)
    expect(screen.getByText('No quarter bet with value in this game')).toBeInTheDocument()
    rerender(<QuarterBets g={{ ...flat, quarters: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the running record, and nothing before a pick settles', () => {
    const sums = (bets: number, won: number, returned: number) => ({ bets, won, ours: 0.55, book: 0.5, returned })
    const { container, rerender } = render(
      <QuarterRecordStrip rec={{ all: sums(39, 22, -1.9), edge: sums(6, 5, 2.5), by_market: {} }} />,
    )
    expect(container).toHaveTextContent('All 39: won 22, −1.90')
    expect(container).toHaveTextContent('With value 6: won 5, +2.50')
    rerender(<QuarterRecordStrip rec={{ all: sums(0, 0, 0), edge: sums(0, 0, 0), by_market: {} }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
