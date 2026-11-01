import { describe, expect, it } from 'vitest'
import { ideaKey } from './TradeFeedback'

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
