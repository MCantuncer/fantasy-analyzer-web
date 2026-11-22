import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, ComparePlayer } from '../lib/iddaaCompare'
import { ValueRungs } from './ValueRungs'

afterEach(cleanup)

function player(name: string, rungs: ComparePlayer['rungs'], actual: number | null): ComparePlayer {
  return {
    name,
    player_id: null,
    team: 'POR',
    stat: 'blk',
    played: actual == null ? null : true,
    ladder: [],
    ours: 2.2,
    book: 1.5,
    actual,
    gap: 0.7,
    ours_hit: null,
    book_hit: null,
    closer: null,
    rungs,
    rung_closer: null,
  }
}

function night(players: ComparePlayer[], status: CompareGame['status']): BookCompare {
  return {
    season: 2027,
    day: 33,
    date: '2026-11-21',
    days: [33],
    nights: [{ day: 33, date: '2026-11-21', games: 1 }],
    bands: {},
    look: { checked: null, ok: null, error: null, games: 1, matched: 1 },
    games: [
      {
        game_id: 1,
        away: 'POR',
        home: 'NY',
        tip: '2026-11-22T00:30:00Z',
        checked: '2026-11-22T00:20:00Z',
        status,
        away_score: null,
        home_score: null,
        markets: [],
        players,
      },
    ],
    tally: [],
  }
}

function show(data: BookCompare, now: string) {
  const settled = data.games.every((g) => g.status === 'final')
  return render(<ValueRungs data={data} lines={linesOf(data, new Date(now))} settled={settled} />)
}

const CLINGAN = (hit: boolean | null) => [
  { n: 4, odd: 6.27, book: 0.13, ours: 0.19, value: 0.19, hit },
  { n: 5, odd: 15.1, book: 0.054, ours: 0.096, value: 0.45, hit: hit == null ? null : false },
]

describe('Value Rungs states', () => {
  it('settled: the picks with landed and missed, and both data-written notes', () => {
    show(night([player('Donovan Clingan', CLINGAN(true), 4)], 'final'), '2026-11-22T20:00:00Z')
    expect(screen.getByRole('heading', { name: 'How the 2 went' })).toBeTruthy()
    expect(screen.getAllByText('Landed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Missed').length).toBeGreaterThan(0)
    expect(screen.getByText('What +0.45 means')).toBeTruthy()
    expect(screen.queryByText('One player, one call')).toBeNull() // 2 rungs: under the rule's 3
    expect(screen.getAllByLabelText(/Donovan Clingan, 5\+ blocks at 15.10: ours 9.6%, needs 6.6%/)).toHaveLength(1)
  })
  it('tonight: pending rows show the tip and the time of the odds', () => {
    show(night([player('Donovan Clingan', CLINGAN(null), null)], 'scheduled'), '2026-11-21T20:00:00Z')
    expect(screen.getByRole('heading', { name: "Tonight's 2" })).toBeTruthy()
    expect(screen.getAllByText(/odds of/).length).toBe(2)
    expect(screen.getAllByText('land, if our chances are right').length).toBeGreaterThan(0)
  })
  it('empty: no rung beat its price, the Tape still shows', () => {
    const none = [{ n: 2, odd: 2.4, book: 0.34, ours: 0.3, value: -0.28, hit: false }]
    const { container } = show(night([player('Donovan Clingan', none, 1)], 'final'), '2026-11-22T20:00:00Z')
    expect(screen.getByText('No rung beat its price that night.')).toBeTruthy()
    expect(screen.getByText(/Typical rung/).textContent).toContain('−0.28')
    expect(container.querySelector('.vr-tape, .vr-tape-line')).not.toBeNull()
  })
  it("failed: the ladders didn't load and the night is left out of the record", () => {
    show(night([player('Donovan Clingan', [], 4)], 'final'), '2026-11-22T20:00:00Z')
    expect(screen.getByText(/ladders didn't load for Sat 21 Nov/)).toBeTruthy()
    expect(screen.getByText(/this night is not in the record/)).toBeTruthy()
  })
  it('a server from before the rungs: nothing at all', () => {
    const { container } = show(night([player('Donovan Clingan', undefined, 4)], 'final'), '2026-11-22T20:00:00Z')
    expect(container.innerHTML).toBe('')
  })
})
