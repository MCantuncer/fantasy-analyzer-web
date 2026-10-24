import type { Game, GameLine } from '../api/client'

export function line(over: Partial<GameLine>): GameLine {
  return {
    player_id: 1,
    name: 'Player',
    pro_team_id: 10,
    owner_team_id: null,
    minutes: 30,
    pts: 10,
    reb: 4,
    ast: 2,
    stl: 1,
    blk: 0,
    tpm: 1,
    to: 2,
    fgm: 4,
    fga: 9,
    ftm: 1,
    fta: 2,
    ...over,
  }
}

export function game(over: Partial<Game>): Game {
  return {
    id: 1,
    start: '2026-10-23T23:00:00Z',
    status: 'final',
    away: { pro_team_id: 10, abbrev: 'HOU', name: 'Houston Rockets', score: 114 },
    home: { pro_team_id: 24, abbrev: 'SA', name: 'San Antonio Spurs', score: 110 },
    lines: [],
    ...over,
  }
}
