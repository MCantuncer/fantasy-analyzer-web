import { describe, expect, it } from 'vitest'
import { heatOf, isClutch, parseClock, periodSpoken, timeLeftLine } from './gameClock'

describe('parseClock', () => {
  it('reads a running clock', () => {
    const c = parseClock('Q2 2:30')!
    expect(c).toMatchObject({ period: 2, label: 'Q2', isBreak: false, time: '2:30', toPlay: 26.5 })
    expect(c.progress).toBeCloseTo(21.5 / 48)
  })

  it('reads breaks', () => {
    expect(parseClock('Half')).toMatchObject({ period: 2, isBreak: true, word: 'Half', progress: 0.5, toPlay: 24 })
    expect(parseClock('End Q3')).toMatchObject({ period: 3, isBreak: true, word: 'End Q3', progress: 0.75, toPlay: 12 })
    expect(parseClock('End Q4')).toMatchObject({ period: 4, isBreak: true, progress: 1, toPlay: 0 })
    expect(parseClock('End OT')).toMatchObject({ period: 5, isBreak: true, word: 'End OT', progress: 1 })
  })

  it('stretches the scale in overtime', () => {
    const ot = parseClock('OT 0:48')!
    expect(ot).toMatchObject({ period: 5, label: 'OT', time: '0:48', toPlay: 0 })
    expect(ot.progress).toBeCloseTo((48 + 5 - 0.8) / 53)
    const two = parseClock('2OT 1:10')!
    expect(two).toMatchObject({ period: 6, label: '2OT', time: '1:10' })
    expect(two.progress).toBeCloseTo((58 - 70 / 60) / 58)
  })

  it("shows ESPN's last-minute tenths as whole seconds", () => {
    expect(parseClock('Q4 48.2')).toMatchObject({ period: 4, time: '0:48' })
    expect(parseClock('Q3 5.0')).toMatchObject({ period: 3, time: '0:05' })
  })

  it('gives up on what it can\'t read', () => {
    expect(parseClock(null)).toBeNull()
    expect(parseClock('')).toBeNull()
    expect(parseClock('Delayed')).toBeNull()
    expect(parseClock('Q9 1:00')).toBeNull()
  })
})

describe('isClutch', () => {
  it('is the last five minutes of the 4th or overtime, within 5', () => {
    expect(isClutch(parseClock('Q4 1:12'), 91, 91)).toBe(true)
    expect(isClutch(parseClock('Q4 5:00'), 100, 95)).toBe(true)
    expect(isClutch(parseClock('Q4 5:01'), 100, 95)).toBe(false)
    expect(isClutch(parseClock('Q4 1:12'), 100, 94)).toBe(false)
    expect(isClutch(parseClock('OT 3:05'), 110, 108)).toBe(true)
    expect(isClutch(parseClock('Q3 0:30'), 80, 80)).toBe(false)
    expect(isClutch(parseClock('End Q4'), 100, 100)).toBe(false)
  })
})

describe('heatOf', () => {
  it('follows closeness: a blowout stays cool, a close finish burns', () => {
    const blowout = heatOf(parseClock('Q4 3:05'), 101, 84)
    const close = heatOf(parseClock('Q3 5:10'), 70, 62)
    const tied = heatOf(parseClock('Q4 1:12'), 91, 91)
    expect(blowout).toBeLessThan(0.25)
    expect(close).toBeGreaterThan(blowout)
    expect(tied).toBe(1)
    expect(heatOf(parseClock('2OT 1:10'), 131, 133)).toBeGreaterThan(0.9)
  })

  it('starts low and goes out at a break', () => {
    expect(heatOf(parseClock('Q1 11:40'), 2, 0)).toBeLessThan(0.2)
    expect(heatOf(parseClock('Half'), 60, 57)).toBe(0)
    expect(heatOf(null, 0, 0)).toBe(0)
  })
})

describe('timeLeftLine', () => {
  it('answers how much is left', () => {
    expect(timeLeftLine(parseClock('Q2 2:30'))).toBe('27 min to play')
    expect(timeLeftLine(parseClock('Half'))).toBe('24 min to play')
    expect(timeLeftLine(parseClock('Q4 1:12'))).toBe('Last quarter')
    expect(timeLeftLine(parseClock('End Q4'))).toBe('Overtime next')
    expect(timeLeftLine(parseClock('OT 0:48'))).toBe('Overtime')
    expect(timeLeftLine(parseClock('2OT 1:10'))).toBe('Overtime 2')
    expect(timeLeftLine(null)).toBe('')
  })

  it('speaks the period', () => {
    expect(periodSpoken(2)).toBe('2nd quarter')
    expect(periodSpoken(5)).toBe('overtime')
    expect(periodSpoken(6)).toBe('2nd overtime')
  })
})
