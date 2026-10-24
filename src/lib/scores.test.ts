import { describe, expect, it } from 'vitest'
import { game, line } from '../test/fixtures'
import { best, dayLabel, nightTotals, ratio, statLine, winner } from './scores'

describe('scores helpers', () => {
  it('adds up only my players, with shooting from makes and attempts', () => {
    const games = [
      game({
        lines: [
          line({ player_id: 1, owner_team_id: 3, pts: 20, fgm: 9, fga: 15 }),
          line({ player_id: 2, owner_team_id: 5, pts: 29 }),
        ],
      }),
      game({ id: 2, lines: [line({ player_id: 3, owner_team_id: 3, pts: 36, fgm: 15, fga: 26 })] }),
    ]
    const t = nightTotals(games, 3)
    expect(t.played).toBe(2)
    expect(t.pts).toBe(56)
    expect(ratio(t.fgm, t.fga)).toBe('.585')
    expect(ratio(0, 0)).toBe('—')
  })

  it('names the standout and writes a short line', () => {
    const giannis = line({ name: 'Giannis Antetokounmpo', pts: 36, reb: 12, ast: 5, stl: 2 })
    expect(best([line({}), giannis])).toBe(giannis)
    expect(statLine(giannis)).toBe('36 pts, 12 reb, 5 ast')
  })

  it('shows the winner only once a game is final', () => {
    expect(winner(game({}))).toBe('away')
    expect(winner(game({ status: 'live' }))).toBeNull()
  })

  it('labels a game day by its US date, whatever the viewer time zone', () => {
    expect(dayLabel('2026-10-23')).toMatch(/^[A-Z][a-z]{2} 23$/)
    expect(dayLabel(null)).toBe('')
  })
})
