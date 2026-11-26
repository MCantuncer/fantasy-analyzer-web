import { describe, expect, it } from 'vitest'
import { LOOK_MS, ORBIT_DEG_PER_S, START_DEG, angleAt, easeOut, idle, lookAngle, nearest } from './doorLook'

describe('door look', () => {
  it('reads the angle of the hover start from the centre, clockwise from 3 o’clock', () => {
    expect(lookAngle(10, 0)).toBe(0)
    expect(lookAngle(0, 10)).toBe(90)
    expect(lookAngle(-10, 0)).toBe(180)
    expect(lookAngle(0, -10)).toBe(-90)
  })

  it('turns the short way round', () => {
    expect(nearest(350, 10)).toBe(370)
    expect(nearest(10, 350)).toBe(-10)
    expect(nearest(725, 90)).toBe(810)
  })

  it('eases out and stays in range', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(2)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
  })

  it('orbits from where it started before any hover', () => {
    const look = idle(1000)
    expect(angleAt(look, 1000)).toBe(START_DEG)
    expect(angleAt(look, 10_000)).toBeCloseTo(START_DEG + 360)
  })

  it('looks at the hover spot, then keeps orbiting at the same pace from there', () => {
    const look = { from: 30, to: 180, at: 0 }
    expect(angleAt(look, 0)).toBe(30)
    expect(angleAt(look, LOOK_MS)).toBe(180)
    expect(angleAt(look, LOOK_MS + 1000)).toBeCloseTo(180 + ORBIT_DEG_PER_S)
    // no jump back: the turn moves one way only
    let prev = -Infinity
    for (let t = 0; t <= LOOK_MS; t += 25) {
      const a = angleAt(look, t)
      expect(a).toBeGreaterThanOrEqual(prev)
      prev = a
    }
  })
})
