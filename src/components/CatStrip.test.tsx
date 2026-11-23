import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CatStrip } from './CatStrip'

afterEach(cleanup)

describe('CatStrip', () => {
  const changes = { PTS: 0.033, 'FT%': -0.009, REB: 0.002, AST: 0.09, TO: -0.4, 'FG%': 0 }

  it('reads one item per category, in the site order, with signed points', () => {
    const { container } = render(<CatStrip changes={changes} title="What he does for you" summary="+0.07 categories won a week" />)
    const items = within(container).getAllByRole('listitem')
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual([
      'FG% no change',
      'FT% −1 points',
      'REB no change',
      'AST +9 points',
      'TO −40 points',
      'PTS +3 points',
    ])
    expect(container.querySelector('.cs-head')?.textContent).toBe('What he does for you+0.07 categories won a week')
  })

  it('mutes a zero and caps a bar at 28px each way', () => {
    const { container } = render(<CatStrip changes={changes} title="t" />)
    const values = [...container.querySelectorAll('.cs-v')]
    expect(values[0]).toHaveClass('cs-zero')
    expect(values[0].textContent).toBe('0')
    expect(values[3]).toHaveClass('good')
    expect(values[4]).toHaveClass('bad')
    const bars = [...container.querySelectorAll('.cs-bar i')] as HTMLElement[]
    expect(bars.map((b) => b.className)).toEqual(['cs-down', 'cs-up', 'cs-down', 'cs-up'])
    expect(bars[2].style.height).toBe('28px')
    expect(bars[0].style.height).toBe('3px')
  })

  it('gives a column to every category asked for, even one without a change', () => {
    const { container } = render(<CatStrip changes={{ AST: 0.05 }} categories={['PTS', 'AST', 'BLK']} title="t" />)
    expect([...container.querySelectorAll('.cs-c')].map((c) => c.textContent)).toEqual(['AST', 'BLK', 'PTS'])
  })
})
