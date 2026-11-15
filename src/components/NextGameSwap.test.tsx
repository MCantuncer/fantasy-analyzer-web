import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PickupIdea } from '../api/client'
import { better, lineCells } from '../lib/nextGame'
import { setPlayerCardHost } from '../lib/playerCard'
import { NextGameSwap } from './NextGameSwap'

type Line = NonNullable<PickupIdea['add']['next_game']>

// League A, 2026-11-15 (brief + Addendum): Daniss Jenkins and Aday Mara, the drop.
const jenkins: Line = {
  minutes: 30.4, pts: 15.1, reb: 3.6, ast: 5.6, stl: 1.3, blk: 0.2, three_pm: 2.2, to: 1.9,
  fgm: 5.2, fga: 12.4, ftm: 2.6, fta: 3, fg_pct: 0.42, ft_pct: 0.851,
}
const mara: Line = {
  minutes: 24.0, pts: 9.4, reb: 6.5, ast: 1.5, stl: 0.1, blk: 1.9, three_pm: 0.1, to: 1.7,
  fgm: 3.6, fga: 5.8, ftm: 1.4, fta: 2.4, fg_pct: 0.62, ft_pct: 0.591,
}
const ref = (id: number, name: string, next: Line | null) =>
  ({ id, name, positions: ['G'], percent_owned: 5, injury_status: 'ACTIVE', next_game: next }) as PickupIdea['add']

const cells = (el: Element) => [...el.querySelectorAll('.ng-nums td')]
const nums = (el: Element) => cells(el).map((td) => td.textContent)
const wins = (el: Element) => cells(el).map((td) => (td.hasAttribute('data-win') ? 'B' : '-'))

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

describe('next game line', () => {
  it('is one number per stat in the site column order, percentages the box-score way', () => {
    expect(lineCells(jenkins).map((c) => `${c.key} ${c.text}`)).toEqual([
      'MIN 30', 'FG% .420', 'FT% .851', '3PM 2', 'REB 4', 'AST 6', 'STL 1', 'BLK 0', 'TO 2', 'PTS 15',
    ])
    expect(lineCells({ ...jenkins, ft_pct: null }).find((c) => c.key === 'FT%')?.text).toBe('–')
  })

  it('compares the numbers as shown: fewer turnovers win, minutes and ties are never marked', () => {
    expect(better('TO', 1, 2)).toBe('add')
    expect(better('PTS', 15, 9)).toBe('add')
    expect(better('STL', 1, 1)).toBeNull()
    expect(better('MIN', 30, 24)).toBeNull()
  })

  it('puts his line over the drop line, bolds only the better number', () => {
    const { container } = render(<NextGameSwap add={ref(1, 'Daniss Jenkins', jenkins)} drop={ref(2, 'Aday Mara', mara)} />)
    const [add, drop, extra] = container.querySelectorAll('tbody')
    expect(nums(add)).toEqual(['30', '.420', '.851', '2', '4', '6', '1', '0', '2', '15'])
    expect(nums(drop)).toEqual(['24', '.620', '.591', '0', '7', '2', '0', '2', '2', '9'])
    expect(wins(add)).toEqual(['-', '-', 'B', 'B', '-', 'B', 'B', '-', '-', 'B'])
    expect(wins(drop)).toEqual(['-', 'B', '-', '-', 'B', '-', '-', 'B', '-', '-'])
    expect(extra).toBeUndefined() // no swing row
    expect(container.textContent).toContain('A usual night, not a promise')
    expect(container.textContent).not.toMatch(/\d\s*[-–]\s*\d/) // never a range
  })

  it('marks add and drop with an icon only, with words for screen readers', () => {
    const { container, getByRole } = render(
      <NextGameSwap add={ref(1, 'Daniss Jenkins', jenkins)} drop={ref(2, 'Aday Mara', mara)} />,
    )
    expect(getByRole('img', { name: 'You add' })).toBeTruthy()
    expect(getByRole('img', { name: 'You drop' })).toBeTruthy()
    expect(container.textContent).not.toMatch(/you (add|drop)/i)
  })

  it('opens the player card from each name, as the chips did', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { getByRole } = render(<NextGameSwap add={ref(1, 'Daniss Jenkins', jenkins)} drop={ref(2, 'Aday Mara', mara)} />)
    fireEvent.click(getByRole('button', { name: /Aday Mara/ }))
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }))
  })

  it('says the drop has no line while he is out, and shows nothing while the add is out', () => {
    const { container } = render(<NextGameSwap add={ref(1, 'Daniss Jenkins', jenkins)} drop={ref(2, 'Aday Mara', null)} />)
    expect(container.querySelector('.ng-out')?.textContent).toBe('Listed out: no line for his next game')
    expect(container.querySelector('[data-win]')).toBeNull()
    const none = render(<NextGameSwap add={ref(1, 'Daniss Jenkins', null)} drop={ref(2, 'Aday Mara', mara)} />)
    expect(none.container.innerHTML).toBe('')
  })

  it('says "This game" while his game is on', () => {
    const { container } = render(
      <NextGameSwap add={ref(1, 'Daniss Jenkins', jenkins)} drop={ref(2, 'Aday Mara', mara)} live />,
    )
    expect(container.querySelector('.ng-head')?.textContent).toBe('This game')
  })
})
