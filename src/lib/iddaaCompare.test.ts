import { describe, expect, it } from 'vitest'
import {
  betFace,
  gameCall,
  gameStory,
  implied,
  linesOf,
  blendChance,
  fairChance,
  lostWhy,
  marketPair,
  marketPrice,
  num,
  odds,
  oursLine,
  picksNight,
  plain,
  playerPrice,
  ranked,
  signed,
  slipReturn,
  sureOf,
  tallyOf,
} from './iddaaCompare'
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

const rungAt = (n: number, odd = 1.9, ours: number | null = null) => ({ n, odd, book: 0.5, ours, value: null, hit: null })
const withRungs = (p: ComparePlayer, ...ns: number[]) => ({ ...p, rungs: ns.map((n) => rungAt(n)) })

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
  it('takes no bet on a player the book prices no rung for at or under ours', () => {
    const [l] = linesOf(night([player('Kelly Oubre Jr.', 'pts', 13.3, 13.5, 2)]), new Date())
    expect(l.barem).toBeNull() // no "Under 13.5": the book sells only its n+ rungs, each with its own odds
    expect([l.oursHit, l.bookHit, l.closer]).toEqual([null, null, null])
    expect(l.initials).toBe('KJ')
  })

  it("takes one bet, the floor ours backs among the book's rungs: Edey's 8 loses the 11+, Wemby's 19 wins the 12+", () => {
    const rung = (n: number, odd: number, ours: number | null = null) => ({ n, odd, book: 0.5, ours, value: null, hit: null })
    const edey = { ...player('Zach Edey', 'pts', 11.3, 10.4, 8), rungs: [rung(8, 1.3), rung(10, 1.62), rung(11, 1.85, 0.58), rung(13, 2.6)] }
    const [l] = linesOf(night([edey]), new Date())
    // one bet, with the book's own odds and our confidence (Can 2026-11-22)
    expect(l.barem).toEqual({ label: '11+', side: 'over', at: 10.5, odd: 1.85, sure: 0.58 })
    expect(sureOf(l.barem)).toBe('58%')
    expect([l.oursHit, l.bookHit, l.closer]).toEqual([false, true, 'book']) // never both ✓
    const [won] = linesOf(night([{ ...edey, actual: 11 }]), new Date())
    expect(won.closer).toBe('ours') // 11 lands the 11+
    const [past] = linesOf(night([{ ...edey, ours: 14.2, gap: 3.8, actual: 13 }]), new Date())
    expect(past.barem?.label).toBe('13+') // ours past the top rung: settled on the top one
    expect(past.closer).toBe('ours')
    const wemby = { ...player('Victor Wembanyama', 'reb', 12.3, 11.3, 19), rungs: [rung(9, 1.25), rung(11, 1.75), rung(12, 2.1), rung(14, 3.2)] }
    const [w] = linesOf(night([wemby]), new Date())
    expect([w.barem?.label, w.barem?.odd]).toEqual(['12+', 2.1]) // only the book's own rungs
    expect([w.oursHit, w.bookHit, w.closer]).toEqual([true, false, 'ours'])
    const [short] = linesOf(night([{ ...wemby, ours: 10.2, gap: -1.1 }]), new Date())
    expect(short.barem).toBeNull() // the only rung under 10.2 is the 1.25: no call
    expect(short.closer).toBeNull()
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
      night([
        withRungs(player('A One', 'pts', 22, 19.5, 24), 20, 22),
        withRungs(player('B Two', 'reb', 9, 11.5, 11), 9, 12),
        player('C Three', 'ast', null, 4.5, 3),
      ]),
      new Date(),
    )
    const t = tallyOf(lines)
    expect(t.n).toBe(2) // no line of ours: not compared
    expect(t.judged).toBe(2)
    expect(t.ours).toBe(2) // 22+ with 24, 9+ with 11
    expect(t.book).toBe(0)
    expect(t.oursCloser).toBe(2)
    expect(t.bookCloser).toBe(0)
    expect(t.level).toBe(0)
    expect(t.oursMiss).toBeCloseTo(2)
    expect(t.bookMiss).toBeCloseTo(2.5)
  })
})

describe('our game picks', () => {
  it('takes one priced bet per game line with our chance, and the other team with the points when ours sees less', () => {
    const data = night([], 'scheduled')
    const odds2 = (a: number, b: number) => [{ side: 'pick' as const, odd: a }, { side: 'other' as const, odd: b }]
    data.games[0].markets = [
      { market: 'winner', team: 'PHI', book_team: 'PHI', won: '', ours: 0.64, book: 0.58, actual: null, gap: 0.06, ours_hit: null, book_hit: null, closer: null, odds: odds2(1.55, 2.45) },
      { market: 'margin', team: 'PHI', book_team: '', won: '', ours: 2, book: 4.5, actual: null, gap: -2.5, ours_hit: null, book_hit: null, closer: null, odds: odds2(1.87, 1.93) },
      { market: 'total', team: '', book_team: '', won: '', ours: 230, book: 226.5, actual: null, gap: 3.5, ours_hit: null, book_hit: null, closer: null, odds: [{ side: 'under', odd: 1.9 }, { side: 'over', odd: 1.9 }] },
    ]
    const [win, mar, tot] = linesOf(data, new Date('2026-11-20T12:00:00Z'))
    // the chance leans 9 parts on the book's own price (Can 2026-11-23): PHI ours 64%, the book's 1.55 /
    // 2.45 read as 61%: 62%
    expect([win.barem?.label, win.barem?.odd, sureOf(win.barem)]).toEqual(['PHI to win', 1.55, '62%'])
    expect(win.barem?.alone).toBe(0.64)
    expect([mar.barem?.label, mar.barem?.odd, mar.barem?.side]).toEqual(['MIL +4.5', 1.93, 'under']) // MIL takes the points
    expect(Math.round(mar.barem!.alone! * 100)).toBe(57) // 1 - Normal(-2.5 / 13.6), our call alone
    expect(sureOf(mar.barem)).toBe('50%') // the book's 1.93 against 1.87 reads 49%
    expect([tot.barem?.label, tot.barem?.odd, sureOf(tot.barem)]).toEqual(['Over 226.5', 1.9, '51%']) // ours alone 58%
    // Book and Ours said the same way, side by side
    expect([marketPair(win), marketPair(mar), marketPair(tot)]).toEqual([
      { book: 'PHI 58%', ours: 'PHI 64%' },
      { book: 'PHI −4.5', ours: 'PHI −2' },
      { book: '226.5', ours: '230' },
    ])
    data.games[0].markets[0].odds = odds2(1.3, 3.4)
    expect(linesOf(data, new Date())[0].barem).toBeNull() // our side at 1.33 or less: no bet
  })

  it('reads the slip faces, our called score and the night tally', () => {
    const data = night([], 'scheduled')
    const odds2 = (a: number, b: number) => [{ side: 'pick' as const, odd: a }, { side: 'other' as const, odd: b }]
    const mk = (market: 'winner' | 'margin' | 'total', team: string, ours: number, book: number, odds: { side: 'pick' | 'other' | 'over' | 'under'; odd: number }[]) => ({
      market, team, book_team: team, won: '', ours, book, actual: null, gap: ours - book, ours_hit: null, book_hit: null, closer: null, odds,
    })
    data.games[0].markets = [
      mk('winner', 'PHI', 0.71, 0.66, odds2(1.45, 2.7)),
      mk('margin', 'PHI', 7.5, 4.5, odds2(1.87, 1.93)),
      mk('total', '', 228, 226.5, [{ side: 'under', odd: 1.9 }, { side: 'over', odd: 1.9 }]),
    ]
    const lines = linesOf(data, new Date('2026-11-20T12:00:00Z'))
    const [win, mar, tot] = lines
    expect(betFace(win)).toEqual({ q: 'To win', hero: 'PHI', num: false, dot: null })
    expect(betFace(mar)).toEqual({ q: 'PHI', hero: '−4.5', num: true, dot: 'PHI' })
    expect(betFace(tot)).toEqual({ q: 'Over', hero: '226.5', num: true, dot: null })
    // no team lines: the score comes from our total and margin
    const call = gameCall(data.games[0], lines)
    expect(call && [call.away, call.home, call.pick, call.chance]).toEqual([110.25, 117.75, 'PHI', 0.71])
    expect([oursLine(win, call), oursLine(mar, call), oursLine(tot, call)]).toEqual(['Ours PHI −8', 'Ours PHI −7.5', 'Ours +228'])
    expect(implied(1.87)).toBe(53)
    const n = picksNight(data.games, lines)
    expect([n.games, n.bets, n.none, n.settled]).toEqual([1, 3, 0, 0])
  })

  it('settles each slip at one unit a bet', () => {
    const data = night([], 'final') // MIL 104, PHI 119
    const odds2 = (a: number, b: number) => [{ side: 'pick' as const, odd: a }, { side: 'other' as const, odd: b }]
    data.games[0].markets = [
      { market: 'winner', team: 'PHI', book_team: 'PHI', won: 'PHI', ours: 0.71, book: 0.66, actual: 1, gap: 0.05, ours_hit: true, book_hit: true, closer: null, odds: odds2(1.45, 2.7) },
      { market: 'total', team: '', book_team: '', won: '', ours: 228, book: 226.5, actual: 223, gap: 1.5, ours_hit: null, book_hit: null, closer: null, odds: [{ side: 'under', odd: 1.9 }, { side: 'over', odd: 1.9 }] },
    ]
    const lines = linesOf(data, new Date('2026-11-21T12:00:00Z'))
    const [win, tot] = lines
    expect([win.oursHit, slipReturn(win)?.toFixed(2)]).toEqual([true, '0.45'])
    expect([tot.oursHit, slipReturn(tot)]).toEqual([false, -1]) // over 226.5, the game made 223
    const n = picksNight(data.games, lines)
    expect([n.settled, n.won, n.net.toFixed(2), n.winners, n.called]).toEqual([2, 1, '-0.55', 1, 1])
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
    const [after] = linesOf(night([withRungs(player('A One', 'pts', 22, 19.5, 24), 20, 22)]), new Date())
    expect(plain(after, true)).toBe('finished with 24 points, 22+ won')
    const [one] = linesOf(night([withRungs(player('B Two', 'stl', 1.2, 1.5, 0), 1, 2)]), new Date())
    expect(plain(one, true)).toBe('finished with 0 steals, 1+ lost')
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

describe('the book price beside its number', () => {
  const rung = (n: number, odd: number) => ({ n, odd, book: 0.5, ours: null, value: null, hit: null })
  it('takes the rung nearest the line, or the top rung when ours is past it', () => {
    const rungs = [rung(5, 1.45), rung(8, 2.1)]
    expect(playerPrice(rungs, 5.6, 7)).toEqual({ label: '5+', odd: 1.45, top: false, n: 5 })
    expect(playerPrice(rungs, 6.4, 7)).toEqual({ label: '8+', odd: 2.1, top: false, n: 8 })
    expect(playerPrice(rungs, 6.4, 9.9)).toEqual({ label: '8+', odd: 2.1, top: true, n: 8 }) // Can's 9.9 vs 8+
    expect(playerPrice(rungs, 6.4, 8.2)).toEqual({ label: '8+', odd: 2.1, top: false, n: 8 }) // inside the rung
    expect(playerPrice([], 6.4, 9.9)).toBeNull()
  })
  it('shows a game market on the side we lean to and drops prices of 1.33 and under', () => {
    const m = {
      market: 'total' as const, team: '', book_team: '', won: '', ours: 230, book: 226.5, actual: null, gap: 3.5,
      ours_hit: null, book_hit: null, closer: null,
      odds: [{ side: 'under' as const, odd: 1.9 }, { side: 'over' as const, odd: 1.9 }],
    }
    expect(marketPrice(m)).toEqual({ label: 'Over', odd: 1.9, top: false, fair: 0.5 })
    expect(marketPrice({ ...m, gap: -2 })).toEqual({ label: 'Under', odd: 1.9, top: false, fair: 0.5 })
    expect(marketPrice({ ...m, market: 'winner', team: 'PHI', odds: [{ side: 'pick', odd: 1.33 }] })).toBeNull()
    expect(odds(2)).toBe('2.00')
  })
})

describe('why our bet lost', () => {
  const why = { cause: 'luck' as const, piece: 'shooting', points: -8.1, text: 'Shot 6 of 15' }

  it('shows the reason only on a settled row we got wrong', () => {
    const lost = { ...withRungs(player('Joel Embiid', 'pts', 30, 28.5, 19), 25.5), why }
    const kept = { ...withRungs(player('Tyrese Maxey', 'pts', 25, 24.5, 26), 20.5), why }
    const [a, b] = linesOf(night([lost, kept]), new Date())
    expect(lostWhy(a)).toBe('Shot 6 of 15')
    expect(lostWhy(b)).toBeNull() // our bet won: nothing to explain
  })

  it('stays quiet before the final and when the server sent no reason', () => {
    const lost = { ...withRungs(player('Joel Embiid', 'pts', 30, 28.5, 19), 25.5), why }
    expect(linesOf(night([lost], 'live'), new Date()).map(lostWhy)).toEqual([null])
    expect(linesOf(night([{ ...lost, why: null }]), new Date()).map(lostWhy)).toEqual([null])
  })
})

describe('game chances lean on the book', () => {
  it("reads the book's two prices with its cut taken out, or its usual cut when one is missing", () => {
    expect(fairChance(1.63, 1.61)).toBeCloseTo(0.4969, 3) // the Nov 22 Over 223.5: about a coin flip
    expect(fairChance(1.63, null)).toBeCloseTo(1 / 1.63 / 1.235, 6)
  })

  it('blends 9 parts book to 1 part ours, and keeps ours when the book has no price', () => {
    expect(blendChance(0.67, 0.5)).toBeCloseTo(0.5177, 3) // DET @ ATL Over: 67% alone, about 52% blended
    expect(blendChance(0.5, 0.5)).toBeCloseTo(0.5, 9)
    expect(blendChance(0.7, null)).toBe(0.7)
  })
})
