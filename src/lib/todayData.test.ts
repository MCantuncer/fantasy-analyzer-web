import { describe, expect, it } from 'vitest'
import type { DayLineup, Game, ScoreDay } from '../api/client'
import { nextFetch, todayMatters } from './todayData'
import type { TodayData } from './todayData'

const game = (id: number, status: Game['status'], start = '2026-11-16T00:00:00Z'): Game => ({
  id,
  start,
  status,
  away: { pro_team_id: 1, abbrev: 'A', name: 'A' },
  home: { pro_team_id: 2, abbrev: 'B', name: 'B' },
  lines: [],
})
const day = (games: Game[], live = false): ScoreDay => ({
  league_id: 1,
  season: 2027,
  day: 27,
  date: '2026-11-15',
  games,
  days: [],
  live,
  week: [],
  updated_at: '2026-11-15T23:45:00Z',
  complete: true,
})
const lineup = (gameId: number | null, starting = true): DayLineup => ({
  league_id: 1,
  season: 2027,
  team_id: 3,
  day: 27,
  spots: [
    {
      player_id: 1,
      name: 'P',
      pro_team_id: 1,
      slot: starting ? 'PG' : 'BE',
      slot_id: 0,
      starting,
      injury_status: 'ACTIVE',
      game_id: gameId,
      eligible: [],
    },
  ],
  open_slots: [],
  fetched_at: '2026-11-15T23:45:00Z',
})

describe('nextFetch', () => {
  const now = Date.parse('2026-11-15T23:00:00Z')
  it('asks every minute while a game is on', () => {
    expect(nextFetch(day([game(1, 'live')], true), now)).toBe(60_000)
  })
  it('waits for the next tip, at most five minutes and at least half a minute', () => {
    expect(nextFetch(day([game(1, 'scheduled', '2026-11-15T23:02:00Z')]), now)).toBe(120_000)
    expect(nextFetch(day([game(1, 'scheduled', '2026-11-16T02:00:00Z')]), now)).toBe(300_000)
    expect(nextFetch(day([game(1, 'scheduled', '2026-11-15T22:59:00Z')]), now)).toBe(30_000)
  })
  it('stops once the night is over', () => {
    expect(nextFetch(day([game(1, 'final')]), now)).toBe(false)
  })
})

describe('todayMatters', () => {
  const data = (games: Game[], a: DayLineup, b: DayLineup): TodayData => ({
    scores: day(games),
    lineups: [a, b],
    stale: false,
    refetch: () => undefined,
  })
  it('is on while a starter on either side still has a game to play or watch', () => {
    expect(todayMatters(data([game(1, 'scheduled')], lineup(null), lineup(1)))).toBe(true)
  })
  it('is off once every game is final, or when only bench players play', () => {
    expect(todayMatters(data([game(1, 'final')], lineup(1), lineup(1)))).toBe(false)
    expect(todayMatters(data([game(1, 'live')], lineup(1, false), lineup(null)))).toBe(false)
  })
})
