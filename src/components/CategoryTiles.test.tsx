import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CategoryOutlook } from '../api/client'
import { CategoryTiles } from './CategoryTiles'

const cat = (category: string, win_pct: number, league_rank: number, tag: CategoryOutlook['tag']) =>
  ({ category, win_pct, league_rank, tag }) as CategoryOutlook

describe('CategoryTiles', () => {
  const cats = [
    cat('PTS', 0.27, 10, 'lost'),
    cat('TO', 0.71, 1, 'locked'),
    cat('FG%', 0.89, 1, 'locked'),
    cat('REB', 0.65, 2, 'swing'),
  ]

  it("draws one cell per category in ESPN's order, each with its state word", () => {
    const { container } = render(<CategoryTiles categories={cats} />)
    const cells = [...container.querySelectorAll('.mvcat-line > li')]
    expect(cells.map((c) => c.querySelector('.mvcat-code')?.textContent)).toEqual(['FG%', 'REB', 'TO', 'PTS'])
    expect(cells.map((c) => c.querySelector('.mvcat-word')?.textContent)).toEqual(['Winning', 'Swing', 'Winning', 'Losing'])
    expect(cells[0].className).toContain('mvcat-good')
    expect(cells[1].className).toContain('mvcat-swing')
    expect(cells[3].className).toContain('mvcat-bad')
    expect(cells[0].querySelector('.mvcat-pct')?.textContent).toBe('89%')
    expect(cells[0].querySelector('.mvcat-rank')?.textContent).toBe('1st')
  })

  it('reads each cell as one sentence', () => {
    const { container } = render(<CategoryTiles categories={cats} />)
    const cells = container.querySelectorAll('.mvcat-line > li')
    expect(cells[0].getAttribute('aria-label')).toBe('FG%: wins 89% of weeks, 1st in the league, Winning')
    expect(cells[2].getAttribute('aria-label')).toBe('TO (lower is better): wins 71% of weeks, 1st in the league, Winning')
  })

  it('has no tally line beside the heading: the cells carry the words', () => {
    const { container } = render(<CategoryTiles categories={cats} scout="Hammer" />)
    expect(container.querySelector('h2')?.textContent).toBe('How often Hammer wins each category')
    expect(container.querySelector('.mvcat-note')).toBeNull()
  })
})
