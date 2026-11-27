import { fireEvent, render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CategoryOutlook as Outlook } from '../api/client'
import { CategoryOutlook } from './CategoryOutlook'

const cat = (category: string, win_pct: number, tag: Outlook['tag'], league_rank = 1, weekly_projection = 100) =>
  ({ category, win_pct, tag, league_rank, weekly_projection }) as Outlook

const cats = [
  cat('PTS', 0.27, 'lost', 10, 571),
  cat('FG%', 0.89, 'locked', 1, 0.526),
  cat('REB', 0.65, 'swing', 2, 233),
  cat('AST', 0.41, 'swing', 8, 144),
]

describe('CategoryOutlook', () => {
  it('groups Winning, Swing, Losing in win-chance order, with no legend or dots', () => {
    const { container } = render(<CategoryOutlook categories={cats} />)
    const heads = [...container.querySelectorAll('h3')].map((h) => h.textContent)
    expect(heads).toEqual(['Winning 1upgrades wasted', 'Swing 2where moves help', 'Losing 1likely punts'])
    const rows = [...container.querySelectorAll('.co-row .co-cat')].map((c) => c.textContent)
    expect(rows).toEqual(['FG%', 'REB', 'AST', 'PTS'])
    expect(container.querySelector('.co-legend, .co-dot, .bar-track')).toBeNull()
  })

  it('reads each row as rank, category, win chance and weekly average', () => {
    const { container } = render(<CategoryOutlook categories={cats} />)
    const row = container.querySelector('.co-row')!
    expect(row.textContent).toBe('League rank 1st, FG%, wins 89%, averages .526')
    expect(row.querySelector<HTMLElement>('.co-bar i')!.style.getPropertyValue('--w')).toBe('89%')
  })

  it('opens the help sentence from the bare "?" button', () => {
    const { container } = render(<CategoryOutlook categories={cats} />)
    const screen = within(container)
    const help = screen.getByRole('button', { name: 'What this shows' })
    expect(help).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(help)
    expect(help).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/The line marks 50%/)).toBeInTheDocument()
  })
})
