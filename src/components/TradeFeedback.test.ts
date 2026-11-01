import { describe, expect, it } from 'vitest'
import { ideaKey, readAs } from './TradeFeedback'

const p = (id: number) => ({ id })

describe('ideaKey', () => {
  it('matches the API key whatever the player order', () => {
    const t = { partner_team_id: 7, give: [p(2), p(1)], get: [p(3)] }
    expect(ideaKey('edge', t as never)).toBe('edge:7:1,2>3')
    expect(ideaKey('edge', { ...t, give: [p(1), p(2)] } as never)).toBe('edge:7:1,2>3')
  })

  it('keeps lists apart', () => {
    const t = { partner_team_id: 7, give: [p(1)], get: [p(3)] }
    expect(ideaKey('shop', t as never)).not.toBe(ideaKey('trades', t as never))
  })
})

describe('readAs', () => {
  it('says back how the note was read', () => {
    expect(readAs({ kind: 'clear', summary: 'He is losing minutes.' })).toBe(
      'We read your note as: He is losing minutes. The checks it points at ran first.',
    )
    expect(readAs({ kind: 'rant', summary: 'Stupid.' })).toContain('frustration')
    expect(readAs({ kind: 'unclear', summary: 'Bad vibes.' })).toContain('kept it for a closer look')
  })
})
