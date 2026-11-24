import { describe, expect, it } from 'vitest'
import { couponsOf, whyNot } from './coupons'
import { linesOf, ranked } from './iddaaCompare'
import type { BookCompare, CompareGame, CompareMarket, ComparePlayer } from './iddaaCompare'
import { clubLight, nightPool, placesOf, playerFile, rowSummary, searchNight, teamFile } from './nightFile'

const NOW = new Date('2026-11-22T12:00:00Z')

const win = (team: string, ours: number, pick: number): CompareMarket => ({
  market: 'winner',
  team,
  book_team: team,
  won: '',
  ours,
  book: 0.6,
  actual: null,
  gap: ours - 0.6,
  ours_hit: null,
  book_hit: null,
  closer: null,
  odds: [
    { side: 'pick', odd: pick },
    { side: 'other', odd: 2.4 },
  ],
})

const line = (
  name: string,
  id: number,
  team: string,
  stat: ComparePlayer['stat'],
  ours: number,
  book: number,
  n: number,
  odd: number,
  chance: number,
): ComparePlayer => ({
  name,
  player_id: id,
  team,
  stat,
  played: null,
  ladder: [],
  rungs: [{ n, odd, book: 1 / odd, ours: chance, value: chance * odd - 1, hit: null }],
  ours,
  book,
  actual: null,
  gap: ours - book,
  ours_hit: null,
  book_hit: null,
  closer: null,
})

const game = (
  id: number,
  away: string,
  home: string,
  m: CompareMarket,
  players: ComparePlayer[] = [],
): CompareGame => ({
  game_id: id,
  away,
  home,
  tip: '2026-11-23T00:00:00Z',
  checked: '',
  status: 'scheduled',
  away_score: null,
  home_score: null,
  markets: [m],
  players,
  estimates: [
    {
      name: 'Bench Guy',
      player_id: 900 + id,
      team: home,
      minutes: 14,
      pts: 6.2,
      reb: 2,
      ast: 1,
      stl: 0.4,
      blk: 0.2,
      three_pm: 0.8,
      played: null,
      actual: null,
    },
  ],
})

function night(): BookCompare {
  const games = [
    game(1, 'MIA', 'PHI', win('PHI', 0.74, 1.55), [
      line('Tyrese Maxey', 11, 'PHI', 'pts', 27.4, 24.5, 25, 1.8, 0.58),
      line('Tyrese Maxey', 11, 'PHI', 'three_pm', 3.1, 3.2, 4, 2.2, 0.38),
      line('Tyler Herro', 12, 'MIA', 'ast', 5.2, 4.6, 5, 1.7, 0.55),
    ]),
    game(2, 'DAL', 'DEN', win('DEN', 0.71, 1.5), [
      line('Nikola Jokić', 13, 'DEN', 'reb', 12.6, 11.5, 12, 1.62, 0.6),
      line('Nikola Jokić', 13, 'DEN', 'ast', 9.8, 9.5, 10, 1.9, 0.47),
    ]),
  ]
  return {
    season: 2027,
    day: 35,
    date: '2026-11-22',
    days: [35],
    nights: [{ day: 35, date: '2026-11-22', games: games.length }],
    bands: { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 },
    look: { checked: null, ok: null, error: null, games: games.length, matched: games.length },
    games,
    tally: [],
  }
}

describe('nightPool', () => {
  it('gathers every player once, lines in the stat order, and the estimate-only players too', () => {
    const data = night()
    const { players, teams } = nightPool(data, linesOf(data, NOW))
    const maxey = players.find((p) => p.name === 'Tyrese Maxey')!
    expect(maxey.lines.map((l) => l.stat)).toEqual(['3PM', 'PTS'])
    expect(players.filter((p) => p.name === 'Bench Guy')).toHaveLength(2)
    expect(players.find((p) => p.name === 'Bench Guy')!.lines).toEqual([])
    expect(teams.map((t) => t.abbrev)).toEqual(['MIA', 'PHI', 'DAL', 'DEN'])
  })
})

describe('searchNight', () => {
  const data = night()
  const pool = nightPool(data, linesOf(data, NOW))

  it('finds a player without his accent and marks the match', () => {
    const r = searchNight(pool, 'jok').tonight
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('player')
    if (r[0].kind === 'player') expect(r[0].marks).toEqual([[7, 10]])
  })

  it("puts tonight's teams first and a team without a game under Not on tonight", () => {
    expect(searchNight(pool, 'denver').tonight[0].kind).toBe('team')
    const off = searchNight(pool, 'spurs')
    expect(off.tonight).toEqual([])
    expect(off.off[0].kind).toBe('off-team')
  })

  it('adds players from the full index who are not on tonight', () => {
    const index = [
      {
        player_id: 1,
        name: 'Victor Wembanyama',
        pro_team: 'SA',
        position: 'C',
        percent_owned: 100,
        owner_team_id: null,
        on_roster: true,
      },
      {
        player_id: 13,
        name: 'Nikola Jokić',
        pro_team: 'DEN',
        position: 'C',
        percent_owned: 100,
        owner_team_id: null,
        on_roster: true,
      },
    ]
    expect(searchNight(pool, 'wemb', index).off.map((r) => r.kind)).toEqual(['off-player'])
    // a player on tonight is never listed twice
    expect(searchNight(pool, 'jok', index).off).toEqual([])
  })

  it('finds nothing for an empty query', () => {
    expect(searchNight(pool, '  ')).toEqual({ tonight: [], off: [] })
  })
})

describe('playerFile', () => {
  const data = night()
  const lines = linesOf(data, NOW)
  const pool = nightPool(data, lines)

  it("shows each line's bet exactly as the page's row takes it", () => {
    const maxey = pool.players.find((p) => p.name === 'Tyrese Maxey')!
    const f = playerFile(maxey, lines)
    for (const t of f.tiles) expect(t.line.barem).toBe(lines.find((l) => l.id === t.line.id)!.barem)
    expect(f.counts.bets).toBe(f.tiles.filter((t) => t.line.barem).length)
    expect(f.counts.lines).toBe(2)
  })

  it('ranks his lines the way Where we disagree does, with every game and stat shown', () => {
    const places = placesOf(lines)
    const { above } = ranked(
      lines.filter((l) => l.kind === 'player' && l.gap != null),
      true,
    )
    above.forEach((l, i) => expect(places.get(l.id)).toEqual({ rank: i + 1 }))
    const maxey3 = lines.find((l) => l.name === 'Tyrese Maxey' && l.stat === '3PM')!
    expect(places.get(maxey3.id)).toBe('level')
  })

  it('counts his Kupon legs and spots from the same slips the page draws', () => {
    const slots = couponsOf(lines)
    const shots = whyNot(lines)
    for (const p of pool.players) {
      const f = playerFile(p, lines, slots, shots)
      const ids = new Set(p.lines.map((l) => l.id))
      const legs = slots
        .filter((s) => s.coupon && !s.same)
        .flatMap((s) => s.coupon!.legs.filter((l) => ids.has(l.line.id)))
      expect(f.kupons).toHaveLength(legs.length)
      // spots come in page order: Kupons, Why not, Game picks, Disagree
      const order = f.spots.map((s) => ['kupon', 'whynot', 'game', 'disagree'].indexOf(s.where))
      expect([...order].sort((a, b) => a - b)).toEqual(order)
    }
  })

  it('says a player with no line has none', () => {
    const bench = pool.players.find((p) => p.name === 'Bench Guy')!
    expect(rowSummary(bench)).toBe('No line tonight')
    expect(playerFile(bench, lines).tiles).toEqual([])
  })
})

describe('teamFile', () => {
  it("holds the match's bets and the team's players, bets first", () => {
    const data = night()
    const lines = linesOf(data, NOW)
    const pool = nightPool(data, lines)
    const phi = pool.teams.find((t) => t.abbrev === 'PHI')!
    const f = teamFile(phi, pool.players, lines)
    expect(f.game.map((l) => l.stat)).toEqual(['WIN'])
    expect(f.players.map((p) => p.name)).toEqual(['Tyrese Maxey', 'Bench Guy'])
    expect(f.counts.playerBets).toBe(f.players.flatMap((p) => p.lines).filter((l) => l.barem).length)
  })
})

describe('clubLight', () => {
  it('keeps gold for you, live and focus: gold clubs take another tone', () => {
    expect(clubLight('DEN', '#E8B33A')).not.toBe('#E8B33A')
    expect(clubLight('IND', '#F2B233')).not.toBe('#F2B233')
    expect(clubLight('LAL', '#9B6FE0')).toBe('#9B6FE0')
  })
})
