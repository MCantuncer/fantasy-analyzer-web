import { describe, expect, it } from 'vitest'
import {
  BASELINE,
  CAP,
  GRADE_FLOORS,
  categoryScores,
  gradeFor,
  gradeWords,
  minutesDelta,
  nightGrade,
  nightScore,
  signed,
  tierFor,
} from './nightGrade'
import type { GradedLine } from './nightGrade'

/** The yardstick's own line: every category exactly at its mean, no shots. */
const line = (o: Partial<GradedLine> = {}): GradedLine => ({
  minutes: 30,
  pts: BASELINE.PTS.mean,
  reb: BASELINE.REB.mean,
  ast: BASELINE.AST.mean,
  stl: BASELINE.STL.mean,
  blk: BASELINE.BLK.mean,
  tpm: BASELINE['3PM'].mean,
  to: BASELINE.TO.mean,
  fgm: 0,
  fga: 0,
  ftm: 0,
  fta: 0,
  ...o,
})

// The real Nov 13 2026 lines from My Players.
const giannis = { minutes: 31, pts: 37, reb: 9, ast: 2, stl: 0, blk: 1, tpm: 1, to: 4, fgm: 15, fga: 20, ftm: 6, fta: 11 }
const bey = { minutes: 35, pts: 30, reb: 10, ast: 0, stl: 0, blk: 1, tpm: 6, to: 0, fgm: 11, fga: 20, ftm: 2, fta: 3 }
const mitchell = { minutes: 39, pts: 22, reb: 5, ast: 17, stl: 0, blk: 1, tpm: 3, to: 1, fgm: 7, fga: 14, ftm: 5, fta: 6 }
const thompson = { minutes: 41, pts: 12, reb: 10, ast: 3, stl: 0, blk: 1, tpm: 0, to: 2, fgm: 4, fga: 8, ftm: 4, fta: 5 }
const champagnie = { minutes: 23, pts: 7, reb: 8, ast: 3, stl: 0, blk: 1, tpm: 1, to: 1, fgm: 3, fga: 8, ftm: 0, fta: 0 }

describe('categoryScores', () => {
  it('scores the yardstick line at zero in every category', () => {
    for (const v of Object.values(categoryScores(line()))) expect(v).toBeCloseTo(0, 6)
  })

  it('scores shooting by makes above league average on the attempts', () => {
    const z = categoryScores(line({ fgm: 9, fga: 15, ftm: 4, fta: 6 }))
    expect(z.FG).toBeCloseTo((9 - 15 * 0.47) / 1.8, 6)
    expect(z.FT).toBeCloseTo((4 - 6 * 0.8) / 0.9, 6)
  })

  it('counts no attempts as no effect', () => {
    const z = categoryScores(line())
    expect(z.FG).toBe(0)
    expect(z.FT).toBe(0)
  })

  it('treats turnovers as negative', () => {
    expect(categoryScores(line({ to: 6 })).TO).toBeLessThan(-2)
    expect(categoryScores(line({ to: 0 })).TO).toBeGreaterThan(1)
  })

  it('caps one freak category at three spreads', () => {
    expect(categoryScores(line({ ast: 25 })).AST).toBe(CAP)
    expect(categoryScores(line({ to: 12 })).TO).toBe(-CAP)
    expect(categoryScores(line({ ftm: 2, fta: 12 })).FT).toBe(-CAP)
  })
})

describe('gradeFor / tierFor', () => {
  it('maps totals to letters at the floors, best first', () => {
    expect(gradeFor(6.25)).toBe('A+')
    expect(gradeFor(6.24)).toBe('A')
    expect(gradeFor(3.5)).toBe('A−')
    expect(gradeFor(0)).toBe('B−')
    expect(gradeFor(-3.75)).toBe('C−')
    expect(gradeFor(-5.25)).toBe('D')
    expect(gradeFor(-5.26)).toBe('F')
  })

  it('keeps the floors strictly falling', () => {
    for (let i = 1; i < GRADE_FLOORS.length; i++) expect(GRADE_FLOORS[i][1]).toBeLessThan(GRADE_FLOORS[i - 1][1])
  })

  it('lights only the A range and D/F', () => {
    expect(tierFor('A+')).toBe('top')
    expect(tierFor('A−')).toBe('top')
    expect(tierFor('B+')).toBe('mid')
    expect(tierFor('C−')).toBe('mid')
    expect(tierFor('D')).toBe('low')
    expect(tierFor('F')).toBe('low')
  })
})

describe('nightGrade', () => {
  it('grades nothing without a line or minutes', () => {
    expect(nightGrade(null)).toBeNull()
    expect(nightGrade(undefined)).toBeNull()
    expect(nightGrade(line({ minutes: 0 }))).toBeNull()
  })

  it('grades the yardstick line in the middle of the scale', () => {
    const g = nightGrade(line())!
    expect(g.score).toBeCloseTo(0, 6)
    expect(g.grade).toBe('B−')
    expect(g.tier).toBe('mid')
    expect(g.drivers).toEqual([])
  })

  it('splits the letter and its modifier for typesetting', () => {
    const g = nightGrade(mitchell)!
    expect(g.grade).toBe('A−')
    expect(g.letter).toBe('A')
    expect(g.mod).toBe('−')
    expect(nightGrade(bey)!.mod).toBe('')
  })

  it('reads the real Nov 13 night the way a 9-cat manager would', () => {
    expect(nightGrade(bey)!.grade).toBe('A') // 30, 10 reb, 6 threes, 0 TO
    expect(nightGrade(mitchell)!.grade).toBe('A−') // 17 assists
    expect(nightGrade(giannis)!.grade).toBe('B−') // 37 on 15/20, but 6/11 FT and 4 TO
    expect(nightGrade(thompson)!.grade).toBe('C+') // 12 and 10 in 41 minutes
    expect(nightGrade(champagnie)!.grade).toBe('C')
  })

  it('names up to three categories of two spreads or more, biggest first', () => {
    const g = nightGrade(giannis)!
    expect(g.drivers.map((d) => d.cat)).toEqual(['FG', 'FT', 'PTS'])
    expect(g.drivers[1].z).toBeLessThan(0)
    expect(nightGrade(thompson)!.drivers).toEqual([])
  })

  it('makes a monster an A+ and a disaster an F', () => {
    expect(nightGrade({ minutes: 38, pts: 42, reb: 12, ast: 9, stl: 2, blk: 1, tpm: 5, to: 2, fgm: 15, fga: 25, ftm: 7, fta: 7 })!.grade).toBe('A+')
    expect(nightGrade({ minutes: 30, pts: 4, reb: 2, ast: 1, stl: 0, blk: 0, tpm: 0, to: 5, fgm: 2, fga: 12, ftm: 0, fta: 4 })!.grade).toBe('F')
  })

  it('agrees with nightScore', () => {
    expect(nightGrade(giannis)!.score).toBeCloseTo(nightScore(giannis), 9)
  })
})

describe('gradeWords', () => {
  it('says the letter and what moved it', () => {
    expect(gradeWords(nightGrade(giannis)!)).toBe('B− night: FG and PTS helped most, FT hurt most')
    expect(gradeWords(nightGrade(thompson)!)).toBe('C+ night')
  })
})

describe('minutesDelta', () => {
  it('shows only a gap of five minutes or more, rounded', () => {
    expect(minutesDelta(41, 33.62)).toBe(7)
    expect(minutesDelta(35, 27.46)).toBe(8)
    expect(minutesDelta(39, 36)).toBeNull()
    expect(minutesDelta(20, 26.4)).toBe(-6)
    expect(minutesDelta(21, 25.6)).toBe(-5)
    expect(minutesDelta(22, 25.6)).toBeNull()
  })

  it('needs an average', () => {
    expect(minutesDelta(30, null)).toBeNull()
    expect(minutesDelta(30, undefined)).toBeNull()
  })

  it('signs with a real minus', () => {
    expect(signed(7)).toBe('+7')
    expect(signed(-6)).toBe('−6')
    expect(signed(0)).toBe('0')
  })
})
