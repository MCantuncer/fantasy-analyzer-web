import { describe, expect, it } from 'vitest'
import { parseLeagueInput } from './espnUrl'

describe('parseLeagueInput', () => {
  it('accepts a bare league ID', () => {
    expect(parseLeagueInput(' 744636428 ')).toEqual({ leagueId: 744636428 })
  })

  it('reads league, team and season from an ESPN URL', () => {
    expect(
      parseLeagueInput('https://fantasy.espn.com/basketball/team?leagueId=744636428&teamId=3&seasonId=2027'),
    ).toEqual({ leagueId: 744636428, teamId: 3, season: 2027 })
  })

  it('returns nothing for text that is neither', () => {
    expect(parseLeagueInput('my league')).toEqual({})
  })
})
