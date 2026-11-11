import { describe, expect, it } from 'vitest'
import type { Game, GameLine, LineupSpot } from '../api/client'
import {
  benchLeftOut,
  buildRows,
  countdown,
  counts,
  espnTeamUrl,
  gamesLeft,
  nextLabel,
  starterTotals,
  swapToMake,
} from './myPlayers'

const spot = (id: number, slot: string, game_id: number | null, extra: Partial<LineupSpot> = {}): LineupSpot => ({
  player_id: id,
  name: `Player ${id}`,
  pro_team_id: 1,
  slot,
  slot_id: 0,
  starting: slot !== 'BE' && slot !== 'IR',
  injury_status: 'ACTIVE',
  game_id,
  eligible: ['UTIL'],
  ...extra,
})

const line = (id: number, pts: number): GameLine => ({
  player_id: id,
  name: `Player ${id}`,
  pro_team_id: 1,
  owner_team_id: 3,
  minutes: 30,
  pts,
  reb: 5,
  ast: 4,
  stl: 1,
  blk: 0,
  tpm: 2,
  to: 2,
  fgm: 6,
  fga: 12,
  ftm: 2,
  fta: 2,
  starter: true,
})

const game = (id: number, status: Game['status'], lines: GameLine[] = []): Game => ({
  id,
  start: '2026-11-11T01:00:00Z',
  status,
  clock: status === 'live' ? 'Q4 4:12' : null,
  away: { pro_team_id: 1, abbrev: 'BOS', name: 'Boston', score: status === 'scheduled' ? null : 98 },
  home: { pro_team_id: 2, abbrev: 'PHI', name: 'Philadelphia', score: status === 'scheduled' ? null : 94 },
  lines,
})

describe('My Players rows', () => {
  const games = [game(1, 'live', [line(10, 27)]), game(2, 'final', [line(11, 16), line(20, 19)]), game(3, 'scheduled')]
  const spots = [
    spot(10, 'SF', 1),
    spot(11, 'SG', 2),
    spot(12, 'C', 3),
    spot(13, 'UTIL', null),
    spot(14, 'PF', 2),
    spot(20, 'BE', 2),
    spot(21, 'BE', 3),
    spot(30, 'IR', null),
  ]
  const rows = buildRows(spots, games)

  it('keeps ESPN order and gives each player his state', () => {
    expect(rows.map((r) => r.spot.player_id)).toEqual([10, 11, 12, 13, 14, 20, 21, 30])
    expect(rows.map((r) => r.state)).toEqual(['live', 'final', 'later', 'idle', 'dnp', 'final', 'later', 'idle'])
  })

  it('counts starting slots, not the bench', () => {
    expect(counts(rows, 1)).toEqual({ playing: 4, starters: 6, live: 1, final: 2, later: 1, idle: 2, benchPlaying: 2 })
  })

  it('adds up only what counts: starters with a line', () => {
    const t = starterTotals(rows)
    expect([t.played, t.on, t.pts, t.fgm, t.fga]).toEqual([2, 1, 43, 12, 24])
  })

  it('suggests a swap only for a bench player who fits an idle slot and has not tipped', () => {
    const swap = swapToMake(rows, [])
    expect(swap?.bench.spot.player_id).toBe(21)
    expect(swap?.idle?.spot.player_id).toBe(13)
    expect(swap?.slot).toBe('UTIL')
    const unfit = buildRows([spot(13, 'C', null), spot(21, 'BE', 3, { eligible: ['PG'] })], games)
    expect(swapToMake(unfit, [])).toBeNull()
    const hurt = buildRows([spot(13, 'UTIL', null), spot(21, 'BE', 3, { injury_status: 'OUT' })], games)
    expect(swapToMake(hurt, [])).toBeNull()
    const empty = buildRows([spot(21, 'BE', 3)], games)
    expect(swapToMake(empty, ['UTIL'])).toMatchObject({ slot: 'UTIL', idle: null })
  })

  it('names the bench line that went to waste on a finished day', () => {
    expect(benchLeftOut(rows)?.spot.player_id).toBe(20)
    expect(benchLeftOut(buildRows([spot(10, 'SF', 1), spot(20, 'BE', 2)], games))).toBeNull()
  })

  it('links to the team page on ESPN', () => {
    expect(espnTeamUrl(744636428, 3, 2027)).toBe(
      'https://fantasy.espn.com/basketball/team?leagueId=744636428&teamId=3&seasonId=2027',
    )
  })

  it('counts down to tip-off, gold inside the last hour', () => {
    const tip = '2026-11-11T01:00:00Z'
    const at = (iso: string) => countdown(tip, new Date(iso).getTime())
    expect(at('2026-11-10T22:50:00Z')).toEqual({ text: 'in 2h 10m', soon: false })
    expect(at('2026-11-10T23:00:00Z')).toEqual({ text: 'in 2h', soon: false })
    expect(at('2026-11-11T00:20:00Z')).toEqual({ text: 'in 40m', soon: true })
    expect(at('2026-11-11T01:02:00Z').soon).toBe(true)
  })

  it('says where he plays next and how many games are left this week', () => {
    const nx = {
      day: 23,
      date: '2026-11-11',
      start: '2026-11-12T00:00:00Z',
      home: false,
      opponent: { pro_team_id: 11, abbrev: 'IND', name: 'Indiana' },
    }
    expect(nextLabel(nx)).toBe('Wed @ IND')
    expect(nextLabel({ ...nx, home: true })).toBe('Wed vs IND')
    expect(gamesLeft(spot(14, 'F', null, { week_games: [21, 23, 24, 27] }), 22)).toBe(3)
  })
})
