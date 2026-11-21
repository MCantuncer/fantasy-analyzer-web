import { describe, expect, it } from 'vitest'
import { MIN_ODD, linesOf } from './iddaaCompare'
import type { BookCompare, CompareGame, ComparePlayer, CompareRung, CompareTally } from './iddaaCompare'
import {
  BOOK_LIFT,
  LEVEL_GAP,
  bigValueNote,
  brier,
  byChance,
  byPlayer,
  concentration,
  hadOf,
  landWords,
  loadChoice,
  nightSum,
  picksOf,
  pipFills,
  readBetter,
  resultOf,
  saveChoice,
  scoreRows,
  TAPE_BANDS,
  tapeBands,
  tapeOf,
  typical,
  closerCount,
  hadAt,
  isValue,
  ladderNote,
  pctText,
  price,
  rungCount,
  rungLabel,
  rungWinner,
  signed2,
  valueOf,
} from './valueRungs'

const rung = (n: number, odd: number, ours: number | null, hit: boolean | null, book = 0.82 / odd): CompareRung => ({
  n,
  odd,
  book,
  ours,
  value: ours == null ? null : ours * odd - 1,
  hit,
})

// Tyler Herro, 21 Nov: had 50 against our 19.5 and the book's 22 (the design's example).
const HERRO = [
  rung(20, 1.36, 0.48, true),
  rung(22, 1.63, 0.37, true),
  rung(25, 2.26, 0.23, true),
  rung(28, 3.4, 0.12, true),
  rung(30, 4.53, 0.08, true),
  rung(35, 10.19, 0.025, true),
  rung(40, 27.17, 0.007, true),
]

describe('price and value', () => {
  it('price is the chance the odds need: 1 ÷ odds', () => {
    expect(price(2.11)).toBeCloseTo(0.4739, 4)
    expect(price(15.1)).toBeCloseTo(0.0662, 4)
  })
  it('value is ours × odds − 1, and beats the price exactly when ours is above it', () => {
    expect(valueOf(0.616, 2.11)).toBeCloseTo(0.2998, 4) // Spencer AST 7+: +0.30
    expect(valueOf(0.096, 15.1)).toBeCloseTo(0.4496, 4) // Clingan BLK 5+: +0.45
    expect(valueOf(price(3), 3)).toBeCloseTo(0, 10)
    expect(valueOf(0.3, 3) > 0).toBe(0.3 > price(3))
  })
  it('a value rung needs value over 0 at odds over 1.33', () => {
    expect(MIN_ODD).toBe(1.33)
    expect(isValue(rung(5, 1.29, 0.84, null))).toBe(false)
    expect(isValue(rung(5, 1.33, 0.84, null))).toBe(false)
    expect(isValue(rung(6, 1.63, 0.72, null))).toBe(true)
    expect(isValue(rung(6, 1.63, 0.5, null))).toBe(false)
    expect(isValue(rung(6, 1.63, null, null))).toBe(false)
  })
})

describe('formats', () => {
  it('percent keeps one decimal only under 10%', () => {
    expect(pctText(0.096)).toBe('9.6%')
    expect(pctText(0.06622)).toBe('6.6%')
    expect(pctText(0.05)).toBe('5%')
    expect(pctText(0.616)).toBe('62%')
  })
  it('signed values carry the sign', () => {
    expect(signed2(0.2998)).toBe('+0.30')
    expect(signed2(-0.81)).toBe('−0.81')
    expect(signed2(0)).toBe('0.00')
  })
  it('a rung reads in full for screen readers', () => {
    expect(rungLabel(rung(7, 2.11, 0.616, true, 0.39), 'assists')).toBe(
      '7+ assists at 2.11: ours 62%, needs 47%, book 39%, value +0.30, landed',
    )
  })
})

describe('rung by rung', () => {
  it('the higher chance is nearer when the rung lands, the lower when it misses', () => {
    expect(rungWinner(rung(20, 1.36, 0.48, true, 0.6))).toBe('book')
    expect(rungWinner(rung(20, 1.36, 0.48, false, 0.6))).toBe('ours')
    expect(rungWinner(rung(20, 1.36, 0.6, true, 0.6))).toBe('tie')
    expect(rungWinner(rung(20, 1.36, 0.48, null))).toBeNull()
    expect(rungWinner(rung(20, 1.36, null, true))).toBeNull()
  })
  it('counts and tags: Book 7 of 7 for Herro', () => {
    expect(rungCount(HERRO)).toEqual({ ours: 0, book: 7, level: 0, n: 7 })
    expect(closerCount(HERRO, 'book')).toBe('7 of 7')
    const split = [rung(1, 2, 0.6, true, 0.5), rung(2, 3, 0.2, false, 0.3), rung(3, 4, 0.3, true, 0.4), rung(4, 5, 0.3, false, 0.2)]
    expect(closerCount(split, 'tie')).toBe('2 of 4 each')
    expect(closerCount([rung(1, 2, 0.5, null)], 'ours')).toBe('')
  })
  it('Brier: mean squared distance from what happened, settled rungs only', () => {
    expect(brier([rung(1, 2, 0.5, true), rung(2, 3, 0.2, false)], 'ours')).toBeCloseTo((0.25 + 0.04) / 2, 10)
    expect(brier([rung(1, 2, 0.5, null)], 'ours')).toBeNull()
    expect(brier(HERRO, 'ours')! > brier(HERRO, 'book')!).toBe(true)
  })
})

describe('the Had N rule', () => {
  const desc = [{ n: 13 }, { n: 12 }, { n: 10 }, { n: 9 }, { n: 8 }]
  it('sits above the first rung he reached', () => {
    expect(hadAt(desc, 9)).toBe(3)
    expect(hadAt(desc, 11)).toBe(2)
  })
  it('goes on top when every rung landed and under the last when none did', () => {
    expect(hadAt(desc, 50)).toBe(0)
    expect(hadAt(desc, 2)).toBe(desc.length)
  })
})

describe('the ladder note, from the rungs only', () => {
  it('settled, every rung landed, no value', () => {
    const n = ladderNote(HERRO, 50, 'book')
    expect(n.lead).toBe('Had 50: every rung landed')
    expect(n.rest).toBe(', so on each rung the side that gave the higher chance was nearer. The book was nearer on all 7.')
    expect(n.value).toBe('No rung beat its price: from −0.35 at 20+ to −0.81 at 40+.')
  })
  it('pre-game, one or two value rungs are named with ours and the price', () => {
    const n = ladderNote([rung(7, 2.55, 0.44, null), rung(8, 3.45, 0.31, null), rung(9, 4.8, 0.15, null)], null, null)
    expect(n.lead).toBe('')
    expect(n.value).toBe('2 rungs beat their price: 7+ at 2.55 (ours 44%, needs 39%) and 8+ at 3.45 (ours 31%, needs 29%).')
  })
  it('more than two value rungs name the best one', () => {
    const n = ladderNote([rung(6, 1.63, 0.72, true), rung(7, 2.11, 0.616, true), rung(8, 2.91, 0.45, true), rung(10, 6.04, 0.19, false)], 9, 'ours')
    expect(n.lead).toBe('Had 9: 3 of 4 rungs landed')
    expect(n.value).toBe('4 rungs beat their price; the best is 8+ at 2.91, value +0.31.')
  })
  it('leaves out rungs at odds of 1.33 or lower', () => {
    const n = ladderNote([rung(5, 1.29, 0.84, true), rung(6, 1.63, 0.5, true)], 9, 'book')
    expect(n.lead).toBe('Had 9: every rung landed')
    expect(n.value).toBe('No rung beat its price: −0.19 at 6+.')
  })
})

// ---------------------------------------------------------------------------------------------
// The Value Rungs section

type Spec = [name: string, stat: ComparePlayer['stat'], actual: number | null, rungs: [n: number, odd: number, ours: number][]]

function nightOf(specs: Spec[], status: CompareGame['status'] = 'final'): BookCompare {
  const players: ComparePlayer[] = specs.map(([name, stat, actual, rs]) => ({
    name,
    player_id: null,
    team: 'MEM',
    stat,
    played: actual == null ? null : true,
    ladder: [],
    ours: 5,
    book: 5.5,
    actual,
    gap: -0.5,
    ours_hit: null,
    book_hit: null,
    closer: null,
    rungs: rs.map(([n, odd, ours]) => rung(n, odd, ours, actual == null ? null : actual >= n)),
    rung_closer: null,
  }))
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
        away: 'MEM',
        home: 'MIN',
        tip: '2026-11-22T01:00:00Z',
        checked: '2026-11-22T00:05:00Z',
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

// Sat 21 from the design, with the 1.29 and 1.31 rungs the server no longer sends.
const SAT: Spec[] = [
  ['Cam Spencer', 'ast', 9, [[5, 1.29, 0.84], [6, 1.63, 0.72], [7, 2.11, 0.616], [8, 2.91, 0.45], [9, 4.07, 0.3], [10, 6.04, 0.19], [11, 4.9, 0.1]]],
  ['Cam Spencer', 'pts', 16, [[12, 1.31, 0.8], [15, 1.7, 0.66], [18, 2.47, 0.47], [20, 3.33, 0.35]]],
  ['Cam Spencer', 'three_pm', 2, [[3, 1.96, 0.56], [4, 3.4, 0.33]]],
  ['Donovan Clingan', 'blk', 4, [[4, 6.27, 0.19], [5, 15.1, 0.096]]],
  ['Donovan Clingan', 'reb', 13, [[14, 2.63, 0.43]]],
  ["Kel'el Ware", 'blk', 1, [[3, 3.79, 0.31]]],
  ['Kris Dunn', 'stl', 2, [[3, 5.6, 0.195]]],
  ['Mitchell Robinson', 'reb', 11, [[10, 2.15, 0.505]]],
  ['Zach Edey', 'reb', 15, [[14, 2.35, 0.46]]],
  ['Rudy Gobert', 'reb', 16, [[14, 2.7, 0.4]]],
  ['Josh Giddey', 'ast', 10, [[9, 2.17, 0.49]]],
]
const satLines = linesOf(nightOf(SAT), new Date('2026-11-22T20:00:00Z'))

describe('the night’s value picks', () => {
  it('keeps value over 0 at odds over 1.33 only, biggest value first', () => {
    const picks = picksOf(satLines)
    expect(picks).toHaveLength(19) // 21 in the design, less the 1.29 and 1.31 rungs
    expect(picks[0].line.name).toBe('Donovan Clingan')
    expect(picks[0].rung.n).toBe(5)
    expect(picks.every((p) => p.rung.odd > 1.33 && p.value > 0)).toBe(true)
  })
  it('sums the night: landed, said, net and without the biggest hit', () => {
    const s = nightSum(picksOf(satLines))
    expect(s.hits).toBe(10)
    expect(s.said).toBeCloseTo(7.722, 3)
    expect(s.net).toBeCloseTo(9.06, 2)
    expect(s.top?.rung.odd).toBe(6.27)
    expect(s.withoutTop).toBeCloseTo(9.06 - 5.27, 2)
    expect(s.players).toBe(8)
  })
  it('the Tape keeps every priced rung in odds order and bands from 1.33', () => {
    const tape = tapeOf(satLines)
    expect(tape.length).toBe(20) // 22 rungs less the two at 1.33 or under
    expect(tape.map((t) => t.odd)).toEqual([...tape.map((t) => t.odd)].sort((a, b) => a - b))
    const bands = tapeBands(tape)
    expect(TAPE_BANDS[0]).toEqual({ name: '1.33–1.6', lo: 1.33, hi: 1.6 })
    expect(bands[0].name).toBe('1.6–2.5') // the empty 1.33–1.6 band drops out
    expect(tapeBands([{ odd: 1.4, value: -0.3, pick: null }])[0].name).toBe('1.33–1.6')
    expect(bands.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 10)
    expect(typical([{ odd: 2, value: -0.2, pick: null }, { odd: 3, value: -0.4, pick: null }])).toBeCloseTo(-0.3, 10)
  })
})

describe('k in 10 and 1 in N', () => {
  it('reads chances as tenths, with what loses', () => {
    expect(landWords(0.616)).toEqual({ pre: '', strong: '6 in 10', post: ' land · 4 lose' })
    expect(landWords(0.45)).toEqual({ pre: '', strong: '5 in 10', post: ' land · 5 lose' })
    expect(landWords(0.15)).toEqual({ pre: '', strong: '2 in 10', post: ' land · 8 lose' })
  })
  it('under 15% says 1 in N with the exact percent', () => {
    expect(landWords(0.096)).toEqual({ pre: 'About ', strong: '1 in 10', post: ' lands · 9.6%' })
    expect(landWords(0.14)).toEqual({ pre: 'About ', strong: '1 in 7', post: ' lands · 14%' })
    expect(landWords(0.04)).toEqual({ pre: 'About ', strong: '1 in 25', post: ' lands · 4%' })
  })
  it('never says 10 in 10', () => {
    expect(landWords(0.97).strong).toBe('Nearly all')
  })
})

describe('the pip strip', () => {
  it('always has 10 pips and fills the last one partly', () => {
    expect(pipFills(0.45).map((f) => Math.round(f * 100) / 100)).toEqual([1, 1, 1, 1, 0.5, 0, 0, 0, 0, 0])
    const low = pipFills(0.096)
    expect(low).toHaveLength(10)
    expect(low[0]).toBeCloseTo(0.96, 10)
    expect(pipFills(0.14)[1]).toBeCloseTo(0.4, 10) // 9.6% and 14% look different
    expect(pipFills(1).every((f) => f === 1)).toBe(true)
  })
})

describe('groups', () => {
  const picks = picksOf(satLines)
  it('By Player: multi-rung players first, singles folded', () => {
    const g = byPlayer(picks)
    expect(g.map((x) => x.picks.length)).toEqual([10, 3, 6])
    expect(g[0].title).toBe('Cam Spencer')
    expect(g[2].title).toBe('6 more, one rung each')
    expect(g[2].line).toBeNull()
  })
  it('By Hit Chance: 60%+, 35–60%, under 35%, likeliest first', () => {
    const g = byChance(picks)
    expect(g.map((x) => x.key)).toEqual(['usual', 'coin', 'long'])
    expect(g[0].picks.every((p) => p.ours >= 0.6)).toBe(true)
    expect(g[2].picks.every((p) => p.ours < 0.35)).toBe(true)
    expect(g.reduce((s, x) => s + x.picks.length, 0)).toBe(19)
  })
})

describe('the two margin notes fire only on their rules', () => {
  const picks = picksOf(satLines)
  it('concentration: one player with 3+ rungs and a quarter of the night', () => {
    const c = concentration(picks)
    expect(c?.name).toBe('Cam Spencer')
    expect(c?.text).toBe('10 of the 19 are Cam Spencer: they land or miss together. Read them as one call, not 10.')
    const spencer3 = picks.filter((p) => p.line.name === 'Cam Spencer' && p.line.stat === 'AST' && p.rung.n <= 8)
    const singles = picks.filter((p) => p.line.name !== 'Cam Spencer' && p.line.name !== 'Donovan Clingan')
    expect(spencer3).toHaveLength(3)
    expect(singles).toHaveLength(6)
    expect(concentration([...spencer3, ...singles, ...singles.slice(0, 3)])?.count).toBe(3) // 3 of 12: a quarter
    expect(concentration([...spencer3, ...singles, ...singles])).toBeNull() // 3 of 15: under a quarter
    const two = picks.filter((p) => p.line.name !== 'Cam Spencer' || p.rung.n === 7 || p.rung.n === 8)
    expect(concentration(two)?.name).toBe('Donovan Clingan') // Spencer at 2 is under 3; Clingan has 3 of 11
    expect(concentration([])).toBeNull()
  })
  it('"What +0.45 means" is written from the biggest value', () => {
    const n = bigValueNote(picks)
    expect(n?.title).toBe('What +0.45 means')
    expect(n?.text).toBe('Clingan 5+ blocks at 15.1 lands about 1 time in 10. Most single nights it loses.')
    expect(n?.per100).toBe(9.6)
    expect(n?.back).toBe(145)
    expect(bigValueNote([])).toBeNull()
  })
  it('a likely biggest value says how often it still misses', () => {
    const lines = linesOf(nightOf([['A Bee', 'pts', null, [[10, 1.9, 0.62]]]], 'scheduled'), new Date('2026-11-21T00:00:00Z'))
    expect(bigValueNote(picksOf(lines))?.text).toBe('Bee 10+ points at 1.9 lands about 6 times in 10. It still misses about 4 times in 10.')
  })
})

describe('result slot states', () => {
  it('landed and missed say what he had', () => {
    const picks = picksOf(satLines)
    const spencer7 = picks.find((p) => p.line.name === 'Cam Spencer' && p.rung.n === 7)!
    expect(resultOf(spencer7)).toEqual({ kind: 'landed', had: 'had 9 ast' })
    const clingan5 = picks.find((p) => p.rung.n === 5)!
    expect(resultOf(clingan5)).toEqual({ kind: 'missed', had: 'had 4 blk' })
    expect(hadOf(spencer7.line)).toBe('9 ast')
  })
  it('pending before tip, live after it', () => {
    const spec: Spec[] = [['A Bee', 'pts', null, [[10, 1.9, 0.62]]]]
    const before = picksOf(linesOf(nightOf(spec, 'scheduled'), new Date('2026-11-21T00:00:00Z')))[0]
    expect(resultOf(before).kind).toBe('pending')
    const during = picksOf(linesOf(nightOf(spec, 'live'), new Date('2026-11-22T02:00:00Z')))[0]
    expect(resultOf(during).kind).toBe('live')
  })
  it('a final game without a result says so', () => {
    const p = picksOf(linesOf(nightOf([['A Bee', 'pts', null, [[10, 1.9, 0.62]]]], 'final'), new Date()))[0]
    expect(resultOf(p).kind).toBe('out')
  })
})

describe('empty and failed nights', () => {
  it('a night with rungs but none past their price has no picks, and the Tape still has rungs', () => {
    const lines = linesOf(nightOf([['A Bee', 'pts', 12, [[10, 1.9, 0.4], [12, 2.6, 0.3]]]]), new Date())
    expect(picksOf(lines)).toHaveLength(0)
    expect(tapeOf(lines)).toHaveLength(2)
  })
  it('a night whose ladders failed has no rungs at all', () => {
    const lines = linesOf(nightOf([['A Bee', 'pts', 12, []]]), new Date())
    expect(lines.reduce((s, l) => s + l.rungs.length, 0)).toBe(0)
    expect(tapeOf(lines)).toHaveLength(0)
    expect(nightSum([]).withoutTop).toBeNull()
  })
})

describe('the viewer’s choice in this browser', () => {
  it('reads back only allowed values and survives blocked storage', () => {
    saveChoice('vr-test', 'chance')
    expect(loadChoice('vr-test', ['player', 'chance'] as const)).toBe('chance')
    saveChoice('vr-test', 'bogus')
    expect(loadChoice('vr-test', ['player', 'chance'] as const)).toBeNull()
    const get = Storage.prototype.getItem
    const set = Storage.prototype.setItem
    Storage.prototype.getItem = () => {
      throw new Error('blocked')
    }
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
    try {
      expect(loadChoice('vr-test', ['player'] as const)).toBeNull()
      expect(() => saveChoice('vr-test', 'player')).not.toThrow()
    } finally {
      Storage.prototype.getItem = get
      Storage.prototype.setItem = set
    }
  })
})

describe('the Scorecard: the lower score reads better, gaps under 0.004 are Level', () => {
  it('the Level rule', () => {
    expect(LEVEL_GAP).toBe(0.004)
    expect(readBetter(0.161, 0.168)).toBe('ours')
    expect(readBetter(0.172, 0.166)).toBe('book')
    expect(readBetter(0.168, 0.165)).toBe('tie')
    expect(readBetter(0.1, 0.104)).toBe('ours') // exactly 0.004 is a read, not Level
    expect(readBetter(0.1, 0.1039)).toBe('tie')
    expect(readBetter(null, 0.2)).toBeNull()
  })
  const tally = (stat: string, rungs: number, ours: number, book: number): CompareTally => ({
    stat,
    lines: 0,
    compared: 0,
    median_gap: null,
    ours_above: 0,
    judged: 0,
    ours_hits: 0,
    book_hits: 0,
    ours_closer: 0,
    book_closer: 0,
    level: 0,
    ours_miss: null,
    book_miss: null,
    rungs,
    ours_rung_score: ours,
    book_rung_score: book,
  })
  it('one row per stat in the site order, and All weighted by rungs', () => {
    const night = nightOf([
      ['A Bee', 'pts', 20, [[15, 1.7, 0.66]]],
      ['C Dee', 'reb', 9, [[10, 2.1, 0.5]]],
    ])
    const lines = linesOf(night, new Date('2026-11-22T20:00:00Z')).map((l) =>
      l.stat === 'PTS' ? { ...l, rungCloser: 'book' as const } : { ...l, rungCloser: 'tie' as const },
    )
    const rows = scoreRows([tally('pts', 300, 0.17, 0.16), tally('reb', 100, 0.13, 0.15)], lines)
    expect(rows.map((r) => r.stat)).toEqual(['REB', 'PTS', 'ALL'])
    expect(rows[0].read).toBe('ours')
    expect(rows[1].read).toBe('book')
    expect(rows[1].split).toEqual({ ours: 0, level: 0, book: 1 })
    const all = rows[2]
    expect(all.rungs).toBe(400)
    expect(all.ours).toBeCloseTo(0.16, 6) // (0.17·300 + 0.13·100) / 400
    expect(all.book).toBeCloseTo(0.1575, 6)
    expect(all.read).toBe('tie')
    expect(all.split).toEqual({ ours: 0, level: 1, book: 1 })
  })
  it('tonight: rows with rungs but no settled score, and All has none', () => {
    const night = nightOf([['A Bee', 'pts', null, [[15, 1.7, 0.66]]]], 'scheduled')
    const rows = scoreRows([], linesOf(night, new Date('2026-11-21T20:00:00Z')))
    expect(rows.map((r) => r.stat)).toEqual(['PTS', 'ALL'])
    expect(rows[0]).toMatchObject({ rungs: 0, ours: null, book: null, read: null })
    expect(rows[1]).toMatchObject({ rungs: 0, ours: null, read: null })
  })
  it('the book’s lift above our lines, from 21 Nov', () => {
    expect(BOOK_LIFT.map((x) => `${x.stat} ${x.lift}`)).toEqual(['PTS +3.0', 'REB +1.1', 'AST +0.65', '3PM +0.8'])
  })
})
