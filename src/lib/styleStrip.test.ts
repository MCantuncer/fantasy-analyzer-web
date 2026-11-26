import { describe, expect, it } from 'vitest'
import type { ManagerStyleRow } from '../api/client'
import { catShare, median, strip, vsMedian } from './styleStrip'

const row = (team_id: number, adds_per_week: number) =>
  ({ team_id, adds_per_week, categories: [{ cat: 'BLK', won: team_id, weeks: 5 }] }) as unknown as ManagerStyleRow

describe('styleStrip', () => {
  const teams = [row(1, 0.4), row(2, 1.2), row(3, 3.5), row(4, 1.0)]
  it('takes the median of an even or odd list', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([0.4, 1.2, 3.5, 1.0])).toBeCloseTo(1.1)
  })
  it('spreads dots inside the track and places the median tick', () => {
    const s = strip(teams, (t) => t.adds_per_week)
    expect(s.dots.find((d) => d.id === 1)!.at).toBeCloseTo(0.04)
    expect(s.dots.find((d) => d.id === 3)!.at).toBeCloseTo(0.96)
    expect(s.median).toBeCloseTo(1.1)
  })
  it('uses a fixed 0-1 range for category shares', () => {
    const s = strip(teams, (t) => catShare(t, 'BLK'), [0, 1])
    expect(s.dots.find((d) => d.id === 1)!.at).toBeCloseTo(0.04 + 0.92 * 0.2)
  })
  it('signs the gap to the median', () => {
    expect(vsMedian(3.5, 1.2)).toBe('+2.3')
    expect(vsMedian(0.4, 1.2)).toBe('−0.8')
    expect(vsMedian(1.2, 1.2)).toBe('±0')
  })
})
