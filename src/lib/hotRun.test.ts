import { describe, expect, it } from 'vitest'
import type { HotRun } from '../api/client'
import { keptLine, keptWords, rowLine, rowSaid, runParts, runSentence, VERDICT } from './hotRun'

const base: HotRun = {
  verdict: 'straw_fire',
  games: 6,
  gap: 8.5,
  minutes_part: 0.5,
  production_part: 4.0,
  shooting_part: 4.0,
  likely_kept: 0.22,
  minutes_usual: 21.5,
  minutes_recent: 24.2,
  pts_usual: 9.1,
  pts_recent: 15.6,
  fg_usual: 0.39,
  fg_recent: 0.54,
  three_usual: 0.31,
  three_recent: 0.41,
  ft_usual: 0.76,
  ft_recent: 0.84,
}
// League A, Sunday Nov 15.
const traore = base
const jenkins: HotRun = {
  ...base,
  verdict: 'bigger_role',
  games: 7,
  gap: 5.7,
  minutes_part: 3.2,
  production_part: 1.1,
  shooting_part: 1.4,
  likely_kept: 0.38,
  minutes_usual: 21.4,
  minutes_recent: 31.5,
  fg_usual: 0.42,
  fg_recent: 0.43,
}
const proctor: HotRun = { ...jenkins, minutes_part: 4.1, production_part: 0.5, shooting_part: 1.4, likely_kept: 0.41 }
const huerter: HotRun = {
  ...base,
  verdict: 'mixed',
  minutes_part: 2.1,
  production_part: 2.0,
  shooting_part: 2.2,
  likely_kept: 0.31,
  minutes_usual: 21.9,
  minutes_recent: 28.3,
  fg_usual: 0.43,
  fg_recent: 0.52,
}

describe('keptWords', () => {
  it('names the nearest plain fraction', () => {
    expect(keptWords(0.22)).toBe('about a fifth')
    expect(keptWords(0.31)).toBe('about a third')
    expect(keptWords(0.17)).toBe('about a sixth')
  })
  it('reads Jenkins (38%) and Proctor (41%) the same: about two fifths', () => {
    expect(keptWords(0.38)).toBe('about two fifths')
    expect(keptWords(0.41)).toBe('about two fifths')
    expect(keptLine(proctor)).toBe(keptLine(jenkins))
  })
  it('has words for the ends', () => {
    expect(keptWords(0.05)).toBe('very little')
    expect(keptWords(0.7)).toBe('more than half')
  })
  it('makes the headline line from likely_kept', () => {
    expect(keptLine(traore)).toBe('About a fifth of it should last')
  })
})

describe('rowLine', () => {
  it('uses one name per verdict', () => {
    expect(VERDICT).toEqual({ straw_fire: 'Straw fire', bigger_role: 'Bigger role', mixed: 'Role and luck' })
  })
  it('shows the shooting behind a straw fire, percent sign once', () => {
    expect(rowLine(traore)).toEqual({ word: 'Straw fire', reason: 'shooting 39 → 54%' })
  })
  it('says "more per minute" when that part leads a straw fire', () => {
    expect(rowLine({ ...traore, production_part: 5, shooting_part: 3 }).reason).toBe('more per minute')
  })
  it('falls back to words when the shooting numbers are missing', () => {
    expect(rowLine({ ...traore, fg_usual: null, fg_recent: null }).reason).toBe('hot shooting')
  })
  it('shows the minutes for a bigger role and for role and luck', () => {
    expect(rowLine(jenkins)).toEqual({ word: 'Bigger role', reason: 'minutes 21 → 32' })
    expect(rowLine(huerter).word).toBe('Role and luck')
  })
})

describe('runParts', () => {
  it('drops parts under 8% of the run (Traore: minutes are 6%)', () => {
    expect(runParts(traore).map((p) => p.key)).toEqual(['shooting', 'production'])
  })
  it('keeps the steady order and puts usual → recent on each line', () => {
    const parts = runParts(jenkins)
    expect(parts.map((p) => [p.label, p.from, p.to])).toEqual([
      ['Minutes', '21', '32'],
      ['Shooting', '42%', '43%'],
      ['Per 10 minutes', '4.3', '5.0 pts'],
    ])
  })
  it('sizes bars on one fixed scale with the validated keep rates', () => {
    const [min] = runParts(jenkins)
    expect(min.reach).toBeCloseTo(3.2 / 6)
    expect(min.keep).toBe(0.51)
    expect(min.note).toBe('half lasts')
  })
  it('drops the numbers, not the part, when a percentage is null', () => {
    const shoot = runParts({ ...traore, fg_usual: null, fg_recent: null }).find((p) => p.key === 'shooting')
    expect(shoot && [shoot.from, shoot.to]).toEqual([null, null])
  })
  it('marks a part that went down', () => {
    const down = runParts({ ...traore, minutes_part: -1.5, minutes_usual: 28, minutes_recent: 23 })[0]
    expect(down).toMatchObject({ key: 'minutes', down: true, keep: 0, note: 'went down' })
  })
})

describe('runSentence', () => {
  it('builds Traore from his parts, with minutes 22 to 24 (not "same minutes")', () => {
    expect(runSentence(traore)).toBe(
      'He played a few more minutes (22 to 24) but shot 54% against his usual 39% and did more per minute, so most of it is heat, which cools off fast.',
    )
  })
  it('says "his usual minutes" only when minutes moved less than 2', () => {
    expect(runSentence({ ...traore, minutes_recent: 22.4 })).toMatch(/^He played his usual minutes \(22\)/)
  })
  it('never lets a bigger role read as if it will hold', () => {
    expect(runSentence(jenkins)).toMatch(/though not all of them/)
  })
  it('splits role and luck', () => {
    expect(runSentence(huerter)).toBe(
      "He played more minutes (22 to 28), shot 52% against his usual 43% and did more per minute, so it's part role, which tends to stay, and part heat, which fades.",
    )
  })
  it('never repeats the headline share', () => {
    for (const r of [traore, jenkins, huerter]) expect(runSentence(r)).not.toMatch(/fifth|third|should last/)
  })
})

describe('rowSaid', () => {
  it('reads one sentence, arrows as "to"', () => {
    expect(rowSaid(traore)).toBe(
      'Straw fire. Shooting 54% against his usual 39%, minutes 22 to 24. About a fifth should last.',
    )
    expect(rowSaid(jenkins)).toBe('Bigger role. Minutes 21 to 32. About two fifths should last.')
    expect(rowSaid(huerter)).toBe(
      'Role and luck. Minutes 22 to 28, shooting 52% against his usual 43%. About a third should last.',
    )
  })
})
