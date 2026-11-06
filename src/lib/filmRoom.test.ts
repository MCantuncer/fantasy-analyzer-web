import { describe, expect, it } from 'vitest'
import type { RecapSide, WeekRecap } from '../api/client'
import week2 from '../test/recap-week2.json'
import {
  afterLine,
  catValue,
  filmPostNote,
  filmPostPeriod,
  gameBallsPost,
  gap,
  isFresh,
  markWeekSeen,
  readMatchup,
  readRecap,
  seenWeek,
  shortName,
  sideResult,
} from './filmRoom'

const recap = week2 as unknown as WeekRecap

function side(team_id: number, wins: number, values: Record<string, number>): RecapSide {
  return { team_id, wins, losses: 9 - wins, ties: 0, values } as RecapSide
}

describe('reading a matchup', () => {
  it('puts the winner first and finds the category that decided a 5-4', () => {
    const home = side(1, 4, { PTS: 500, 'FG%': 0.47, TO: 60 })
    const away = side(2, 5, { PTS: 520, 'FG%': 0.471, TO: 70 })
    const m = readMatchup({ home, away, winner_team_id: 2, margin: 1 } as never)
    expect(m.sides.map((s) => s.team_id)).toEqual([2, 1])
    expect(m.closest?.cat).toBe('FG%')
    expect(m.closest?.winner.team_id).toBe(2)
    expect(m.decided).toBe(true)
    expect(gap(m.closest!)).toBe('.001')
  })

  it('counts fewer turnovers as the win', () => {
    const a = side(1, 5, { TO: 40 })
    const b = side(2, 4, { TO: 50 })
    expect(sideResult(a, b, 'TO')).toBe('W')
    expect(sideResult(b, a, 'TO')).toBe('L')
  })
})

describe('formatting', () => {
  it('prints shooting like a box score and counting stats whole', () => {
    expect(catValue('FG%', 0.4666)).toBe('.467')
    expect(catValue('FT%', 1)).toBe('1.000')
    expect(catValue('PTS', 512.4)).toBe('512')
  })

  it('shortens first names for tight cells', () => {
    expect(shortName('Victor Wembanyama')).toBe('V. Wembanyama')
    expect(shortName("De'Anthony Melton")).toBe('D. Melton')
  })

  it('says what a pickup did for the team that added him, never his value', () => {
    const after = { games: 3, started: 3, value: -0.52, totals: { pts: 29, reb: 29, ast: 6, tpm: 0, stl: 2, blk: 3 } }
    expect(afterLine(after as never, false)).toBe('3 games for them: 29 PTS, 29 REB')
    expect(afterLine(after as never, true, true)).toBe('3 games for you: 29 PTS, 29 REB, 6 AST')
    expect(afterLine({ ...after, games: 0 } as never, false)).toBe('No games for them yet')
    expect(afterLine({ ...after, started: 0 } as never, true)).toContain('on the bench')
  })

  it('shows the League tab card Monday to Wednesday after a week ends', () => {
    expect(isFresh('2026-11-01', new Date('2026-11-02T15:00:00Z'))).toBe(true)
    expect(isFresh('2026-11-01', new Date('2026-11-04T20:00:00Z'))).toBe(true)
    expect(isFresh('2026-11-01', new Date('2026-11-05T15:00:00Z'))).toBe(false)
    expect(isFresh(null, new Date())).toBe(false)
  })
})

describe('reading a real week (League A, week 2)', () => {
  const d = readRecap(recap, 3)

  it('finds your matchup and the biggest win', () => {
    expect(d.mine?.sides.map((s) => s.team_id)).toEqual([3, 7])
    expect(d.topWin?.sides[0].team_id).toBe(4)
    expect(d.topWin?.margin).toBe(9)
  })

  it('splits standout free agents into still free and taken', () => {
    expect(d.freeNow.map((p) => p.name)).toEqual(['Anfernee Simons', "De'Anthony Melton", 'Tari Eason', 'Cam Spencer'])
    expect(d.taken.map((p) => p.name)).toContain('Christian Braun')
  })

  it('never makes a pickup with no games for his new team the pickup of the week', () => {
    expect(d.topPickup?.after.games).toBeGreaterThan(0)
    expect(d.topPickup?.name).not.toBe('Christian Braun')
  })

  it('lists your adds and the standout another team grabbed', () => {
    expect(d.myAdds.map((a) => a.name)).toContain('Isaiah Jackson')
    expect(d.miss?.picked_up?.team_id).not.toBe(3)
  })
})

describe('sharing to League Chat', () => {
  const name = (id: number) => recap.teams.find((t) => t.team_id === id)?.name ?? '?'
  const d = readRecap(recap, 3)

  it('writes a post that reads on its own and that chat can turn back into a card', () => {
    const body = gameBallsPost(recap, d, name, 'Good week.')
    expect(body).toContain("Victor Wembanyama (13 BLK, 3 G, Jze's Scary Team)")
    expect(body).toContain('Kavaklidere Boytoys (9–0 over Eryaman Lakers)')
    expect(body).toContain('pickup, 3 games for Kavaklidere Boytoys')
    expect(filmPostPeriod(body)).toBe(2)
    expect(filmPostNote(body)).toBe('Good week.')
    expect(body.length).toBeLessThanOrEqual(500)
    expect(gameBallsPost(recap, d, name, 'x'.repeat(600)).length).toBe(500)
  })

  it('leaves ordinary chat alone', () => {
    expect(filmPostPeriod('Week 2 Film Room was great')).toBeNull()
    expect(filmPostPeriod('nice steal')).toBeNull()
  })
})

describe('the new-tape dot', () => {
  it('remembers the latest week opened, per league, and never goes back', () => {
    localStorage.clear()
    expect(seenWeek(1, 2027)).toBe(0)
    markWeekSeen(1, 2027, 2)
    markWeekSeen(1, 2027, 1)
    expect(seenWeek(1, 2027)).toBe(2)
    expect(seenWeek(2, 2027)).toBe(0)
  })
})
