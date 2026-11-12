import { describe, expect, it } from 'vitest'
import type { SampleIndex } from '../api/client'
import { sampleDay, scoutOf } from './sample'

const index = {
  analysed_on: '2026-11-11',
  fresh: true,
  phase: 'season',
  season: 2027,
  league: { name: 'Sample league', size: 3, scoring: 'H2H_EACH_CATEGORY', categories: [], playoff_teams: 2 },
  default_team_id: 3,
  teams: [
    { id: 1, name: 'Horns', abbrev: 'HRN', projected_rank: 2, has_move: false },
    { id: 3, name: 'Hammer', abbrev: 'HAM', projected_rank: 1, has_move: true },
    { id: 7, name: 'Spain', abbrev: 'SPN', projected_rank: 3, has_move: true },
  ],
} as SampleIndex

describe('sample league', () => {
  it('scouts the team asked for when it is in the sample, else the default', () => {
    expect(scoutOf(index, 7).name).toBe('Spain')
    expect(scoutOf(index, 99).name).toBe('Hammer')
    expect(scoutOf(index, null).name).toBe('Hammer')
    expect(scoutOf({ ...index, default_team_id: 42 }, null).name).toBe('Horns')
  })

  it('prints the run day short, with the year only when it is not this one', () => {
    const now = new Date('2026-11-12T10:00:00Z')
    expect(sampleDay('2026-11-11', now)).toBe('Wed, Nov 11')
    expect(sampleDay('2026-04-06', new Date('2027-01-02T00:00:00Z'))).toBe('Mon, Apr 6, 2026')
  })
})
