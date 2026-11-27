import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { StripSide } from '../lib/catStrip'
import { CatStrip, CatStripPair } from './CatStrip'

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
    // Numbers stay in ink with their sign: the bar carries the colour.
    expect(values[3].className).toBe('cs-v num')
    expect(values[3].textContent).toBe('+9')
    expect(values[4].textContent).toBe('−40')
    const bars = [...container.querySelectorAll('.cs-bar i')] as HTMLElement[]
    expect(bars.map((b) => b.className)).toEqual(['cs-down', 'cs-up', 'cs-down', 'cs-up'])
    expect(bars[2].style.height).toBe('28px')
    expect(bars[0].style.height).toBe('3px')
  })

  it('gives a column to every category asked for, even one without a change', () => {
    const { container } = render(<CatStrip changes={{ AST: 0.05 }} categories={['PTS', 'AST', 'BLK']} title="t" />)
    expect([...container.querySelectorAll('.cs-c')].map((c) => c.textContent)).toEqual(['AST', 'BLK', 'PTS'])
  })

  it('labels turnovers TO↓, the way its bar is drawn', () => {
    const { container } = render(<CatStrip changes={changes} title="t" />)
    expect([...container.querySelectorAll('.cs-c')].map((c) => c.textContent)).toContain('TO↓')
  })
})

describe('CatStripPair', () => {
  const CATS = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
  const vals = (xs: number[]) => CATS.map((stat, i) => ({ stat, value: xs[i] }))
  const a: StripSide = {
    id: 3,
    name: 'Kucukesat Aspavas',
    short: 'You',
    colour: 'var(--gold)',
    today: vals([0.5, 1, 1, 6, 5, 1, 0, 3, 21]),
    week: vals([0.509, 0.744, 60, 225, 134, 37, 25, 62, 539]),
  }
  const b: StripSide = {
    id: 7,
    name: 'Çayyolu Bastards',
    short: 'Bastards',
    today: vals([0.429, 1, 5, 30, 16, 5, 0, 5, 53]),
    week: vals([0.476, 0.746, 82, 181, 144, 37, 11, 69, 669]),
  }

  it('reads one labelled item per category and keys the rows', () => {
    const { getByRole } = render(<CatStripPair a={a} b={b} top="today" sub="week" mine="a" label="Today's categories" />)
    const list = getByRole('list', { name: "Today's categories" })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(9)
    expect(items[0]).toHaveAccessibleName('FG%: you .500, Bastards .429, you lead. Week .509 to .476')
    expect(list.querySelector('.cs-key')?.textContent).toBe('KAYouthis weekwkÇBBastardsthis weekwk')
    const labels = [...list.querySelectorAll('.cs-pl')].map((l) => l.lastChild?.textContent)
    expect(labels).toEqual(['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO↓', 'PTS'])
  })

  it('points the bar at the leader: green for you, coral for them, a dash for a tie', () => {
    const { container } = render(<CatStripPair a={a} b={b} top="today" sub="week" mine="a" label="t" />)
    const bars = [...container.querySelectorAll('.cs-pb i')].map((i) => i.className)
    expect(bars).toEqual([
      'cs-pup cs-help',
      'cs-tie',
      'cs-pdn cs-hurt',
      'cs-pdn cs-hurt',
      'cs-pdn cs-hurt',
      'cs-pdn cs-hurt',
      'cs-tie',
      'cs-pup cs-help',
      'cs-pdn cs-hurt',
    ])
    // A close category says so in a word over its label, not with an icon.
    const close = [...container.querySelectorAll('.cs-pl.cs-close')].map((l) => l.textContent)
    expect(close).toEqual(['CloseFT%', 'CloseAST', 'CloseSTL', 'CloseTO↓'])
    expect(container.querySelectorAll('.cs-close-word')).toHaveLength(4)
    expect(container.querySelector('.cs-pl:not(.cs-close) .cs-close-word, .cs-pl svg')).toBeNull()
    expect(container.querySelector('.cs-pair')).toHaveClass('cs-hasclose')
    expect(container.querySelectorAll('.cs-pv.cs-w')).toHaveLength(7)
  })

  it("keeps bars neutral when neither side is you, and drops the sub row and key when asked", () => {
    const { container } = render(
      <CatStripPair a={{ ...a, short: 'Aspavas' }} b={b} top="week" mine={null} keyed={false} label="t" />,
    )
    expect(container.querySelector('.cs-key')).toBeNull()
    expect(container.querySelector('.cs-pk')).toBeNull()
    expect(container.querySelector('.cs-pair')).toHaveClass('cs-one', 'cs-nokey')
    const tones = [...container.querySelectorAll('.cs-pb i:not(.cs-tie)')].map((i) => i.classList[1])
    expect(new Set(tones)).toEqual(new Set(['cs-neu']))
    expect(within(container).getAllByRole('listitem')[0]).toHaveAccessibleName('FG%: Aspavas .509, Bastards .476, Aspavas lead')
  })
})
