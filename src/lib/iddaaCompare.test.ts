import { describe, expect, it } from 'vitest'
import { gameStory, linesOf, num, plain, ranked, signed, tallyOf } from './iddaaCompare'
import type { BookCompare, CompareGame, ComparePlayer } from './iddaaCompare'

const BANDS = { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 }

function player(name: string, stat: ComparePlayer['stat'], ours: number | null, book: number, actual: number | null) {
  const gap = ours == null ? null : Math.round((ours - book) * 10) / 10
  const hit = (v: number | null, band: number) => (v == null || actual == null ? null : Math.abs(actual - v) <= band)
  const band = BANDS[stat]
  return {
    name,
    player_id: null,
    team: 'PHI',
    stat,
    played: actual == null ? null : true,
    ladder: [],
    ours,
    book,
    actual,
    gap,
    ours_hit: hit(ours, band),
    book_hit: hit(book, band),
    closer:
      ours == null || actual == null
        ? null
        : Math.abs(actual - ours) < Math.abs(actual - book)
          ? ('ours' as const)
          : ('book' as const),
  }
}

function night(players: ComparePlayer[], status: CompareGame['status'] = 'final'): BookCompare {
  return {
    season: 2027,
    day: 33,
    date: '2026-11-20',
    days: [33],
    nights: [{ day: 33, date: '2026-11-20', games: 1 }],
    bands: BANDS,
    look: { checked: null, ok: null, error: null, games: 1, matched: 1 },
    games: [
      {
        game_id: 401,
        away: 'MIL',
        home: 'PHI',
        tip: '2026-11-21T00:00:00Z',
        checked: '2026-11-20T23:30:00Z',
        status,
        away_score: 104,
        home_score: 119,
        markets: [],
        players,
      },
    ],
    tally: [],
  }
}

describe('iddaa vs Ours rows', () => {
  it("judges against the result, so 13.3 is wrong when he scored 2 (Can's case)", () => {
    const [l] = linesOf(night([player('Kelly Oubre Jr.', 'pts', 13.3, 13.5, 2)]), new Date())
    expect(l.oursHit).toBe(false)
    expect(l.bookHit).toBe(false)
    expect(l.closer).toBe('ours')
    expect(l.by).toBeCloseTo(0.2)
    expect(l.initials).toBe('KJ')
  })

  it('ranks All by gap in bands and a single stat by the raw gap', () => {
    const lines = linesOf(
      night([player('A One', 'pts', 22, 19.5, null), player('B Two', 'stl', 1.8, 1.1, null), player('C Three', 'reb', 5, 6.5, null)], 'scheduled'),
      new Date('2026-11-20T12:00:00Z'),
    )
    const all = ranked(lines, true)
    expect(all.above.map((l) => l.name)).toEqual(['B Two', 'A One']) // +0.7 of a band beats +0.5
    expect(all.rest.map((l) => l.name)).toEqual(['C Three'])
    expect(ranked(lines, false).above.map((l) => l.name)).toEqual(['A One', 'B Two']) // +2.5 beats +0.7
    expect(lines.every((l) => !l.tipped)).toBe(true)
  })

  it('counts hits, Closer and mean misses only over judged rows', () => {
    const lines = linesOf(
      night([player('A One', 'pts', 22, 19.5, 24), player('B Two', 'reb', 9, 11.5, 11), player('C Three', 'ast', null, 4.5, 3)]),
      new Date(),
    )
    const t = tallyOf(lines)
    expect(t.n).toBe(2) // no line of ours: not compared
    expect(t.judged).toBe(2)
    expect(t.ours).toBe(2) // 22 vs 24 within 5, 9 vs 11 within 2
    expect(t.book).toBe(2)
    expect(t.oursCloser).toBe(1)
    expect(t.bookCloser).toBe(1)
    expect(t.oursMiss).toBeCloseTo(2)
    expect(t.bookMiss).toBeCloseTo(2.5)
  })
})

describe('iddaa vs Ours numbers', () => {
  it('writes numbers and gaps the way the page shows them', () => {
    expect(num(228.5)).toBe('228.5')
    expect(num(12)).toBe('12')
    expect(num(-3.5)).toBe('−3.5')
    expect(signed(1.26, 'PTS')).toBe('+1.3')
    expect(signed(-0.4, 'REB')).toBe('−0.4')
    expect(signed(0, 'AST')).toBe('0.0')
    expect(signed(0.031, 'WIN')).toBe('+3pp')
  })
})

describe('iddaa vs Ours in plain words', () => {
  it('says what we expect against the book, then what happened', () => {
    const [before] = linesOf(night([player('A One', 'pts', 22, 19.5, null)], 'scheduled'), new Date('2026-11-20T12:00:00Z'))
    expect(plain(before, false)).toBe('we expect 2.5 more points than the book')
    const [after] = linesOf(night([player('A One', 'pts', 22, 19.5, 24)]), new Date())
    expect(plain(after, true)).toBe('finished with 24 points, we were closer')
    const [one] = linesOf(night([player('B Two', 'stl', 0.8, 1.5, 1)]), new Date())
    expect(plain(one, true)).toBe('finished with 1 steal, we were closer')
  })

  it('tells a game as who wins, by how much and the total', () => {
    const data = night([], 'scheduled')
    data.games[0].markets = [
      { market: 'winner', team: 'PHI', book_team: 'PHI', won: '', ours: 0.89, book: 0.8, actual: null, gap: 0.09, ours_hit: null, book_hit: null, closer: null },
      { market: 'margin', team: 'PHI', book_team: 'PHI', won: '', ours: 14, book: 10.5, actual: null, gap: 3.5, ours_hit: null, book_hit: null, closer: null },
      { market: 'total', team: '', book_team: '', won: '', ours: 230, book: 229.5, actual: null, gap: 0.5, ours_hit: null, book_hit: null, closer: null },
    ]
    const lines = linesOf(data, new Date('2026-11-20T12:00:00Z'))
    expect(gameStory(lines, false)).toBe(
      'We give PHI 89% to win, the book 80%. We see PHI by 14, the book by 10.5. We expect 230 points in all, the book 229.5.',
    )
  })
})
