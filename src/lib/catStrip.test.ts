import { describe, expect, it } from 'vitest'
import { barShare, pairCells, pairFigure, pairLabel, rankBar, stripCategories, type StripSide } from './catStrip'

const CATS = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
const vals = (xs: number[]) => CATS.map((stat, i) => ({ stat, value: xs[i] }))

// Kucukesat Aspavas vs Çayyolu Bastards, Sun Nov 22 12:29 AM (the League final's snapshot).
const ka: StripSide = {
  id: 3,
  name: 'Kucukesat Aspavas',
  short: 'You',
  today: vals([0.5, 1, 1, 6, 5, 1, 0, 3, 21]),
  week: vals([0.509, 0.744, 60, 225, 134, 37, 25, 62, 539]),
}
const cb: StripSide = {
  id: 7,
  name: 'Çayyolu Bastards',
  short: 'Bastards',
  today: vals([0.429, 1, 5, 30, 16, 5, 0, 5, 53]),
  week: vals([0.476, 0.746, 82, 181, 144, 37, 11, 69, 669]),
}

describe('pairCells', () => {
  it("gives today's leaders as the score reads them: 2–5–2", () => {
    const cells = pairCells(ka, cb, { top: 'today', sub: 'week' })
    expect(cells.map((c) => c.stat)).toEqual(CATS)
    const count = (l: string) => cells.filter((c) => c.leader === l).length
    expect([count('a'), count('b'), count('tie')]).toEqual([2, 5, 2])
    expect(cells.filter((c) => c.leader === 'a').map((c) => c.stat)).toEqual(['FG%', 'TO'])
    expect(cells.find((c) => c.stat === 'BLK')?.leader).toBe('tie')
  })

  it('marks the week-close categories, whichever figures are on top', () => {
    const close = (top: 'today' | 'week') =>
      pairCells(ka, cb, { top })
        .filter((c) => c.close)
        .map((c) => c.stat)
    expect(close('today')).toEqual(['FT%', 'AST', 'STL', 'TO'])
    expect(close('week')).toEqual(['FT%', 'AST', 'STL', 'TO'])
  })

  it('carries the week under today, with its own leader for the weight', () => {
    const fg = pairCells(ka, cb, { top: 'today', sub: 'week' })[0]
    expect(fg).toMatchObject({ a: 0.5, b: 0.429, aSub: 0.509, bSub: 0.476, leader: 'a', subLeader: 'a' })
    const reb = pairCells(ka, cb, { top: 'week' }).find((c) => c.stat === 'REB')!
    expect(reb).toMatchObject({ a: 225, b: 181, aSub: null, bSub: null, leader: 'a' })
  })

  it('lets fewer turnovers win', () => {
    const week = pairCells(ka, cb, { top: 'week' })
    expect(week.find((c) => c.stat === 'TO')?.leader).toBe('a')
    expect(week.find((c) => c.stat === 'PTS')?.leader).toBe('b')
  })

  it('clamps the reach at 0.62, a full bar', () => {
    const today = pairCells(ka, cb, { top: 'today' })
    const reb = today.find((c) => c.stat === 'REB')!
    expect(reb.reach).toBe(0.62)
    expect(barShare(reb)).toBe(1)
    const ast = pairCells(ka, cb, { top: 'week' }).find((c) => c.stat === 'AST')!
    expect(ast.reach).toBeGreaterThan(0.1)
    expect(ast.reach).toBeLessThan(0.62)
    expect(pairCells(ka, cb, { top: 'today' }).find((c) => c.stat === 'FT%')?.reach).toBe(0)
  })

  it('has no leader and no figures before anyone plays (0–0 everywhere)', () => {
    const zero = (s: StripSide): StripSide => ({ ...s, today: vals(CATS.map(() => 0)), week: vals(CATS.map(() => 0)) })
    const cells = pairCells(zero(ka), zero(cb), { top: 'week' })
    expect(cells.every((c) => c.leader === 'none' && c.a == null && !c.close)).toBe(true)
    expect(pairFigure('FG%', cells[0].a)).toBe('–')
  })

  it("shows today as '–' with the week under it before the first tip", () => {
    const cells = pairCells({ ...ka, today: null }, { ...cb, today: null }, { top: 'today', sub: 'week' })
    expect(cells[0]).toMatchObject({ a: null, b: null, leader: 'none', aSub: 0.509, subLeader: 'a' })
  })

  it("leaves out categories the league doesn't score, keeping the site order", () => {
    const pick = (s: StripSide): StripSide => ({ ...s, week: s.week.filter((c) => ['PTS', 'AST', 'FG%'].includes(c.stat)) })
    expect(pairCells(pick(ka), pick(cb), { top: 'week' }).map((c) => c.stat)).toEqual(['FG%', 'AST', 'PTS'])
    expect(stripCategories(['PTS', 'DD', 'REB'])).toEqual(['REB', 'PTS', 'DD'])
  })
})

describe('pairLabel', () => {
  const names = { a: 'you', b: 'Bastards' }

  it('reads the whole category, with the week and close', () => {
    const cells = pairCells(ka, cb, { top: 'today', sub: 'week' })
    expect(pairLabel(cells[0], names)).toBe('FG%: you .500, Bastards .429, you lead. Week .509 to .476')
    expect(pairLabel(cells[1], names)).toBe('FT%: you 1.000, Bastards 1.000, tied. Week .744 to .746. Close this week, can flip')
    expect(pairLabel(cells[3], names)).toBe('REB: you 6, Bastards 30, Bastards lead. Week 225 to 181')
  })

  it('says nothing yet before the first figures', () => {
    const cells = pairCells({ ...ka, today: null }, { ...cb, today: null }, { top: 'today' })
    expect(pairLabel(cells[0], names)).toBe('FG%: nothing yet')
  })
})

describe('rankBar', () => {
  it('points up for the top half and down for the bottom, longest at 1st and last', () => {
    expect(rankBar(1, 10)).toEqual({ dir: 'up', share: 1, tone: 'good' })
    expect(rankBar(10, 10)).toEqual({ dir: 'down', share: 1, tone: 'neu' })
    expect(rankBar(5, 10).dir).toBe('up')
    expect(rankBar(6, 10).dir).toBe('down')
    expect(rankBar(3, 10).share).toBeCloseTo(2.5 / 4.5)
  })

  it('keeps the middle ranks a visible stub', () => {
    expect(rankBar(5, 10).share).toBe(0.18)
    expect(rankBar(6, 10).share).toBe(0.18)
  })

  it('a likely punt is bad whatever its rank; 1st and 2nd are good', () => {
    expect(rankBar(2, 10).tone).toBe('good')
    expect(rankBar(3, 10).tone).toBe('neu')
    expect(rankBar(9, 10, true).tone).toBe('bad')
    expect(rankBar(4, 12, true)).toMatchObject({ dir: 'up', tone: 'bad' })
  })
})
