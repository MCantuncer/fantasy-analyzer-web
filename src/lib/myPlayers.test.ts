import { describe, expect, it } from 'vitest'
import type { Game, GameLine, LineupSpot, PlayChance } from '../api/client'
import {
  basisShort,
  benchLeftOut,
  buildRows,
  countdown,
  counts,
  espnTeamUrl,
  gamesLeft,
  gameTimeCall,
  inWordWindow,
  newsAge,
  nextLabel,
  rowCall,
  starterTotals,
  statusCounts,
  swapToMake,
  wordLate,
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

describe('statusCounts', () => {
  it('counts every starter exactly once, ten of ten', () => {
    const late = { ...game(4, 'scheduled'), start: '2026-11-11T03:30:00Z' }
    const games = [
      game(1, 'live', [line(1, 10), line(2, 4)]),
      game(2, 'final', [line(3, 20), { ...line(4, 0), minutes: 0 }]),
      game(3, 'scheduled'),
      late,
    ]
    const spots = [
      spot(1, 'PG', 1),
      spot(2, 'SG', 1),
      spot(3, 'SF', 2),
      spot(4, 'PF', 2),
      spot(5, 'C', 4),
      spot(6, 'G', 3),
      spot(7, 'F', 3, { injury_status: 'OUT' }),
      spot(8, 'UTIL', null),
      spot(9, 'UTIL', null),
      spot(10, 'UTIL', 4),
      spot(11, 'BE', 1),
      spot(12, 'IR', null),
    ]
    const c = statusCounts(buildRows(spots, games), 0)
    expect(c).toEqual({ live: 2, final: 1, dnp: 1, later: 3, out: 1, idle: 2, empty: 0, nextTip: '2026-11-11T01:00:00Z' })
    expect(c.live + c.final + c.dnp + c.later + c.out + c.idle + c.empty).toBe(10)
  })

  it('counts open slots and leaves the tip empty when nobody is still to come', () => {
    const c = statusCounts(buildRows([spot(1, 'PG', 1)], [game(1, 'final', [line(1, 12)])]), 2)
    expect(c).toMatchObject({ final: 1, empty: 2, nextTip: null })
  })
})

describe('Final Word: chance to play', () => {
  const play = (chance: number, tag: PlayChance['tag'], extra: Partial<PlayChance> = {}): PlayChance => ({
    chance,
    tag,
    basis: '',
    news: 'He is listed.',
    news_at: '2026-11-17T20:00:00Z',
    return_date: null,
    upgraded: false,
    missed_in_a_row: null,
    ...extra,
  })
  const at = (id: number, start: string): Game => ({ ...game(id, 'scheduled'), start })
  // Thompson (SG) tips 00:00, Gafford (bench C) 01:00; Gillespie (UTIL) doubtful, tips 03:00.
  const night = (gaffordTip: string, thompson = play(0.55, 'Questionable')) =>
    buildRows(
      [
        spot(1, 'SG', 1, { name: 'Amen Thompson', eligible: ['SG', 'UTIL'], play: thompson }),
        spot(2, 'UTIL', 3, {
          name: 'Christian Braun',
          eligible: ['SG', 'UTIL'],
          play: play(0.62, 'Day-to-day', { news: null }),
        }),
        spot(3, 'UTIL', 3, {
          name: 'Collin Gillespie',
          eligible: ['PG', 'UTIL'],
          play: play(0.05, 'Doubtful'),
        }),
        spot(9, 'BE', 2, { name: 'Daniel Gafford', eligible: ['C', 'UTIL'] }),
      ],
      [at(1, '2026-11-19T00:00:00Z'), at(2, gaffordTip), at(3, '2026-11-19T03:00:00Z')],
    )

  it('waits for the word when the sub tips after it, and claims the sub once', () => {
    const rows = night('2026-11-19T01:00:00Z')
    const call = gameTimeCall(rows)!
    expect(call.doubt.spot.name).toBe('Amen Thompson')
    expect(call.verdict).toBe('wait')
    expect(call.fill).toMatchObject({ slot: 'UTIL' })
    expect(call.planB?.row.spot.name).toBe('Collin Gillespie')
    expect(rowCall(rows[0], call)).toEqual({ verb: 'Leave in', why: 'Gafford covers' })
    expect(rowCall(rows[2], call)).toEqual({ verb: 'Swap if Thompson plays', why: null })
    expect(rowCall(rows[1], call)).toMatchObject({ verb: null, why: 'no sub left' })
  })

  it('decides now when the sub tips before the word, and gives him to the likeliest out', () => {
    const rows = night('2026-11-18T22:30:00Z')
    const call = gameTimeCall(rows)!
    expect(call.verdict).toBe('now')
    expect(call.doubt.spot.name).toBe('Collin Gillespie')
    expect(rowCall(rows[2], call)).toEqual({ verb: 'Swap now', why: null })
    expect(rowCall(rows[0], call)).toMatchObject({ verb: null, why: 'no sub left' })
  })

  it('puts a ruled-out starter first, whatever else is waiting', () => {
    const rows = night('2026-11-19T01:00:00Z', play(0, 'Out'))
    const call = gameTimeCall(rows)!
    expect(call.doubt.spot.name).toBe('Amen Thompson')
    expect(call.verdict).toBe('now')
    expect(rowCall(rows[0], call)).toEqual({ verb: 'Swap now', why: 'ruled out tonight' })
  })

  it('opens itself in the word window and flags a late word', () => {
    const call = gameTimeCall(night('2026-11-19T01:00:00Z'))!
    const t = (iso: string) => new Date(iso).getTime()
    expect(inWordWindow(call, t('2026-11-18T22:20:00Z'))).toBe(false)
    expect(inWordWindow(call, t('2026-11-18T22:40:00Z'))).toBe(true)
    expect(wordLate(call, t('2026-11-18T23:10:00Z'))).toBe(false)
    expect(wordLate(call, t('2026-11-18T23:40:00Z'))).toBe(true)
  })

  it('says what the number is, and how fresh the word is', () => {
    expect(basisShort(play(0.55, 'Questionable'))).toBe('55% of questionable players like him played')
    expect(basisShort(play(0.55, 'Questionable'), true)).toBe('55% of questionable players played')
    expect(basisShort(play(0.1, 'Out'))).toBe('10% of regulars out that long played the next one')
    expect(basisShort(play(0.58, 'Questionable', { upgraded: true }))).toBe('58% of questionable players like him played')
    expect(basisShort(play(0, 'Out'))).toBeNull()
    expect(newsAge(play(0.55, 'Questionable'), new Date('2026-11-18T19:00:00Z').getTime())).toBe('news 23h ago')
    expect(newsAge(play(0.62, 'Day-to-day', { news: null }), 0)).toBe('no word yet')
  })

  it('stays quiet for a probable starter', () => {
    const rows = buildRows(
      [spot(1, 'PG', 1, { play: play(0.94, 'Probable') })],
      [at(1, '2026-11-19T00:00:00Z')],
    )
    expect(rowCall(rows[0], gameTimeCall(rows))).toBeNull()
  })
})
