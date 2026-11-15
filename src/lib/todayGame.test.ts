import { describe, expect, it } from 'vitest'
import type { Game, PickupIdea, ScoreDay } from '../api/client'
import { moveCopy, todayCopy, todayGame, todayPeriod, type TodayGame } from './todayGame'

const side = (abbrev: string) => ({ pro_team_id: 0, abbrev, name: abbrev, score: null })
const game = (
  away: string,
  home: string,
  start: string,
  status: Game['status'] = 'scheduled',
  clock: string | null = null,
) => ({ id: 1, start, status, clock, away: side(away), home: side(home), lines: [] }) as unknown as Game
const feed = (date: string, games: Game[], week: { date: string; games: Game[] }[] = []) =>
  ({
    day: 27,
    date,
    games,
    days: [{ day: 26 }, { day: 27 }, { day: 28 }],
    week: week.map((w, i) => ({ day: 27 + i, ...w })),
  }) as unknown as ScoreDay
const player = (name: string, pro_team: string, injury_status = 'ACTIVE', expected_back: string | null = null) =>
  ({ name, pro_team, injury_status, expected_back, positions: [] }) as unknown as PickupIdea['add']
const TZ = 'Europe/Istanbul'

// Sunday 2026-11-15: Mara (UTAH) plays tonight at 5:30 AM Istanbul; TOR has no game.
const sunday = feed('2026-11-15', [
  game('DEN', 'LAL', '2026-11-16T00:30:00Z'),
  game('UTAH', 'SAC', '2026-11-16T02:30:00Z'),
])
const mara = player('Aday Mara', 'UTAH')
const pick = (add: PickupIdea['add'], timing: PickupIdea['timing'], availability = 'FREEAGENT') =>
  ({ add, drop: mara, availability, timing }) as unknown as PickupIdea
const ctx = (add: TodayGame, sharedDrop = false) => ({
  gameDate: '2026-11-15',
  sharedDrop,
  add,
  drop: todayGame(mara, sunday),
  timeZone: TZ,
})

describe('todayPeriod', () => {
  it('steps to the next game day once every game is final', () => {
    expect(todayPeriod(feed('2026-11-14', [game('A', 'B', '2026-11-15T00:00:00Z', 'final')]))).toBe(28)
    expect(todayPeriod(feed('2026-11-14', [game('A', 'B', '2026-11-15T00:00:00Z', 'live')]))).toBe(27)
  })
})

describe('todayGame / todayCopy', () => {
  it('a US night game is tonight, in the viewer time', () => {
    const c = todayCopy(todayGame(player('Sandro Mamukelashvili', 'LAL'), sunday), '2026-11-15', TZ)
    expect(c.lead).toBe('Plays tonight')
    expect(c.opp).toEqual({ abbrev: 'DEN', word: 'vs' })
  })
  it('no game: names the next one only from this week', () => {
    const f = feed('2026-11-12', [], [{ date: '2026-11-13', games: [game('BOS', 'TOR', '2026-11-14T00:30:00Z')] }])
    expect(todayCopy(todayGame(player('Jakob Poeltl', 'TOR'), f), '2026-11-12').detail).toBe('Next: Fri vs BOS')
    expect(todayCopy(todayGame(player('Jakob Poeltl', 'TOR'), sunday), '2026-11-15').detail).toBe('None left this week')
  })
  it('out: back day, and a finished game he sat out never reads as played', () => {
    const f = feed('2026-11-12', [game('CHA', 'ORL', '2026-11-13T00:00:00Z')])
    expect(
      todayCopy(todayGame(player('Jonathan Isaac', 'ORL', 'OUT', '2026-11-14'), f), '2026-11-12', TZ),
    ).toMatchObject({ lead: 'Out tonight', detail: 'back Sat' })
    const done = feed('2026-11-12', [game('CHA', 'ORL', '2026-11-12T17:00:00Z', 'final')])
    expect(todayCopy(todayGame(player('Jonathan Isaac', 'ORL', 'SUSPENSION'), done), '2026-11-12').lead).toBe(
      "Didn't play today",
    )
  })
  it('live: clock words, halftime spelled out', () => {
    const f = feed('2026-11-12', [game('MEM', 'HOU', '2026-11-12T19:00:00Z', 'live', 'Half')])
    expect(todayCopy(todayGame(player('Tari Eason', 'HOU'), f), '2026-11-12').detail).toBe('Halftime')
  })
})

describe('moveCopy', () => {
  const day = (add_plays: boolean) => [{ date: '2026-11-15', add_plays, drop_plays: true }]
  const nextWeek = (kept: number, missed: number, add_plays: boolean) =>
    ({
      wait: true,
      next_week: true,
      make_on: '2026-11-16',
      earliest_on: '2026-11-15',
      cats_now: 0.05,
      cats_best: 0.09,
      drop_games_kept: kept,
      add_games_missed: missed,
      week_changes: {},
      days: day(add_plays),
    }) as PickupIdea['timing']

  it('no game today vs a drop who plays tonight: wait, the reason is his game', () => {
    const p = pick(player('Jakob Poeltl', 'TOR'), nextWeek(1, 0, false))
    expect(moveCopy(p, ctx(todayGame(p.add, sunday)))).toMatchObject({
      verb: 'Add Monday',
      reason: 'Mara plays tonight',
    })
  })
  it('same games: the reason is categories, sized in the open row, swap after tonight', () => {
    const p = pick(player('Tari Eason', 'LAL'), nextWeek(1, 1, true))
    const m = moveCopy(p, ctx(todayGame(p.add, sunday)))
    expect(m.reason).toBe('Mara helps more')
    expect(m.story).toContain('+0.04 expected categories')
    expect(m.story).toContain("once tonight's games are over")
  })
  it('a wait whose day has come is add now', () => {
    const p = pick(player('Tari Eason', 'LAL'), nextWeek(1, 1, true))
    expect(moveCopy(p, { ...ctx(todayGame(p.add, sunday)), gameDate: '2026-11-16' }).verb).toBe('Add now')
  })
  it('shared drop: the deadline is his tip', () => {
    const p = pick(player('Sandro Mamukelashvili', 'LAL'), null)
    expect(moveCopy(p, ctx(todayGame(p.add, sunday), true)).reason).toMatch(/^before /)
  })
})
