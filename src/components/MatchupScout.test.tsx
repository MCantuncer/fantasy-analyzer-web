import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ManagerStyles } from '../api/client'
import fixture from '../lib/managerStyles.fixture.json'
import { MatchupScoutView } from './MatchupScout'

afterEach(cleanup)

const data = fixture as unknown as ManagerStyles

describe('MatchupScoutView', () => {
  it('folds into one row: who to beat and the plan, opening the rest in place', () => {
    render(<MatchupScoutView data={data} opponentId={10} />)
    const row = screen.getByRole('button', { name: /^How to beat Aachen ShowManners/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('table')).toBeNull()
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('reads the opponent and says the plan', () => {
    render(<MatchupScoutView data={data} opponentId={10} />)
    expect(screen.getByRole('heading', { name: /^How to beat Aachen ShowManners/ })).toBeTruthy()
    expect(screen.getByText('Steady hands')).toBeTruthy()
    expect(screen.getByText('Gives away').parentElement!.textContent).toBe('Gives awayREB BLK TO')
    expect(document.querySelector('.ms-headline')!.textContent).toBe(
      "Hold the four we lead, flip REB and BLK. That's 6–3 if both land.",
    )
  })

  it('tags the flips on the board', () => {
    render(<MatchupScoutView data={data} opponentId={10} />)
    fireEvent.click(screen.getByRole('button', { name: /^How to beat/ }))
    const board = screen.getByRole('table', {
      name: /against Aachen ShowManners/,
    })
    expect(within(board).getByLabelText('BLK: Go after, ±0, 9 · 9, Flip')).toBeTruthy()
    expect(within(board).getByLabelText('TO: Hold, +15, 15 · 30')).toBeTruthy()
    expect(within(board).getAllByText('Flip')).toHaveLength(2)
  })

  it('opens with the flips in the notes and folds the rest', () => {
    render(<MatchupScoutView data={data} opponentId={10} />)
    fireEvent.click(screen.getByRole('button', { name: /^How to beat/ }))
    const notes = screen.getByRole('list', { name: "Scout's notes" })
    expect(within(notes).getByText('They lose REB 4 weeks in 5.')).toBeTruthy()
    expect(within(notes).getByText('They have never won BLK.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    expect(screen.getByText('FT% is theirs 4 weeks in 5.')).toBeTruthy()
  })

  it('stays out of the way when the calls are for another opponent', () => {
    const { container } = render(<MatchupScoutView data={data} opponentId={4} />)
    expect(container.firstChild).toBeNull()
  })
})
