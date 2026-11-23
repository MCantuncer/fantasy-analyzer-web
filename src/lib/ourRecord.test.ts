import { describe, expect, it } from 'vitest'
import { COUPONS, candidates, couponOf } from './coupons'
import type { CouponSlot } from './coupons'
import { linesOf } from './iddaaCompare'
import type { BookCompare, CompareGame, CompareMarket, ComparePlayer, CompareTally, Line } from './iddaaCompare'
import { nothingYet, recordCounts, scoredRungs, unitsSigned } from './ourRecord'

const BANDS = { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 }
const NOW = new Date('2026-11-22T12:00:00Z')

const win = (team: string, pick: number, hit: boolean | null = null): CompareMarket => ({
  market: 'winner',
  team,
  book_team: team,
  won: '',
  ours: 0.7,
  book: 0.6,
  actual: null,
  gap: 0.1,
  ours_hit: hit,
  book_hit: null,
  closer: null,
  odds: [
    { side: 'pick', odd: pick },
    { side: 'other', odd: 2.4 },
  ],
})

function scorer(name: string, team: string, rungs: [number, number, number][], actual: number | null = null): ComparePlayer {
  return {
    name,
    player_id: null,
    team,
    stat: 'pts',
    played: actual == null ? null : true,
    ladder: [],
    rungs: rungs.map(([n, odd, ours]) => ({ n, odd, book: 0.5, ours, value: null, hit: actual == null ? null : actual >= n })),
    ours: 24,
    book: 22.5,
    actual,
    gap: 1.5,
    ours_hit: null,
    book_hit: null,
    closer: null,
  }
}

function game(id: number, markets: CompareMarket[], players: ComparePlayer[], final: boolean): CompareGame {
  return {
    game_id: id,
    away: `A${id}`,
    home: `H${id}`,
    tip: '2026-11-23T00:00:00Z',
    checked: '',
    status: final ? 'final' : 'scheduled',
    away_score: null,
    home_score: null,
    markets,
    players,
  }
}

function night(final: boolean, tally: CompareTally[] = []): BookCompare {
  const r = (v: number) => (final ? v : null)
  const h = (v: boolean) => (final ? v : null)
  const games = [
    game(1, [win('H1', 1.55, h(true))], [scorer('Joel Embiid', 'H1', [[20, 1.4, 0.8], [25, 1.9, 0.55], [30, 2.9, 0.3]], r(26))], final),
    game(2, [win('H2', 1.45, h(false))], [scorer('Nikola Jokic', 'H2', [[22, 1.42, 0.81], [28, 2.1, 0.5]], r(18))], final),
    game(3, [win('A3', 1.6, h(true))], [scorer('Jalen Brunson', 'A3', [[22, 1.47, 0.76], [27, 2.2, 0.45]], r(22))], final),
    game(4, [win('H4', 1.7, h(false))], [], final),
    game(5, [win('A5', 1.8, h(true))], [], final),
    game(6, [win('H6', 1.1, h(true))], [], final), // 1.10: under 1.33, no bet
  ]
  return {
    season: 2027,
    day: 35,
    date: '2026-11-22',
    days: [35],
    nights: [{ day: 35, date: '2026-11-22', games: games.length }],
    bands: BANDS,
    look: { checked: null, ok: null, error: null, games: 6, matched: 6 },
    games,
    tally,
  }
}

/** Highest Confidence and Matches Only with the same two game picks (one slip), and Players Only. */
function slots(lines: Line[]): CouponSlot[] {
  const pool = candidates(lines)
  const leg = (bet: string) => pool.find((c) => c.bet === bet)!
  const games = [leg('H1 to win'), leg('A3 to win')]
  const players = [pool.find((c) => c.line.name === 'Joel Embiid' && c.at === 20)!, pool.find((c) => c.line.name === 'Nikola Jokic' && c.at === 22)!]
  const [safe, , players_, matches] = COUPONS
  return [
    { spec: safe, coupon: couponOf(safe, games), why: null, same: null },
    { spec: players_, coupon: couponOf(players_, players), why: null, same: null },
    { spec: matches, coupon: couponOf(matches, games), why: null, same: 'safe' },
    { spec: COUPONS.find((s) => s.kind === 'surprise')!, coupon: null, why: 'short', same: null },
  ]
}

describe('our record: the three counts', () => {
  it('before results: every bet, the Kupons built (a twin slip once) and every priced rung', () => {
    const data = night(false)
    const lines = linesOf(data, NOW)
    const c = recordCounts(data.games, lines, slots(lines))
    expect(c.bets).toEqual({ n: 8, game: 5, player: 3, settled: 0, won: 0, net: 0 })
    expect(c.kupons).toEqual({ n: 2, settled: 0, won: 0, picksOpen: 4, paid: [] })
    expect(c.rungs).toEqual({ n: 7, judged: 0, ours: 0, book: 0, level: 0, open: 7 })
    expect(nothingYet(c)).toBe(false)
  })

  it('after results: bets won and the net at 1 a bet, Kupons won, and rungs read closer', () => {
    const data = night(true)
    const lines = linesOf(data, NOW)
    const c = recordCounts(data.games, lines, slots(lines))
    // won: H1 +0.55, A3 +0.60, A5 +0.80, Embiid 20+ +0.40, Brunson 22+ +0.47; lost: H2, H4, Jokic 22+
    expect(c.bets).toMatchObject({ n: 8, settled: 8, won: 5 })
    expect(c.bets.net).toBeCloseTo(-0.18, 6)
    expect(c.kupons).toMatchObject({ n: 2, settled: 2, won: 1, picksOpen: 0 })
    expect(c.kupons.paid.map((x) => x.toFixed(4))).toEqual([(1.55 * 1.6).toFixed(4)])
    // Embiid 26: ours on all three; Jokic 18: book on 22+, level on 28+ (both 50%); Brunson 22: ours on both
    expect(c.rungs).toEqual({ n: 7, judged: 7, ours: 5, book: 1, level: 1, open: 0 })
  })

  it('a quiet night counts nothing', () => {
    const data = { ...night(false), games: [game(9, [], [], false)] }
    const c = recordCounts(data.games, linesOf(data, NOW), [])
    expect(nothingYet(c)).toBe(true)
  })

  it('rung scores by stat only once the tally has settled rungs and the night has ladders', () => {
    const blk = { stat: 'pts', rungs: 7, ours_rung_score: 0.15, book_rung_score: 0.18 } as CompareTally
    expect(scoredRungs([], linesOf(night(false), NOW))).toBe(0)
    expect(scoredRungs([blk], linesOf(night(true), NOW))).toBe(7)
    const bare = { ...night(true), games: [game(9, [win('H9', 1.5, true)], [], true)] }
    expect(scoredRungs([blk], linesOf(bare, NOW))).toBe(0)
  })

  it('writes units with a sign and two decimals', () => {
    expect(unitsSigned(1.2)).toBe('+1.20')
    expect(unitsSigned(-0.4)).toBe('−0.40')
    expect(unitsSigned(0.001)).toBe('0.00')
  })
})
