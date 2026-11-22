import { createContext, useContext } from 'react'
import type { Me, PlanFeature } from '../api/client'

/**
 * COURT Pro for the components: whether a spot shows its real content or its lock, and a way to
 * open the upgrade sheet. ``ProProvider`` (components/Pro.tsx) fills it; without one (tests, the
 * sample league before plans) every spot shows its content and nothing opens.
 */
export interface ProApi {
  me: Me | undefined
  /** Whether this spot shows its Pro content: the API serves it, and no admin Free preview is on. */
  has: (feature: PlanFeature) => boolean
  /** Opens the upgrade sheet (or sign-up first for a visitor). */
  open: () => void
  /** Admins: the site as a Free account sees it. */
  previewFree: boolean
  setPreviewFree: (on: boolean) => void
}

export const ProContext = createContext<ProApi>({
  me: undefined,
  has: () => true,
  open: () => undefined,
  previewFree: false,
  setPreviewFree: () => undefined,
})

export function usePro(): ProApi {
  return useContext(ProContext)
}

/** Whether this spot shows its Pro content for the account on screen. */
export function useFeature(feature: PlanFeature): boolean {
  return useContext(ProContext).has(feature)
}
