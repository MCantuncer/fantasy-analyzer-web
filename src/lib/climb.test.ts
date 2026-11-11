import { describe, expect, it } from 'vitest'
import { CLIMB, climb, climbWindow, sCurve } from './climb'

describe('climbWindow', () => {
  it('zooms to 20 points around a small move', () => {
    expect(climbWindow(0.47, 0.51)).toEqual([40, 60])
    expect(climbWindow(0.12, 0.15)).toEqual([5, 25])
    expect(climbWindow(0.02, 0.05)).toEqual([0, 20])
    expect(climbWindow(0.95, 0.99)).toEqual([80, 100])
  })

  it('widens in steps of 10 for a big move and always holds both ends', () => {
    const [lo, hi] = climbWindow(0.2, 0.45)
    expect(hi - lo).toBe(40)
    expect(lo).toBeLessThanOrEqual(20)
    expect(hi).toBeGreaterThanOrEqual(45)
    for (const [a, b] of [
      [0.01, 0.6],
      [0.33, 0.47],
      [0.58, 0.79],
      [0.4, 1],
    ]) {
      const [l, h] = climbWindow(a, b)
      expect(l).toBeLessThanOrEqual(Math.round(a * 100))
      expect(h).toBeGreaterThanOrEqual(Math.round(b * 100))
      expect(l).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(100)
    }
  })
})

describe('climb', () => {
  const c = climb({ before: 0.47, after: 0.51, others: [0.5, 0.5, 0.49, 0.48, 0.48, 0.48] })

  it('puts the new odds above today and the even-odds line between them', () => {
    expect(c.end.y).toBeLessThan(c.start.y)
    expect(c.even).not.toBeNull()
    expect(c.even!).toBeGreaterThan(c.end.y)
    expect(c.even!).toBeLessThan(c.start.y)
    expect(c.ticks.map((t) => t.pct)).toEqual([40, 45, 50, 55, 60])
  })

  it('scales honestly: equal steps in odds are equal steps on screen', () => {
    const step = c.ticks[1].y - c.ticks[0].y
    expect(c.ticks[2].y - c.ticks[1].y).toBeCloseTo(step)
    // 4 points of a 20-point window is a fifth of the plot
    const plot = CLIMB.plot
    expect(c.start.y - c.end.y).toBeCloseTo(plot / 5)
  })

  it('groups the other pickups by where they end, with the gain each group is labelled by', () => {
    expect(c.groups.map((g) => [g.pct, g.count, g.gain])).toEqual([
      [50, 2, 3],
      [49, 1, 2],
      [48, 3, 1],
    ])
    expect(c.strands).toHaveLength(6)
    for (const s of c.strands) expect(s.x).toBeGreaterThan(c.end.x)
  })

  it('keeps strands outside the window on its edge and caps how many it draws', () => {
    const many = climb({ before: 0.47, after: 0.51, others: Array.from({ length: 40 }, () => 0.2) })
    expect(many.strands).toHaveLength(CLIMB.maxStrands)
    expect(many.strands[0].y).toBeCloseTo(many.ticks[0].y)
  })

  it('has no even-odds line when 50% is outside the window', () => {
    expect(climb({ before: 0.1, after: 0.14, others: [] }).even).toBeNull()
  })
})

describe('sCurve', () => {
  it('leaves and lands flat', () => {
    expect(sCurve(200, 100, 600, 40)).toBe('M200 100 C400 100 400 40 600 40')
  })
})

describe('room around the window', () => {
  it('leaves space for the labels at both ends without a big empty band', () => {
    const c = climb({ before: 0.47, after: 0.51, others: [] })
    expect(c.end.y).toBeGreaterThanOrEqual(CLIMB.above)
    expect(c.height - c.start.y).toBeGreaterThanOrEqual(CLIMB.below)
    expect(c.ticks[c.ticks.length - 1].y).toBeLessThan(CLIMB.above)
  })

  it('grows when the move sits at the top or bottom of the window', () => {
    const high = climb({ before: 0.95, after: 0.99, others: [] })
    expect(high.end.y).toBeGreaterThanOrEqual(CLIMB.above)
    const low = climb({ before: 0.01, after: 0.03, others: [] })
    expect(low.height - low.start.y).toBeGreaterThanOrEqual(CLIMB.below)
  })
})
