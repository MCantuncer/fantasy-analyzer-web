import { describe, expect, it } from 'vitest'
import { teamLight } from './nbaTeams'

describe('teamLight', () => {
  it('knows all 30 clubs by the ESPN abbreviation', () => {
    const espn = 'ATL BOS NO CHI CLE DAL DEN DET GS HOU IND LAC LAL MIA MIL MIN BKN NY ORL PHI PHX POR SAC SA OKC UTAH WSH TOR MEM CHA'
    for (const a of espn.split(' ')) expect(teamLight(a), a).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('accepts long forms and lower case', () => {
    expect(teamLight('NOP')).toBe(teamLight('NO'))
    expect(teamLight('gsw')).toBe(teamLight('GS'))
  })

  it('has no colour for a free agent', () => {
    expect(teamLight('')).toBeUndefined()
    expect(teamLight(undefined)).toBeUndefined()
    expect(teamLight('FA')).toBeUndefined()
  })
})
