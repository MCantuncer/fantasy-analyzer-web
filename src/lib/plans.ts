import { ApiError, type Me, type PlanFeature } from '../api/client'

/**
 * COURT Pro on the site. The API decides: it blanks Pro numbers for Free accounts and answers 402
 * ``upgrade_required`` on Pro pages, and ``me.features`` lists what this account is served now (every
 * feature until plans are enforced, and always for admins). The site only reads that list to choose
 * between the real spot and its lock, so a spot is never locked while the API still serves it.
 */

/** Whether this account is served ``feature`` now. Unknown (``me`` still loading): open, never a flash of locks. */
export function hasFeature(me: Me | undefined, feature: PlanFeature): boolean {
  if (!me) return true
  return (me.features ?? []).includes(feature)
}

/** A 402 from a Pro page: the account's plan no longer covers it (a trial ended mid-visit). */
export function upgradeRequired(error: unknown): PlanFeature | null {
  return error instanceof ApiError && error.status === 402 && error.code === 'upgrade_required'
    ? (error.feature ?? 'estimates')
    : null
}

export type PlanState =
  | { kind: 'free' }
  | { kind: 'trial'; ends: Date }
  | { kind: 'pro'; renews: Date | null }
  | { kind: 'leaving'; ends: Date }
  | { kind: 'gift'; ends: Date | null }

/** The account's plan as the account section shows it. */
export function planState(me: Me): PlanState {
  const date = (iso: string | null | undefined) => (iso ? new Date(iso) : null)
  if (me.plan !== 'pro') return { kind: 'free' }
  if (me.gifted) return { kind: 'gift', ends: date(me.ends_at) }
  const trial = date(me.trial_ends)
  if (trial) return { kind: 'trial', ends: trial }
  const ends = date(me.ends_at)
  if (ends) return { kind: 'leaving', ends }
  return { kind: 'pro', renews: date(me.renews_at) }
}

/** Whole days left until ``when``, never below 0 ("trial ends in 4 days"). */
export function daysLeft(when: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((when.getTime() - now.getTime()) / 86_400_000))
}
