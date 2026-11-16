import { describe, expect, it } from 'vitest'
import { NBA_TEAMS, searchTeams, teamByAbbrev, teamName } from './teamSearch'

const abbrevs = (q: string) => searchTeams(q).map((h) => h.team.abbrev)

describe('team search', () => {
  it('finds a team by city, nickname or abbreviation', () => {
    expect(abbrevs('den')).toEqual(['DEN'])
    expect(abbrevs('nugg')).toEqual(['DEN'])
    expect(abbrevs('denver')).toEqual(['DEN'])
    expect(abbrevs('okc')).toEqual(['OKC'])
    expect(abbrevs('thunder')).toEqual(['OKC'])
    expect(abbrevs('sixers')).toEqual(['PHI'])
    expect(abbrevs('golden state')).toEqual(['GS'])
  })

  it('marks the matched part of the full name', () => {
    expect(searchTeams('nugg')[0].marks).toEqual([[7, 11]])
    expect(teamName(searchTeams('nugg')[0].team).slice(7, 11)).toBe('Nugg')
    expect(searchTeams('blazers')[0].marks).toEqual([[15, 22]])
  })

  it('a single letter is left to the player search', () => {
    expect(searchTeams('d')).toEqual([])
    expect(searchTeams('  ')).toEqual([])
  })

  it('both LA teams for "los angeles" or "la"', () => {
    expect(abbrevs('los angeles')).toEqual(['LAL', 'LAC'])
    expect(abbrevs('la')).toEqual(['LAC', 'LAL'])
  })

  it('has every team once, with ESPN abbreviations', () => {
    expect(NBA_TEAMS).toHaveLength(30)
    expect(new Set(NBA_TEAMS.map((x) => x.abbrev)).size).toBe(30)
    expect(teamByAbbrev('utah')?.nickname).toBe('Jazz')
    expect(teamByAbbrev(null)).toBeUndefined()
  })
})
