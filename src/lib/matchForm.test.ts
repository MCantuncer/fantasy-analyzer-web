import { describe, expect, it } from 'vitest'
import {
  barHeight,
  defaultGame,
  formRead,
  inVenue,
  losersBest,
  possessive,
  signedMargin,
  streakOf,
  typeTag,
  verdictReason,
} from './matchForm'
import type { FormGame, FormStar, GameKind } from './matchForm'

const star = (name: string, team: string, pts: number): FormStar => ({
  player_id: pts,
  name,
  team,
  game_score: pts / 2,
  minutes: 34,
  pts,
  reb: 5,
  ast: 4,
  stl: 1,
  blk: 0,
  tpm: 2,
  to: 2,
  fgm: 8,
  fga: 16,
  ftm: 3,
  fta: 4,
})

type Row = [string, boolean, string, number, number, GameKind, boolean]

function games(team: string, rows: Row[]): FormGame[] {
  return rows.map(([date, home, opponent, points, opp, kind, neutral], i) => ({
    game_id: i + 1,
    date,
    start: `${date}T23:00:00Z`,
    home,
    neutral,
    kind,
    note: kind === 'cup' ? 'NBA Cup - Group Play' : neutral ? 'NBA Mexico City Game' : null,
    opponent,
    opponent_name: opponent,
    points,
    opponent_points: opp,
    won: points > opp,
    mvp: star('Winner', points > opp ? team : opponent, 30),
    best: star('Ours', team, 25),
    opp_best: star('Theirs', opponent, 28),
  }))
}

// Real 2026-27 games before IND at NY on Nov 22, newest first.
const IND = games('IND', [
  ['2026-11-20', false, 'CLE', 119, 128, 'cup', false],
  ['2026-11-18', true, 'HOU', 104, 119, 'regular', false],
  ['2026-11-15', false, 'PHI', 124, 131, 'regular', false],
  ['2026-11-13', true, 'NY', 106, 104, 'cup', false],
  ['2026-11-11', true, 'WSH', 114, 101, 'regular', false],
  ['2026-11-09', false, 'DAL', 122, 125, 'regular', false],
  ['2026-11-07', true, 'DEN', 102, 114, 'regular', true],
  ['2026-11-04', false, 'MEM', 107, 103, 'regular', false],
  ['2026-11-02', true, 'ATL', 104, 108, 'regular', false],
  ['2026-11-01', true, 'BKN', 90, 98, 'regular', false],
  ['2026-10-30', false, 'MIA', 125, 145, 'cup', false],
  ['2026-10-28', true, 'PHI', 109, 114, 'regular', false],
])
const NY = games('NY', [
  ['2026-11-21', true, 'POR', 97, 96, 'regular', false],
  ['2026-11-19', false, 'MIN', 102, 99, 'regular', false],
  ['2026-11-17', false, 'TOR', 111, 102, 'regular', false],
  ['2026-11-15', false, 'TOR', 112, 108, 'regular', false],
  ['2026-11-13', false, 'IND', 104, 106, 'cup', false],
  ['2026-11-11', true, 'CLE', 107, 115, 'regular', false],
  ['2026-11-10', true, 'MIL', 117, 85, 'regular', false],
  ['2026-11-07', false, 'CLE', 109, 97, 'regular', false],
  ['2026-11-04', true, 'CHI', 135, 91, 'regular', false],
  ['2026-11-02', true, 'BKN', 103, 90, 'regular', false],
])

describe('match form', () => {
  it('signs margins with a real minus and never writes −0', () => {
    expect(signedMargin(3)).toBe('+3')
    expect(signedMargin(-7)).toBe('−7')
    expect(signedMargin(0)).toBe('0')
    expect(signedMargin(-0.02, 1)).toBe('0.0')
    expect(signedMargin(16.4, 1)).toBe('+16.4')
  })

  it('reads the Pacers cooling off and the Knicks heating up over every game', () => {
    const ind = formRead(IND)
    expect([ind.heat, ind.wins, ind.losses, ind.per]).toEqual(['cold', 2, 3, -3.2])
    expect(ind.streak).toEqual({ won: false, n: 3 })
    expect(ind.since).toBe('2026-11-11')
    expect(verdictReason(ind, '')).toBe('lost 3 straight')
    const ny = formRead(NY)
    expect([ny.heat, ny.wins, ny.losses, ny.per]).toEqual(['hot', 4, 1, 3])
    expect(verdictReason(ny, '')).toBe('won 4 straight')
  })

  it("reads tonight's venue: the visitor's road games and the home team's home games", () => {
    const road = inVenue(IND, 'away', true)
    expect(road.map((g) => g.opponent)).toEqual(['CLE', 'PHI', 'DAL', 'MEM', 'MIA'])
    const ind = formRead(road)
    expect([ind.heat, ind.wins, ind.losses, ind.per, ind.since]).toEqual(['cold', 1, 4, -7, '2026-10-30'])
    expect(verdictReason(ind, 'on the road')).toBe('lost 3 straight on the road')
    const home = inVenue(NY, 'home', true)
    const ny = formRead(home)
    expect([ny.heat, ny.wins, ny.losses, ny.per, ny.since]).toEqual(['hot', 4, 1, 16.4, '2026-11-02'])
    expect(verdictReason(ny, 'at home')).toBe('won 4 of the last 5 at home')
    // The Mexico City game is neither home nor road.
    expect(inVenue(IND, 'home', true).some((g) => g.neutral)).toBe(false)
    expect(inVenue(IND, 'home', false)).toBe(IND)
  })

  it('needs the margin to agree, and five games, before it calls a team hot or cold', () => {
    const g = (rows: [number, number][]) =>
      games('X', rows.map(([p, o], i) => [`2026-11-${20 - i}`, true, 'Y', p, o, 'regular', false] as Row))
    // W W W W L with the loss the latest: still four of five, so Heating Up.
    expect(formRead(g([[99, 100], [110, 100], [110, 100], [110, 100], [110, 100]])).heat).toBe('hot')
    // Three straight wins by a point after two blowout losses: outscored over the five, so Steady.
    expect(formRead(g([[101, 100], [101, 100], [101, 100], [80, 110], [80, 110]])).heat).toBe('steady')
    // Lost 3 straight but outscored opponents over the five: Steady.
    expect(formRead(g([[99, 100], [99, 100], [99, 100], [130, 100], [130, 100]])).heat).toBe('steady')
    const four = formRead(g([[110, 100], [110, 100], [110, 100], [110, 100]]))
    expect(four.heat).toBe('steady')
    expect(verdictReason(four, 'at home')).toBe('only 4 games at home so far')
    expect(verdictReason(formRead([]), 'on the road')).toBe('no games on the road yet')
    expect(streakOf([])).toBeNull()
  })

  it('caps bars at 20 points and says so', () => {
    expect(barHeight(10, 42)).toEqual({ h: 21, capped: false })
    expect(barHeight(-44, 42)).toEqual({ h: 42, capped: true })
    expect(barHeight(20, 42)).toEqual({ h: 42, capped: false })
  })

  it('opens the Game Ball on their last meeting, else the latest game', () => {
    expect(defaultGame(IND, 'NY')?.date).toBe('2026-11-13')
    expect(defaultGame(IND, 'LAL')?.date).toBe('2026-11-20')
    expect(defaultGame([], 'NY')).toBeNull()
  })

  it("names the losing side's best", () => {
    const win = NY[0]
    const loss = NY[4]
    expect(losersBest(win)?.name).toBe('Theirs')
    expect(losersBest(loss)?.name).toBe('Ours')
    expect(losersBest({ ...win, opp_best: undefined })).toBeNull()
  })

  it('tags each game by type', () => {
    expect(typeTag('cup', 'NBA Cup - Group Play')).toEqual({ label: 'NBA Cup', detail: 'Group Play', variant: 'cup' })
    expect(typeTag('regular', null)).toEqual({ label: 'Regular Season', detail: null, variant: 'quiet' })
    expect(typeTag('regular', 'NBA Mexico City Game')?.detail).toBe('Mexico City Game')
    expect(typeTag('playoff', 'East 1st Round - Game 2')).toEqual({ label: 'Playoff', detail: 'East 1st Round · Game 2', variant: 'post' })
    expect(typeTag('play_in', null)?.label).toBe('Play-In')
    expect(typeTag(null, 'anything')).toBeNull()
  })

  it('writes possessives', () => {
    expect(possessive('Knicks')).toBe("Knicks'")
    expect(possessive('Heat')).toBe("Heat's")
  })
})
