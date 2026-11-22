import { describe, expect, it } from 'vitest'
import { ApiError, type Me } from '../api/client'
import { daysLeft, hasFeature, planState, upgradeRequired } from './plans'

const base: Me = { id: 1, email: 'fan@example.com', has_google: false, leagues: [], notices: [], plan: 'free', admin: false, gifted: false }

describe('plans', () => {
  it('opens a spot only when the API serves its feature', () => {
    expect(hasFeature({ ...base, features: [] }, 'next_game')).toBe(false)
    expect(hasFeature({ ...base, features: ['next_game'] }, 'next_game')).toBe(true)
    expect(hasFeature(undefined, 'estimates')).toBe(true) // still loading: no flash of locks
  })

  it('reads a 402 as the feature to upgrade for', () => {
    expect(upgradeRequired(new ApiError(402, 'upgrade_required', 'Pro', 'pregame'))).toBe('pregame')
    expect(upgradeRequired(new ApiError(403, 'forbidden', 'no'))).toBeNull()
    expect(upgradeRequired(new Error('x'))).toBeNull()
  })

  it('names the plan state', () => {
    expect(planState(base)).toEqual({ kind: 'free' })
    const pro = { ...base, plan: 'pro' as const }
    expect(planState({ ...pro, renews_at: '2026-12-22T00:00:00Z' }).kind).toBe('pro')
    expect(planState({ ...pro, trial_ends: '2026-11-29T00:00:00Z' }).kind).toBe('trial')
    expect(planState({ ...pro, ends_at: '2026-12-22T00:00:00Z' }).kind).toBe('leaving')
    expect(planState({ ...pro, gifted: true, ends_at: '2026-12-22T00:00:00Z' }).kind).toBe('gift')
  })

  it('counts days left', () => {
    const now = new Date('2026-11-25T12:00:00Z')
    expect(daysLeft(new Date('2026-11-29T00:00:00Z'), now)).toBe(4)
    expect(daysLeft(new Date('2026-11-20T00:00:00Z'), now)).toBe(0)
  })
})
