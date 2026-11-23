import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, ComparePlayer, CompareTally } from '../lib/iddaaCompare'
import { RungScorecard } from './RungScorecard'

afterEach(cleanup)

const RUNGS = [
  { n: 4, odd: 6.27, book: 0.13, ours: 0.19, value: 0.19, hit: true },
  { n: 5, odd: 15.1, book: 0.054, ours: 0.096, value: 0.45, hit: false },
]

function night(rungs: ComparePlayer['rungs'], status: CompareGame['status'], tally: CompareTally[] = []): BookCompare {
  const done = status === 'final'
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
        players: [
          {
            name: 'Donovan Clingan',
            player_id: null,
            team: 'POR',
            stat: 'blk',
            played: done ? true : null,
            ladder: [],
            ours: 2.2,
            book: 1.5,
            actual: done ? 4 : null,
            gap: 0.7,
            ours_hit: null,
            book_hit: null,
            closer: null,
            rungs: rungs?.map((r) => ({ ...r, hit: done ? r.hit : null })),
            rung_closer: done ? 'ours' : null,
          },
        ],
      },
    ],
    tally,
  }
}

const BLK: CompareTally = {
  stat: 'blk',
  lines: 1,
  compared: 1,
  median_gap: null,
  ours_above: 0,
  judged: 1,
  ours_hits: 0,
  book_hits: 0,
  ours_closer: 0,
  book_closer: 0,
  level: 0,
  ours_miss: null,
  book_miss: null,
  rungs: 2,
  ours_rung_score: 0.334,
  book_rung_score: 0.381,
}

function show(data: BookCompare, now: string) {
  const settled = data.games.every((g) => g.status === 'final')
  return render(<RungScorecard data={data} lines={linesOf(data, new Date(now))} settled={settled} />)
}

describe('rung scores by stat', () => {
  it('settled: the lower score in bold and the read named in words, no circles or card', () => {
    const { container } = show(night(RUNGS, 'final', [BLK]), '2026-11-22T20:00:00Z')
    expect(screen.getByRole('heading', { name: /Sat 21 Nov by stat/ })).toBeTruthy()
    const lower = screen.getAllByLabelText('ours 0.334, lower')
    expect(lower).toHaveLength(2) // Blocks and All
    expect(lower[0].tagName).toBe('B')
    expect(screen.getAllByText('Ours').length).toBeGreaterThan(1)
    expect(container.querySelector('.vr-circ, .vr-split, .vr-sc-card')).toBeNull()
    expect(screen.queryByText('Why score every rung')).toBeNull() // moved to How to read
  })
  it('tonight, a failed night and an older server show nothing', () => {
    expect(show(night(RUNGS, 'scheduled'), '2026-11-21T20:00:00Z').container.innerHTML).toBe('')
    cleanup()
    expect(show(night([], 'final', [BLK]), '2026-11-22T20:00:00Z').container.innerHTML).toBe('')
    cleanup()
    expect(show(night(undefined, 'final'), '2026-11-22T20:00:00Z').container.innerHTML).toBe('')
  })
})
