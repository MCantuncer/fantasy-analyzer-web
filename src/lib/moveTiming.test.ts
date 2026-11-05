import { describe, expect, it } from 'vitest'
import { ifMade, keptDays, lastName, spotDays, spotGames, waitLabel, type MoveTiming } from './moveTiming'

// Thursday Nov 5, 2026: Niang (drop) plays Thu and Sat, Lopez (add) only Sun. Best made Sunday.
const day = (date: string, add: boolean, drop: boolean) => ({ date, add_plays: add, drop_plays: drop })
const lopez: MoveTiming = {
  wait: true,
  make_on: '2026-11-08',
  next_week: false,
  earliest_on: '2026-11-05',
  cats_now: -0.02,
  cats_best: 0.1,
  drop_games_kept: 2,
  add_games_missed: 0,
  week_changes: {},
  days: [
    day('2026-11-05', false, true),
    day('2026-11-06', false, false),
    day('2026-11-07', false, true),
    day('2026-11-08', true, false),
  ],
}

describe('move timing', () => {
  it('names the day to make it', () => {
    expect(waitLabel(lopez)).toBe('Make this Sunday')
    expect(ifMade(lopez)).toBe('if made Sunday')
    expect(waitLabel({ ...lopez, make_on: '2026-11-06' })).toBe('Make it tomorrow')
    expect(waitLabel({ ...lopez, next_week: true, make_on: '2026-11-09' })).toBe('Make it next week')
  })

  it('counts the games in the roster spot, waiting and now', () => {
    expect(spotGames(lopez)).toEqual({ best: 3, now: 1 })
    expect(spotDays(lopez).map((s) => s.who)).toEqual(['drop', null, 'drop', 'add'])
    expect(keptDays(lopez).map((d) => d.date)).toEqual(['2026-11-05', '2026-11-07'])
  })

  it('keeps every game of the dropped player when it waits for next week', () => {
    const next = { ...lopez, next_week: true, make_on: '2026-11-09' }
    expect(spotDays(next).map((s) => s.who)).toEqual(['drop', null, 'drop', null])
  })

  it('shortens a name to the last name', () => {
    expect(lastName('Georges Niang')).toBe('Niang')
    expect(lastName('Robert Williams III')).toBe('Williams III')
    expect(lastName('Nene')).toBe('Nene')
  })
})
