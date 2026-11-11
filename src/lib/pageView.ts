import { useEffect } from 'react'
import { countPageView } from '../api/client'

export interface Where {
  signedIn: boolean
  hasLeague: boolean
  /** The league has answered, so the tab on screen is the real one (not the default before it). */
  leagueReady: boolean
  verifying: boolean
  tab: string
  filmOpen: boolean
}

/** The page name the usage numbers count (see the API's app/usage.py), or null while it isn't settled. */
export function pageName(w: Where): string | null {
  if (!w.signedIn) return 'sign-in'
  if (!w.hasLeague) return 'my-leagues'
  if (w.verifying) return 'verify'
  if (!w.leagueReady) return null
  if (w.filmOpen && (w.tab === 'league' || w.tab === 'overview')) return 'film'
  return w.tab
}

/** Counts each page once when it is opened. Page names only: no league ids, no cookies, no storage. */
export function usePageView(page: string | null) {
  useEffect(() => {
    if (page) void countPageView(page)
  }, [page])
}
