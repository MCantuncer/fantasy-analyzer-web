import { describe, expect, it } from 'vitest'
import { COUPONS, bestSet, candidates, couponOf, couponsOf, fmtOdds, legWords, pays } from './coupons'
import { linesOf } from './iddaaCompare'
import type { BookCompare, CompareGame, CompareMarket, ComparePlayer } from './iddaaCompare'

const BANDS = { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 }
const NOW = new Date('2026-11-22T12:00:00Z')

const win = (team: string, ours: number, pick: number, hit: boolean | null = null): CompareMarket => ({
  market: 'winner',
  team,
  book_team: team,
  won: '',
  ours,
  book: 0.6,
  actual: null,
  gap: ours - 0.6,
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

function game(id: number, away: string, home: string, markets: CompareMarket[], players: ComparePlayer[] = [], status: CompareGame['status'] = 'scheduled'): CompareGame {
  return { game_id: id, away, home, tip: '2026-11-23T00:00:00Z', checked: '', status, away_score: null, home_score: null, markets, players }
}

function night(games: CompareGame[]): BookCompare {
  return {
    season: 2027,
    day: 35,
    date: '2026-11-22',
    days: [35],
    nights: [{ day: 35, date: '2026-11-22', games: games.length }],
    bands: BANDS,
    look: { checked: null, ok: null, error: null, games: games.length, matched: games.length },
    games,
    tally: [],
  }
}

const SIX = () => [
  game(1, 'MIA', 'PHI', [win('PHI', 0.74, 1.55)], [scorer('Joel Embiid', 'PHI', [[20, 1.4, 0.8], [25, 1.9, 0.55], [30, 2.9, 0.3]])]),
  game(2, 'LAL', 'DEN', [win('DEN', 0.7, 1.45)], [scorer('Nikola Jokic', 'DEN', [[22, 1.42, 0.81], [28, 2.1, 0.5]])]),
  game(3, 'NYK', 'CHA', [win('NYK', 0.66, 1.6)], [scorer('Jalen Brunson', 'NYK', [[22, 1.47, 0.76], [27, 2.2, 0.45]])]),
  game(4, 'SAC', 'HOU', [win('HOU', 0.62, 1.7)]),
  game(5, 'BOS', 'ORL', [win('BOS', 0.58, 1.8)]),
  game(6, 'UTA', 'OKC', [win('OKC', 0.9, 1.1)]), // 1.10: under 1.33, never used
]

describe('ready-made coupons', () => {
  it('lists every priced player rung and our game bets, never at 1.33 or under', () => {
    const pool = candidates(linesOf(night(SIX()), NOW))
    expect(pool.filter((c) => c.kind === 'player')).toHaveLength(7)
    expect(pool.filter((c) => c.kind === 'game').map((c) => c.bet)).toEqual([
      'PHI to win',
      'DEN to win',
      'NYK to win',
      'HOU to win',
      'BOS to win',
    ])
  })

  it('builds Highest confidence near 4.50 from the likeliest picks, one per game', () => {
    const [safe, players, matches] = couponsOf(linesOf(night(SIX()), NOW))
    const c = safe.coupon!
    expect(c.legs.length).toBeGreaterThanOrEqual(3)
    expect(c.legs.length).toBeLessThanOrEqual(4)
    expect(new Set(c.legs.map((l) => l.gameId)).size).toBe(c.legs.length)
    expect(c.odds).toBeGreaterThanOrEqual(4)
    expect(c.odds).toBeLessThanOrEqual(5.5)
    // three legs at 1.47 x 1.55 x 1.8 = 4.10 and 33% beat the four likeliest (Jokic, Embiid, Brunson,
    // HOU: 4.97 at 31%): fewer legs keep more of the chance
    expect(c.legs.map(legWords).sort()).toEqual(['BOS to win', 'Jalen Brunson 22+ points', 'PHI to win'])
    expect(c.chance).toBeCloseTo(0.76 * 0.74 * 0.58, 6)
    expect(c.implied).toBeCloseTo(1 / c.odds, 9)
    expect(pays(10, c.odds)).toBe(41)
    expect(fmtOdds(1.55 * 1.47 * 1.45 * 1.4)).toBe('4.63')
    expect(players.why).toBeNull()
    expect(matches.coupon!.legs.every((l) => l.kind === 'game')).toBe(true)
  })

  it('waits for player bets, and says when the night is too short for a coupon', () => {
    const noProps = SIX().map((g) => ({ ...g, players: [] }))
    const slots = couponsOf(linesOf(night(noProps), NOW))
    expect(slots.map((s) => [s.spec.kind, s.why, s.same])).toEqual([
      ['safe', null, null],
      ['matches', null, 'safe'], // the same game picks as Highest Confidence until player bets come in
      ['players', 'waiting', null],
      ['surprise', 'short', null], // five game picks can't reach 17
    ])
    const two = couponsOf(linesOf(night(noProps.slice(0, 2)), NOW))
    expect(two.find((s) => s.spec.kind === 'safe')!.why).toBe('short') // two games can't make 3 legs
  })

  it('takes the highest combined chance that lands in range, nearer the target on a tie', () => {
    const leg = (id: number, odd: number, chance: number) => ({ id: String(id), gameId: id, odd, chance }) as never
    const pool = [leg(1, 2.2, 0.5), leg(2, 2.1, 0.5), leg(3, 1.5, 0.7), leg(4, 1.5, 0.7), leg(5, 2, 0.48)]
    const spec = { ...COUPONS[0], min: 2, max: 3 }
    // 1.5 x 1.5 x 2.2 = 4.95 at 0.245 beats 2.2 x 2.1 = 4.62 at 0.25? no: 0.25 > 0.245, so the pair wins
    expect(bestSet(pool, spec)!.map((l) => l.id).sort()).toEqual(['1', '2'])
  })

  it('settles: a lost leg sinks the coupon, a player who sat out counts 1.00', () => {
    const games = SIX().map((g) => ({ ...g, status: 'final' as const, away_score: 100, home_score: 110 }))
    games[0].players[0] = { ...scorer('Joel Embiid', 'PHI', [[20, 1.4, 0.8], [25, 1.9, 0.55], [30, 2.9, 0.3]]), played: false }
    games[1].players[0] = scorer('Nikola Jokic', 'DEN', [[22, 1.42, 0.81], [28, 2.1, 0.5]], 30)
    games[2].players[0] = scorer('Jalen Brunson', 'NYK', [[22, 1.47, 0.76], [27, 2.2, 0.45]], 19)
    const pool = candidates(linesOf(night(games), NOW))
    const of = (id: string) => pool.find((c) => c.id.endsWith(id))!.result
    expect([of('Joel Embiid-pts-20'), of('Nikola Jokic-pts-22'), of('Jalen Brunson-pts-22')]).toEqual(['void', 'won', 'lost'])
    const [safe] = couponsOf(linesOf(night(games), NOW))
    expect(safe.coupon!.result).toBe('lost')
    expect(safe.coupon!.broke.map(legWords)).toEqual(['Jalen Brunson 22+ points'])
    // a sat-out leg pays at 1.00 while the listed odds and our chance stay as built
    const legs = pool.filter((c) => /Embiid-pts-20|Jokic-pts-22/.test(c.id))
    const c = couponOf(COUPONS[1], legs)
    expect([fmtOdds(c.listed), fmtOdds(c.odds), c.result, c.voided.length]).toEqual(['1.99', '1.42', 'won', 1])
    expect(c.chance).toBeCloseTo(0.8 * 0.81, 9)
  })
})
