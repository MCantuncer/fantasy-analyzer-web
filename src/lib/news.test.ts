import { describe, expect, it } from 'vitest'
import type { NewsStory } from '../api/client'
import { ago, dayHeading, inFilter, inScope, ownership, statusText } from './news'

const base: NewsStory = {
  id: 'a',
  kind: 'injury',
  status: 'confirmed',
  headline: 'h',
  summary: '',
  published_at: '2026-10-26T08:00:00Z',
  updated_at: '2026-10-26T09:00:00Z',
  players: [
    {
      player_id: 1,
      name: 'A',
      pro_team: 'OKC',
      injury_status: 'OUT',
      owner_team_id: 8,
    },
  ],
  sources: [
    {
      source_id: 'cbs',
      name: 'CBS',
      kind: 'outlet',
      title: 'h',
      url: 'u',
      published_at: '',
      summary: '',
    },
    {
      source_id: 'reddit',
      name: 'Reddit',
      kind: 'tip',
      title: 'h',
      url: 'u',
      published_at: '',
      summary: '',
    },
  ],
  severity: 2,
  conflict: null,
}

describe('news helpers', () => {
  it('groups kinds into filters', () => {
    expect(inFilter(base, 'injuries')).toBe(true)
    expect(inFilter({ ...base, kind: 'return' }, 'injuries')).toBe(true)
    expect(inFilter({ ...base, kind: 'waive' }, 'moves')).toBe(true)
    expect(inFilter(base, 'rumors')).toBe(false)
  })

  it('scopes to rostered players and my roster', () => {
    expect(inScope(base, 'league', 3)).toBe(true)
    expect(inScope(base, 'mine', 3)).toBe(false)
    expect(inScope(base, 'mine', 8)).toBe(true)
    expect(inScope({ ...base, players: [] }, 'league', 3)).toBe(false)
  })

  it('counts sources without social tips', () => {
    expect(statusText(base)).toBe('Confirmed')
    expect(statusText({ ...base, status: 'reported' })).toBe('1 source · Reported')
    expect(statusText({ ...base, status: 'didnt_happen' })).toBe("Didn't happen")
  })

  it('labels ownership only inside a league', () => {
    expect(ownership({ owner_team_id: null }, 3, true)).toBe('free')
    expect(ownership({ owner_team_id: 3 }, 3, true)).toBe('mine')
    expect(ownership({ owner_team_id: 8 }, 3, true)).toBe('rival')
    expect(ownership({ owner_team_id: 8 }, 3, false)).toBe('none')
  })

  it('says how long ago', () => {
    const now = new Date('2026-10-26T12:00:00Z')
    expect(ago('2026-10-26T11:58:00Z', now)).toBe('2 min ago')
    expect(ago('2026-10-26T09:00:00Z', now)).toBe('3h ago')
    expect(dayHeading('2026-10-26T11:00:00Z', now)).toBe('Today')
  })
})
